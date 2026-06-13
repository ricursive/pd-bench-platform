/** EDA color language for the chip view — kept distinct from the UI chrome. */

export const CHIP = {
  bg: "#080a0d",
  die: "#3a434f",
  rows: "rgba(255,255,255,0.018)",
  tracks: "rgba(56,225,200,0.05)",
  pin: "#38e1c8",
  macroFill: "rgba(245,177,76,0.10)",
  macroEdge: "#f5b14c",
  macroText: "#f5d9a6",
  halo: "rgba(245,177,76,0.22)",
  cell: "#3b6ea5",
};

/** Turbo-ish ramp for placement density (cool → hot), input t in [0,1]. */
export function densityColor(t: number): [number, number, number] {
  const stops: [number, number[]][] = [
    [0.0, [13, 18, 30]],
    [0.25, [27, 64, 120]],
    [0.5, [38, 152, 180]],
    [0.7, [120, 200, 120]],
    [0.85, [240, 200, 70]],
    [1.0, [240, 90, 70]],
  ];
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const f = (t - t0) / (t1 - t0 || 1);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return [240, 90, 70];
}

export function densityCss(t: number, alpha = 1): string {
  const [r, g, b] = densityColor(t);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Distinct hues for std-cell categories when drawn individually (zoomed in). */
const CAT_HUES = [205, 165, 45, 280, 130, 20, 320, 95];
export function categoryColor(cat: number, alpha = 0.85): string {
  const hue = CAT_HUES[cat % CAT_HUES.length];
  return `hsla(${hue}, 55%, 60%, ${alpha})`;
}
