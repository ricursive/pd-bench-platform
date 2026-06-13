#!/usr/bin/env python3
"""Generate a synthetic ariane133-asap7 placement fixture for the platform.

This is SYNTHETIC dev/demo data, not a real PD-Bench result. It mimics the
shape of the real task (133 SRAM macros + a standard-cell cloud on a fixed
ASAP7 floorplan) closely enough to exercise the renderer, the phase
scrubber, and the ingest path. Real runs produce ~100K std cells; the
committed fixture uses fewer (CLI ``--cells``) to keep the repo small. The
renderer's LOD path is what actually scales to 100K+.

Emits, under ``fixtures/ariane133/``:
  cells.lef                 macro + representative std-cell masters (SIZE)
  ariane133_fp.def          fixed floorplan, every component UNPLACED (= phase 00)
  phases/10_global_place.def    analytic spread (overlaps allowed)
  phases/20_legalize.def        snapped to rows
  phases/30_detailed.def        final, tightened
  ariane133_placed.def      == phase 30 (the "submitted" DEF)
  phases.json               manifest consumed by the phase scrubber

All coordinates are integer DBU. The floorplan substrate (die, rows,
tracks, pins) is byte-identical across every phase DEF — those are the
hard-gated invariants of the task.
"""

from __future__ import annotations

import argparse
import json
import math
import pathlib
import random

# --- ASAP7-flavoured constants (plausible, self-consistent; not the real PDK) ---
DBU = 4000  # DEF database units per micron (ASAP7-scaled convention)
DIE_UM = 1260.0  # square die edge in microns (~1.26 mm, ariane133-ish)
ROW_H_UM = 1.08  # asap7sc7p5t row height (7.5 tracks)
SITE_W_UM = 0.054  # site (x) step
TRACK_PITCH_UM = 0.108

MACRO = "sram_asap7_16x256_1rw"
MACRO_W_UM = 24.0
MACRO_H_UM = 33.0
N_MACROS = 133
HALO_UM = 2.0  # the gate clearance

# A few representative std-cell masters: (name, width_um). Height = row height.
STD_MASTERS: list[tuple[str, float]] = [
    ("INVx1_ASAP7_75t_R", 0.27),
    ("BUFx2_ASAP7_75t_R", 0.378),
    ("NAND2x1_ASAP7_75t_R", 0.324),
    ("NOR2x1_ASAP7_75t_R", 0.324),
    ("AOI22x1_ASAP7_75t_R", 0.486),
    ("DFFHQNx1_ASAP7_75t_R", 0.864),
]

ORIENTS_R = "N"  # cells placed N (R0); rows are all N for simplicity


def um(value: float) -> int:
    """Microns -> integer DBU."""
    return int(round(value * DBU))


class Geom:
    """Derived floorplan geometry shared by every phase."""

    def __init__(self) -> None:
        self.die = um(DIE_UM)
        self.row_h = um(ROW_H_UM)
        self.site_w = um(SITE_W_UM)
        self.n_rows = self.die // self.row_h
        self.sites_per_row = self.die // self.site_w
        self.macro_w = um(MACRO_W_UM)
        self.macro_h = um(MACRO_H_UM)
        self.halo = um(HALO_UM)


def place_macros(g: Geom) -> list[tuple[int, int]]:
    """Lay 133 macros on a coarse grid with >= 2um halos, banked around edges.

    Mirrors how mixed-size placers cluster SRAMs: a perimeter-biased grid
    leaving a central std-cell field. Returns lower-left (x, y) per macro.
    """
    cols = 14
    rows = math.ceil(N_MACROS / cols)
    step_x = g.macro_w + um(HALO_UM * 2 + 6.0)
    step_y = g.macro_h + um(HALO_UM * 2 + 6.0)
    margin = um(20.0)
    coords: list[tuple[int, int]] = []
    for i in range(N_MACROS):
        c = i % cols
        r = i // cols
        x = margin + c * step_x
        y = margin + r * step_y
        # keep inside die
        x = min(x, g.die - g.macro_w - margin)
        y = min(y, g.die - g.macro_h - margin)
        coords.append((x, y))
    return coords


def gen_cells(g: Geom, n: int, macros: list[tuple[int, int]], rng: random.Random):
    """Create n std cells: pick a master, a target row, and an x within die.

    Returns list of dicts with master, w, and the three phase positions
    (global = analytic cloud, legal = row-snapped, detailed = tightened).
    """
    # Forbidden bands: macro bboxes inflated by the halo (std cells stay clear).
    blocks = [
        (x - g.halo, y - g.halo, x + g.macro_w + g.halo, y + g.macro_h + g.halo)
        for (x, y) in macros
    ]

    def in_block(px: int, py: int, w: int) -> bool:
        for (bx0, by0, bx1, by1) in blocks:
            if px + w > bx0 and px < bx1 and py + g.row_h > by0 and py < by1:
                return True
        return False

    # Cluster centers give the cloud organic density variation.
    centers = [
        (rng.randint(0, g.die), rng.randint(0, g.die)) for _ in range(24)
    ]
    cells = []
    attempts = 0
    while len(cells) < n and attempts < n * 40:
        attempts += 1
        name, w_um = rng.choice(STD_MASTERS)
        w = um(w_um)
        cx, cy = rng.choice(centers)
        gx = int(min(max(rng.gauss(cx, um(140.0)), 0), g.die - w))
        gy = int(min(max(rng.gauss(cy, um(140.0)), 0), g.die - g.row_h))
        # Legalized: snap to row + site grid, avoiding macro keepouts.
        row = max(0, min(g.n_rows - 1, gy // g.row_h))
        ly = row * g.row_h
        lx = (gx // g.site_w) * g.site_w
        lx = max(0, min(lx, g.die - w))
        if in_block(lx, ly, w):
            # nudge up a few rows to escape the keepout
            for dr in range(1, 8):
                ly2 = min((row + dr), g.n_rows - 1) * g.row_h
                if not in_block(lx, ly2, w):
                    ly = ly2
                    break
            else:
                continue
        # Detailed: small local tighten (shift left toward density).
        dx = max(0, lx - g.site_w * rng.randint(0, 3))
        cells.append(
            {
                "name": f"cell_{len(cells)}",
                "master": name,
                "w": w,
                "g": (gx, gy),
                "l": (lx, ly),
                "d": (dx, ly),
            }
        )
    return cells


# ---------------------------------------------------------------------------
# DEF writers
# ---------------------------------------------------------------------------
def _header(g: Geom) -> list[str]:
    lines = [
        "VERSION 5.8 ;",
        'DIVIDERCHAR "/" ;',
        'BUSBITCHARS "[]" ;',
        "DESIGN ariane ;",
        f"UNITS DISTANCE MICRONS {DBU} ;",
        f"DIEAREA ( 0 0 ) ( {g.die} {g.die} ) ;",
    ]
    # ROWS (every row, N orientation)
    for r in range(g.n_rows):
        lines.append(
            f"ROW ROW_{r} asap7sc7p5t {0} {r * g.row_h} N "
            f"DO {g.sites_per_row} BY 1 STEP {g.site_w} 0 ;"
        )
    # TRACKS (a representative metal layer each axis)
    n_tx = g.die // um(TRACK_PITCH_UM)
    lines.append(f"TRACKS X {um(TRACK_PITCH_UM)//2} DO {n_tx} STEP {um(TRACK_PITCH_UM)} LAYER M2 ;")
    lines.append(f"TRACKS Y {um(TRACK_PITCH_UM)//2} DO {n_tx} STEP {um(TRACK_PITCH_UM)} LAYER M3 ;")
    return lines


def _pins(g: Geom, n: int = 64) -> list[str]:
    """Fixed I/O pins spread along the die boundary."""
    lines = [f"PINS {n} ;"]
    per_side = n // 4
    for i in range(n):
        side = i // per_side
        t = (i % per_side + 1) / (per_side + 1)
        if side == 0:
            x, y = int(t * g.die), 0
        elif side == 1:
            x, y = g.die, int(t * g.die)
        elif side == 2:
            x, y = int(t * g.die), g.die
        else:
            x, y = 0, int(t * g.die)
        lines.append(
            f"- pin_{i} + NET pin_{i} + DIRECTION INPUT + USE SIGNAL "
            f"+ LAYER M4 ( -70 -70 ) ( 70 70 ) + FIXED ( {x} {y} ) N ;"
        )
    lines.append("END PINS")
    return lines


def write_def(path: pathlib.Path, g: Geom, comps: list[str]) -> None:
    lines = _header(g)
    lines.append("")
    lines.append(f"COMPONENTS {len(comps)} ;")
    lines.extend(comps)
    lines.append("END COMPONENTS")
    lines.append("")
    lines.extend(_pins(g))
    lines.append("")
    lines.append("END DESIGN")
    path.write_text("\n".join(lines) + "\n")


def comp_line(name: str, master: str, status: str, x: int, y: int, orient: str) -> str:
    if status in ("UNPLACED", "NONE"):
        return f"- {name} {master} + UNPLACED ;"
    return f"- {name} {master} + {status} ( {x} {y} ) {orient} ;"


def macro_name(i: int) -> str:
    return f"macro_{i}"


def build_phase(g: Geom, macros, cells, phase: str) -> list[str]:
    """Build the COMPONENTS body for a phase: 'fp'|'global'|'legal'|'detailed'."""
    out: list[str] = []
    for i, (mx, my) in enumerate(macros):
        if phase == "fp":
            out.append(comp_line(macro_name(i), MACRO, "UNPLACED", 0, 0, "N"))
        else:
            out.append(comp_line(macro_name(i), MACRO, "PLACED", mx, my, "N"))
    for cd in cells:
        if phase == "fp":
            out.append(comp_line(cd["name"], cd["master"], "UNPLACED", 0, 0, "N"))
        elif phase == "global":
            x, y = cd["g"]
            out.append(comp_line(cd["name"], cd["master"], "PLACED", x, y, ORIENTS_R))
        elif phase == "legal":
            x, y = cd["l"]
            out.append(comp_line(cd["name"], cd["master"], "PLACED", x, y, ORIENTS_R))
        else:
            x, y = cd["d"]
            out.append(comp_line(cd["name"], cd["master"], "PLACED", x, y, ORIENTS_R))
    return out


def write_lef(path: pathlib.Path, g: Geom) -> None:
    lines = [
        f"VERSION 5.8 ;",
        f"UNITS",
        f"  DATABASE MICRONS {DBU} ;",
        f"END UNITS",
        "",
        f"MACRO {MACRO}",
        f"  CLASS BLOCK ;",
        f"  SIZE {MACRO_W_UM:.4f} BY {MACRO_H_UM:.4f} ;",
        f"END {MACRO}",
        "",
    ]
    for name, w in STD_MASTERS:
        lines += [
            f"MACRO {name}",
            f"  CLASS CORE ;",
            f"  SIZE {w:.4f} BY {ROW_H_UM:.4f} ;",
            f"END {name}",
            "",
        ]
    path.write_text("\n".join(lines) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=pathlib.Path, default=pathlib.Path(__file__).parent / "ariane133")
    ap.add_argument("--cells", type=int, default=12000, help="std-cell count (real ~100K)")
    ap.add_argument("--seed", type=int, default=1337)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    g = Geom()
    macros = place_macros(g)
    cells = gen_cells(g, args.cells, macros, rng)

    out = args.out
    (out / "phases").mkdir(parents=True, exist_ok=True)

    write_lef(out / "cells.lef", g)
    write_def(out / "ariane133_fp.def", g, build_phase(g, macros, cells, "fp"))
    write_def(out / "phases" / "10_global_place.def", g, build_phase(g, macros, cells, "global"))
    write_def(out / "phases" / "20_legalize.def", g, build_phase(g, macros, cells, "legal"))
    write_def(out / "phases" / "30_detailed.def", g, build_phase(g, macros, cells, "detailed"))
    write_def(out / "ariane133_placed.def", g, build_phase(g, macros, cells, "detailed"))

    manifest = [
        {"stage": "00_floorplan", "label": "Floorplan (unplaced)", "def": "ariane133_fp.def", "elapsed_s": 0},
        {"stage": "10_global_place", "label": "Global placement", "def": "phases/10_global_place.def", "elapsed_s": 240},
        {"stage": "20_legalize", "label": "Legalization", "def": "phases/20_legalize.def", "elapsed_s": 410},
        {"stage": "30_detailed", "label": "Detailed placement", "def": "phases/30_detailed.def", "elapsed_s": 560},
    ]
    (out / "phases.json").write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"wrote fixture to {out}: {N_MACROS} macros + {len(cells)} cells, die {DIE_UM}um, dbu {DBU}")
    print(f"  rows={g.n_rows} sites/row={g.sites_per_row}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
