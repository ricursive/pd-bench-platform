import type { PlacementPayload } from "@/lib/def/types";
import { CHIP, categoryColor, densityCss } from "./palette";
import {
  type View,
  binDensity,
  shouldHeatmap,
  visibleWorldRect,
  worldToScreenX,
  worldToScreenY,
} from "./view";

export interface RenderOpts {
  mode: "auto" | "cells" | "density";
  showHalos: boolean;
  showTracks: boolean;
  haloDbu: number;
}

export const DEFAULT_OPTS: RenderOpts = {
  mode: "auto",
  showHalos: false,
  showTracks: true,
  haloDbu: 0,
};

/** Average std-cell width (dbu) — drives the LOD switch. */
function avgCellWidth(p: PlacementPayload): number {
  const c = p.cells;
  if (!c.count) return 1000;
  let s = 0;
  const n = Math.min(c.count, 4000);
  for (let i = 0; i < n; i++) s += c.w[i];
  return s / n;
}

/** Draw the full placement into a 2D context already DPR-scaled to CSS px. */
export function drawPlacement(
  ctx: CanvasRenderingContext2D,
  p: PlacementPayload,
  v: View,
  opts: RenderOpts = DEFAULT_OPTS,
): { mode: "cells" | "density" } {
  const sub = p.substrate;
  ctx.clearRect(0, 0, v.w, v.h);
  ctx.fillStyle = CHIP.bg;
  ctx.fillRect(0, 0, v.w, v.h);

  const X = (x: number) => worldToScreenX(x, v);
  const Y = (y: number) => worldToScreenY(y, v);

  // ── die outline ───────────────────────────────────────────────────────
  const dx0 = X(sub.die.x0);
  const dy0 = Y(sub.die.y1);
  const dieWpx = (sub.die.x1 - sub.die.x0) * v.scale;
  const dieHpx = (sub.die.y1 - sub.die.y0) * v.scale;
  ctx.strokeStyle = CHIP.die;
  ctx.lineWidth = 1;
  ctx.strokeRect(dx0, dy0, dieWpx, dieHpx);

  // ── rows banding (only when rows are a few px tall) ──────────────────────
  if (sub.rows.length) {
    const rowH = sub.rows.length > 1 ? sub.rows[1].y - sub.rows[0].y : 0;
    if (rowH > 0 && rowH * v.scale > 1.4) {
      ctx.fillStyle = CHIP.rows;
      for (let i = 0; i < sub.rows.length; i += 2) {
        const ry = Y(sub.rows[i].y + rowH);
        ctx.fillRect(dx0, ry, dieWpx, rowH * v.scale);
      }
    }
  }

  // ── tracks (faint, only fairly zoomed in) ───────────────────────────────
  if (opts.showTracks) {
    for (const t of sub.tracks) {
      if (t.step * v.scale < 6) continue;
      ctx.strokeStyle = CHIP.tracks;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const n = Math.min(t.num, 4000);
      for (let i = 0; i < n; i++) {
        const c = t.start + i * t.step;
        if (t.axis === "X") {
          const sx = X(c);
          if (sx < dx0 || sx > dx0 + dieWpx) continue;
          ctx.moveTo(sx, dy0);
          ctx.lineTo(sx, dy0 + dieHpx);
        } else {
          const sy = Y(c);
          if (sy < dy0 || sy > dy0 + dieHpx) continue;
          ctx.moveTo(dx0, sy);
          ctx.lineTo(dx0 + dieWpx, sy);
        }
      }
      ctx.stroke();
    }
  }

  // ── std cells: heatmap (LOD) or individual rects ────────────────────────
  const heat = opts.mode === "density" || (opts.mode === "auto" && shouldHeatmap(avgCellWidth(p), v.scale));
  let usedMode: "cells" | "density" = "cells";
  if (p.cells.count) {
    if (heat) {
      usedMode = "density";
      const aspect = (sub.die.x1 - sub.die.x0) / Math.max(1, sub.die.y1 - sub.die.y0);
      const nx = Math.max(40, Math.min(200, Math.round(140 * Math.sqrt(aspect))));
      const ny = Math.max(40, Math.min(200, Math.round(nx / aspect)));
      const grid = binDensity(sub.die, p.cells, nx, ny);
      const bw = (sub.die.x1 - sub.die.x0) / nx;
      const bh = (sub.die.y1 - sub.die.y0) / ny;
      const cellWpx = bw * v.scale + 1;
      const cellHpx = bh * v.scale + 1;
      for (let by = 0; by < ny; by++) {
        for (let bx = 0; bx < nx; bx++) {
          const t = grid.values[by * nx + bx];
          if (t < 0.012) continue;
          const wx = sub.die.x0 + bx * bw;
          const wy = sub.die.y0 + by * bh;
          ctx.fillStyle = densityCss(Math.pow(t, 0.6), 0.92);
          ctx.fillRect(X(wx), Y(wy + bh), cellWpx, cellHpx);
        }
      }
    } else {
      usedMode = "cells";
      const vis = visibleWorldRect(v);
      const m = 2000;
      for (let i = 0; i < p.cells.count; i++) {
        const x = p.cells.x[i];
        const y = p.cells.y[i];
        const w = p.cells.w[i];
        const h = p.cells.h[i];
        if (x + w < vis.x0 - m || x > vis.x1 + m || y + h < vis.y0 - m || y > vis.y1 + m) continue;
        ctx.fillStyle = categoryColor(p.cells.cat[i], 0.9);
        ctx.fillRect(X(x), Y(y + h), Math.max(0.8, w * v.scale), Math.max(0.8, h * v.scale));
      }
    }
  }

  // ── macros: halo, fill, edge, label ─────────────────────────────────────
  for (const macro of p.macros) {
    if (macro.status === "UNPLACED") continue;
    const sx = X(macro.x);
    const sy = Y(macro.y + macro.h);
    const sw = macro.w * v.scale;
    const sh = macro.h * v.scale;
    if (opts.showHalos && opts.haloDbu > 0) {
      const hp = opts.haloDbu * v.scale;
      ctx.fillStyle = CHIP.halo;
      ctx.fillRect(sx - hp, sy - hp, sw + 2 * hp, sh + 2 * hp);
    }
    ctx.fillStyle = CHIP.macroFill;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = CHIP.macroEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, sw, sh);
    if (sw > 26 && sh > 12) {
      ctx.fillStyle = CHIP.macroText;
      ctx.font = "9px var(--font-plex-mono), monospace";
      ctx.textBaseline = "middle";
      const label = macro.name.replace(/^macro_/, "M");
      ctx.fillText(label, sx + 3, sy + sh / 2, sw - 6);
    }
  }

  // ── fixed I/O pins on the boundary ──────────────────────────────────────
  ctx.fillStyle = CHIP.pin;
  for (const pin of sub.pins) {
    const sx = X(pin.x);
    const sy = Y(pin.y);
    ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
  }

  return { mode: usedMode };
}
