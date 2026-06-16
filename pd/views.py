"""Level-of-detail, hierarchy-aware textual views of a Design.

The zoom knob (chip → region → cell) mirrors `ls` → `ls -la` → `cat`: the agent
chooses the granularity its current decision needs, so perception stays inside
the context budget. Everything is text — legible to a plain LLM, not just a VLM.
"""

from __future__ import annotations

import math

from .model import Design, Inst
from . import metrics

RAMP = " .:-=+*#%@"  # density 0→max
COLS, ROWS = 44, 22  # chip-level addressable region grid (col, row), y-up


def _um(design: Design, dbu: float) -> float:
    return dbu / design.dbu


def _counts(design: Design, bbox, w, h):
    x0, y0, x1, y1 = bbox
    bw = max(1, (x1 - x0) / w)
    bh = max(1, (y1 - y0) / h)
    grid = [[0] * w for _ in range(h)]
    for c in design.cells():
        if not c.placed:
            continue
        col = int((c.cx - x0) / bw)
        row = int((c.cy - y0) / bh)
        if 0 <= col < w and 0 <= row < h:
            grid[row][col] += 1
    return grid


def _ascii(design: Design, bbox, w, h, mark_macros=True) -> list[str]:
    """Density grid as characters; macros overlaid as 'M'. Returns rows top→bottom."""
    x0, y0, x1, y1 = bbox
    bw = max(1, (x1 - x0) / w)
    bh = max(1, (y1 - y0) / h)
    grid = _counts(design, bbox, w, h)
    mx = max((v for row in grid for v in row), default=0)
    chars = [[RAMP[min(9, int(round(9 * v / mx)))] if mx else " " for v in row] for row in grid]
    if mark_macros:
        for m in design.macros():
            if not m.placed:
                continue
            c0 = int((m.x - x0) / bw); c1 = int((m.x + m.w - x0) / bw)
            r0 = int((m.y - y0) / bh); r1 = int((m.y + m.h - y0) / bh)
            for r in range(max(0, r0), min(h, r1 + 1)):
                for c in range(max(0, c0), min(w, c1 + 1)):
                    chars[r][c] = "M"
    # y-up: print highest row first
    return ["".join(chars[r]) for r in range(h - 1, -1, -1)]


def _frame(design: Design, rows: list[str], w: int) -> list[str]:
    ruler = "    " + "".join((str((i // 10) % 10) if i % 5 == 0 else " ") for i in range(w))
    ruler2 = "    " + "".join((str(i % 10) if i % 5 == 0 else " ") for i in range(w))
    out = [ruler, ruler2, "   +" + "-" * w + "+"]
    h = len(rows)
    for k, line in enumerate(rows):
        rownum = h - 1 - k
        tick = f"{rownum:>3}" if rownum % 5 == 0 else "   "
        out.append(f"{tick}|{line}|")
    out.append("   +" + "-" * w + "+")
    return out


def _gate_line(gates: list[dict]) -> str:
    return "  ".join((f"✓{g['gate']}" if g["ok"] else f"✗{g['gate']}") for g in gates)


# ── L0: chip ────────────────────────────────────────────────────────────────
def chip(design: Design, reference=None, lef_macros=None, halo_um=2.0) -> str:
    head = [
        f"CHIP  {_um(design, design.die_w):.0f} x {_um(design, design.die_h):.0f} um"
        f"   macros {len(design.macros())}   cells {len(design.cells())}"
        f"   placed {len(design.placed_cells())}/{len(design.cells())}",
        f"blocks: {', '.join(design.blocks())}",
    ]
    if lef_macros is not None:
        gates = metrics.gate_report(design, reference, lef_macros, halo_um)
        head.append(f"gates: {_gate_line(gates)}    HPWL~ {metrics.hpwl_proxy(design):,} dbu")
    body = _frame(design, _ascii(design, design.die, COLS, ROWS), COLS)
    legend = f"  density '{RAMP}'  M=macro   drill: pd view region(col,row) | pd view <cell> --context"
    return "\n".join(head + [""] + body + [legend])


# ── L1: region ────────────────────────────────────────────────────────────
def region(design: Design, col: int, row: int, sub_w=48, sub_h=22) -> str:
    bw = design.die_w / COLS
    bh = design.die_h / ROWS
    x0 = int(design.die[0] + col * bw)
    y0 = int(design.die[1] + row * bh)
    bbox = (x0, y0, int(x0 + bw), int(y0 + bh))
    insts = list(design.in_bbox(bbox))
    macs = [i for i in insts if i.is_macro]
    cells = [i for i in insts if not i.is_macro]
    head = [
        f"REGION ({col},{row})  ~{_um(design, bw):.0f} x {_um(design, bh):.0f} um"
        f"   x[{x0}..{bbox[2]}] y[{y0}..{bbox[3]}] dbu",
        f"  contains {len(macs)} macros, {len(cells)} cells",
    ]
    if macs:
        head.append("  macros: " + ", ".join(f"{m.name}@({m.x},{m.y})" for m in macs[:6]))
    sample = ", ".join(f"{c.name.split('/')[-1]}" for c in cells[:10])
    if sample:
        head.append(f"  cells (sample): {sample}{' …' if len(cells) > 10 else ''}")
    body = _frame(design, _ascii(design, bbox, sub_w, sub_h), sub_w)
    return "\n".join(head + [""] + body)


# ── L2: cell ────────────────────────────────────────────────────────────────
def cell(design: Design, name: str, context=True, k=6) -> str:
    inst = design.insts.get(name)
    if inst is None:
        # tolerate leaf-name lookups
        cand = [n for n in design.insts if n.endswith("/" + name) or n == name]
        if len(cand) == 1:
            inst = design.insts[cand[0]]
            name = cand[0]
        else:
            return f"no instance '{name}'" + (f" ({len(cand)} fuzzy matches)" if cand else "")
    lines = [
        f"INST {name}",
        f"  master {inst.master}   {'MACRO' if inst.is_macro else 'cell'}   block {inst.block}",
        f"  status {inst.status}   pos ({inst.x},{inst.y}) dbu = ({_um(design, inst.x):.2f},{_um(design, inst.y):.2f}) um"
        f"   orient {inst.orient}   size {_um(design, inst.w):.2f}x{_um(design, inst.h):.2f} um",
    ]
    nets = [n for n, terms in design.nets.items() if any(t[0] == name for t in terms)]
    if nets:
        lines.append(f"  nets ({len(nets)}): {', '.join(nets[:8])}{' …' if len(nets) > 8 else ''}")
    if context:
        others = [i for i in design.insts.values() if i.name != name and i.placed]
        others.sort(key=lambda o: math.hypot(o.cx - inst.cx, o.cy - inst.cy))
        lines.append("  nearest neighbors:")
        for o in others[:k]:
            d = math.hypot(o.cx - inst.cx, o.cy - inst.cy) / design.dbu
            dirn = _compass(o.cx - inst.cx, o.cy - inst.cy)
            lines.append(f"    {d:6.2f}um {dirn:2}  {o.name}  ({'macro' if o.is_macro else o.master})")
        nm = _nearest_macro(design, inst)
        if nm:
            clr, mac = nm
            lines.append(f"  nearest macro edge: {clr:.2f}um to {mac.name}  (halo gate needs >= 2.00um)")
    return "\n".join(lines)


def _compass(dx: float, dy: float) -> str:
    return ("N" if dy > 0 else "S" if dy < 0 else "") + ("E" if dx > 0 else "W" if dx < 0 else "") or "·"


def _nearest_macro(design: Design, inst: Inst):
    best = None
    for m in design.macros():
        if not m.placed or m.name == inst.name:
            continue
        dx = max(m.x - (inst.x + inst.w), inst.x - (m.x + m.w), 0)
        dy = max(m.y - (inst.y + inst.h), inst.y - (m.y + m.h), 0)
        clr = math.hypot(dx, dy) / design.dbu
        if best is None or clr < best[0]:
            best = (clr, m)
    return best


# ── hierarchy ────────────────────────────────────────────────────────────────
def block(design: Design, name: str, sub_w=44, sub_h=18) -> str:
    insts = design.blocks().get(name)
    if not insts:
        return f"no block '{name}'. blocks: {', '.join(design.blocks())}"
    placed = [i for i in insts if i.placed]
    if placed:
        x0 = min(i.x for i in placed); y0 = min(i.y for i in placed)
        x1 = max(i.x + i.w for i in placed); y1 = max(i.y + i.h for i in placed)
    else:
        x0, y0, x1, y1 = design.die
    macs = [i for i in insts if i.is_macro]
    head = [
        f"BLOCK {name}   {len(macs)} macros, {len(insts) - len(macs)} cells"
        f"   placed {len(placed)}/{len(insts)}",
        f"  bbox x[{x0}..{x1}] y[{y0}..{y1}] dbu = {_um(design, x1 - x0):.0f}x{_um(design, y1 - y0):.0f} um",
    ]
    body = _frame(design, _ascii(design, (x0, y0, x1, y1), sub_w, sub_h), sub_w)
    return "\n".join(head + [""] + body)


def ls(design: Design) -> str:
    lines = ["BLOCKS (logical hierarchy):"]
    for name, insts in design.blocks().items():
        macs = sum(1 for i in insts if i.is_macro)
        placed = sum(1 for i in insts if i.placed)
        lines.append(f"  {name:10}  {macs:>3} macros  {len(insts) - macs:>6} cells  placed {placed}/{len(insts)}")
    lines.append("drill: pd view <block>")
    return "\n".join(lines)


# ── status (git status + CI) ─────────────────────────────────────────────────
def status(design: Design, reference, lef_macros, halo_um=2.0) -> str:
    gates = metrics.gate_report(design, reference, lef_macros, halo_um)
    lines = ["STATUS", f"  gates: {_gate_line(gates)}"]
    for g in gates:
        if not g["ok"]:
            for f in g["failures"][:4]:
                lines.append(f"    {g['gate']}: {f}")
            if len(g["failures"]) > 4:
                lines.append(f"    {g['gate']}: … +{len(g['failures']) - 4} more")
    placed = len(design.placed_cells())
    lines.append(
        f"  placement: {placed}/{len(design.cells())} cells placed, {len(design.macros())} macros"
    )
    lines.append(f"  HPWL~ {metrics.hpwl_proxy(design):,} dbu (instance-center proxy)")
    return "\n".join(lines)
