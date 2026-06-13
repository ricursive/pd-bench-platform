export function fmtInt(n: number | undefined | null): string {
  if (n === undefined || n === null) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export function fmtScore(n: number | undefined | null): string {
  if (n === undefined || n === null) return "—";
  return n.toFixed(2);
}

export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function fmtDuration(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}
