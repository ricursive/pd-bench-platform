/**
 * Prerender the sample-solution placement (floorplan → global → legalize →
 * detailed) into a looping GIF + a poster PNG, served as static assets so the
 * task page costs nothing to display (no client DEF parse / live canvas).
 *
 * This is a VISUALIZATION-ONLY sample solution. It is generated from
 * fixtures/ (platform data) and lives under web/public — it is never part of
 * the task image the agent sees.
 *
 *   npx tsx scripts/prerender.mts
 */
import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc as unknown as {
  GIFEncoder: () => { writeFrame: (i: Uint8Array, w: number, h: number, o: object) => void; finish: () => void; bytes: () => Uint8Array };
  quantize: (rgba: Uint8Array, n: number) => number[][];
  applyPalette: (rgba: Uint8Array, palette: number[][]) => Uint8Array;
};
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { parseDef } from "../lib/def/parse.ts";
import { parseLefMacros } from "../lib/def/lef.ts";
import { fitView, worldToScreenX, worldToScreenY, type View } from "../lib/render/view.ts";
import { densityColor, CHIP } from "../lib/render/palette.ts";
import type { PlacementPayload } from "../lib/def/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(here, "../../fixtures/ariane133");
const OUT = resolve(here, "../public/prerender/ariane133");
mkdirSync(OUT, { recursive: true });

const sizes = parseLefMacros(readFileSync(resolve(FIX, "cells.lef"), "utf8"));
const load = (p: string) => parseDef(readFileSync(resolve(FIX, p), "utf8"), sizes);
const gp = load("phases/10_global_place.def");
const lg = load("phases/20_legalize.def");
const dp = load("phases/30_detailed.def");

const NX = 150;
const NY = 150;

/** Per-bin cell COUNT (uniform weight) — stable, flicker-free across frames. */
function binCounts(cx: ArrayLike<number>, cy: ArrayLike<number>, n: number): Float64Array {
  const { die } = dp.substrate;
  const dieW = die.x1 - die.x0;
  const dieH = die.y1 - die.y0;
  const acc = new Float64Array(NX * NY);
  for (let i = 0; i < n; i++) {
    const bx = Math.floor(((cx[i] - die.x0) / dieW) * NX);
    const by = Math.floor(((cy[i] - die.y0) / dieH) * NY);
    if (bx < 0 || bx >= NX || by < 0 || by >= NY) continue;
    acc[by * NX + bx] += 1;
  }
  return acc;
}
const DENOM = Math.max(1, ...binCounts(dp.cells.x, dp.cells.y, dp.cells.count));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Frame {
  cx: Int32Array;
  cy: Int32Array;
  showMacros: boolean;
}

function interp(a: PlacementPayload, b: PlacementPayload, t: number): Frame {
  const n = a.cells.count;
  const cx = new Int32Array(n);
  const cy = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    cx[i] = lerp(a.cells.x[i], b.cells.x[i], t);
    cy[i] = lerp(a.cells.y[i], b.cells.y[i], t);
  }
  return { cx, cy, showMacros: true };
}
const EMPTY: Frame = { cx: new Int32Array(0), cy: new Int32Array(0), showMacros: false };

function renderFrame(ctx: SKRSContext2D, view: View, f: Frame) {
  const sub = dp.substrate;
  const X = (x: number) => worldToScreenX(x, view);
  const Y = (y: number) => worldToScreenY(y, view);

  ctx.fillStyle = CHIP.bg;
  ctx.fillRect(0, 0, view.w, view.h);

  const dwPx = (sub.die.x1 - sub.die.x0) * view.scale;
  const dhPx = (sub.die.y1 - sub.die.y0) * view.scale;
  ctx.strokeStyle = CHIP.die;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(X(sub.die.x0), Y(sub.die.y1), dwPx, dhPx);

  if (f.cx.length) {
    const dieW = sub.die.x1 - sub.die.x0;
    const dieH = sub.die.y1 - sub.die.y0;
    const acc = binCounts(f.cx, f.cy, f.cx.length);
    const bw = (dieW / NX) * view.scale + 1;
    const bh = (dieH / NY) * view.scale + 1;
    for (let by = 0; by < NY; by++) {
      for (let bx = 0; bx < NX; bx++) {
        const t = Math.min(1, acc[by * NX + bx] / DENOM);
        if (t < 0.01) continue;
        const wx = sub.die.x0 + (bx / NX) * dieW;
        const wy = sub.die.y0 + ((by + 1) / NY) * dieH;
        const [r, g, b] = densityColor(Math.pow(t, 0.6));
        ctx.fillStyle = `rgba(${r},${g},${b},0.95)`;
        ctx.fillRect(X(wx), Y(wy), bw, bh);
      }
    }
  }

  if (f.showMacros) {
    for (const m of dp.macros) {
      const sx = X(m.x);
      const sy = Y(m.y + m.h);
      ctx.fillStyle = CHIP.macroFill;
      ctx.fillRect(sx, sy, m.w * view.scale, m.h * view.scale);
      ctx.strokeStyle = CHIP.macroEdge;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(sx, sy, m.w * view.scale, m.h * view.scale);
    }
  }

  ctx.fillStyle = CHIP.pin;
  for (const p of sub.pins) ctx.fillRect(X(p.x) - 1.5, Y(p.y) - 1.5, 3, 3);
}

// ── timeline ────────────────────────────────────────────────────────────────
const W = 860;
const H = 860;
const timeline: { f: Frame; delay: number }[] = [
  { f: EMPTY, delay: 900 },
  { f: interp(gp, gp, 0), delay: 700 },
  ...Array.from({ length: 8 }, (_, i) => ({ f: interp(gp, lg, (i + 1) / 8), delay: 90 })),
  { f: interp(lg, lg, 0), delay: 500 },
  ...Array.from({ length: 8 }, (_, i) => ({ f: interp(lg, dp, (i + 1) / 8), delay: 90 })),
  { f: interp(dp, dp, 0), delay: 1600 },
];

const view = fitView(dp.substrate.die, W, H, 0.05);
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");
const enc = GIFEncoder();
for (const { f, delay } of timeline) {
  renderFrame(ctx, view, f);
  const rgba = ctx.getImageData(0, 0, W, H).data as unknown as Uint8Array;
  const palette = quantize(rgba, 256);
  const index = applyPalette(rgba, palette);
  enc.writeFrame(index, W, H, { palette, delay });
}
enc.finish();
const gifBytes = Buffer.from(enc.bytes());
writeFileSync(resolve(OUT, "solution.gif"), gifBytes);

// crisp poster of the final placement at 2×
const PW = W * 2;
const poster = createCanvas(PW, PW);
renderFrame(poster.getContext("2d"), fitView(dp.substrate.die, PW, PW, 0.05), interp(dp, dp, 0));
writeFileSync(resolve(OUT, "solution.png"), poster.toBuffer("image/png"));

console.log(
  `prerendered ${timeline.length} frames → solution.gif (${Math.round(gifBytes.length / 1024)} KB) + solution.png`,
);
