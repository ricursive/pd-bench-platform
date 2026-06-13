import type { DieArea } from "@/lib/def/types";

/**
 * Pure viewport math for the placement renderer (no canvas/DOM).
 *
 * World space = DEF integer DBU, y-up (chip convention). Screen space =
 * CSS pixels, y-down. A View is a center (world) + scale (px per dbu).
 */
export interface View {
  cx: number; // world center x (dbu)
  cy: number; // world center y (dbu)
  scale: number; // screen px per dbu
  w: number; // viewport px width
  h: number; // viewport px height
}

/** Scale + center that fits `die` into a w×h viewport with fractional padding. */
export function fitView(die: DieArea, w: number, h: number, pad = 0.06): View {
  const dieW = Math.max(1, die.x1 - die.x0);
  const dieH = Math.max(1, die.y1 - die.y0);
  const scale = Math.min(w / dieW, h / dieH) * (1 - pad * 2);
  return {
    cx: (die.x0 + die.x1) / 2,
    cy: (die.y0 + die.y1) / 2,
    scale,
    w,
    h,
  };
}

export function worldToScreenX(x: number, v: View): number {
  return (x - v.cx) * v.scale + v.w / 2;
}
export function worldToScreenY(y: number, v: View): number {
  return v.h / 2 - (y - v.cy) * v.scale; // y flip
}
export function screenToWorldX(px: number, v: View): number {
  return (px - v.w / 2) / v.scale + v.cx;
}
export function screenToWorldY(py: number, v: View): number {
  return (v.h / 2 - py) / v.scale + v.cy;
}

/** Zoom by `factor` keeping the world point under (px,py) fixed on screen. */
export function zoomAt(v: View, px: number, py: number, factor: number, scaleLimits = [1e-7, 0.05]): View {
  const wx = screenToWorldX(px, v);
  const wy = screenToWorldY(py, v);
  const scale = Math.min(scaleLimits[1], Math.max(scaleLimits[0], v.scale * factor));
  // solve new center so (wx,wy) maps back to (px,py)
  const cx = wx - (px - v.w / 2) / scale;
  const cy = wy - (v.h / 2 - py) / scale;
  return { ...v, scale, cx, cy };
}

/** Pan by a screen-pixel delta. */
export function pan(v: View, dxPx: number, dyPx: number): View {
  return { ...v, cx: v.cx - dxPx / v.scale, cy: v.cy + dyPx / v.scale };
}

/**
 * Below this on-screen cell width (px) individual cells are imperceptible and
 * we switch to a density heatmap. avgCellW is in dbu.
 */
export const LOD_CELL_PX = 2.2;
export function shouldHeatmap(avgCellWidthDbu: number, scale: number): boolean {
  return avgCellWidthDbu * scale < LOD_CELL_PX;
}

/** World-space rect currently visible (for viewport culling). */
export function visibleWorldRect(v: View): { x0: number; y0: number; x1: number; y1: number } {
  return {
    x0: screenToWorldX(0, v),
    y0: screenToWorldY(v.h, v),
    x1: screenToWorldX(v.w, v),
    y1: screenToWorldY(0, v),
  };
}

export interface DensityGrid {
  nx: number;
  ny: number;
  /** occupied area fraction per bin, normalized to its own max (0..1). */
  values: Float32Array;
  max: number; // raw max area before normalization
}

/**
 * Accumulate std-cell area into an nx×ny grid over the die — the canonical
 * placement-density field. Operates on the parallel typed arrays.
 */
export function binDensity(
  die: DieArea,
  cells: { x: Int32Array; y: Int32Array; w: Int32Array; h: Int32Array; count: number },
  nx: number,
  ny: number,
): DensityGrid {
  const values = new Float32Array(nx * ny);
  const dieW = Math.max(1, die.x1 - die.x0);
  const dieH = Math.max(1, die.y1 - die.y0);
  const binArea = (dieW / nx) * (dieH / ny);
  for (let i = 0; i < cells.count; i++) {
    const cxw = cells.x[i] + cells.w[i] / 2;
    const cyw = cells.y[i] + cells.h[i] / 2;
    let bx = Math.floor(((cxw - die.x0) / dieW) * nx);
    let by = Math.floor(((cyw - die.y0) / dieH) * ny);
    if (bx < 0 || bx >= nx || by < 0 || by >= ny) continue;
    values[by * nx + bx] += cells.w[i] * cells.h[i];
  }
  let max = 0;
  for (let i = 0; i < values.length; i++) max = Math.max(max, values[i]);
  if (max > 0) for (let i = 0; i < values.length; i++) values[i] = values[i] / max;
  return { nx, ny, values, max: max / binArea };
}
