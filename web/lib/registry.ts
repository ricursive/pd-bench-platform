import type { PreviewEntry } from "./types";

/**
 * Per-task preview registry. Generated platform-side from each task's
 * oracle/baseline run (see scripts/make_preview — gated on a real run); the
 * committed index.json currently carries a synthetic ariane133 entry.
 */
const FALLBACK: PreviewEntry[] = [
  {
    task: "ariane133-asap7-mixed-placement",
    org: "ricursive",
    name: "ariane133 · asap7",
    difficulty: "easy",
    blurb: "Mixed-size placement — 133 SRAM macros + ~100K std cells.",
    status: "live",
    gif: "/prerender/ariane133/solution.gif",
    poster: "/prerender/ariane133/solution.png",
    refMetrics: [
      { label: "HPWL", value: "781,044,057" },
      { label: "gates", value: "4" },
    ],
    synthetic: true,
  },
];

export async function getPreviews(): Promise<PreviewEntry[]> {
  try {
    const res = await fetch("/prerender/index.json", { cache: "no-cache" });
    if (res.ok) return (await res.json()) as PreviewEntry[];
  } catch {
    /* static demo / offline → fallback */
  }
  return FALLBACK;
}

export async function getPreview(taskId: string): Promise<PreviewEntry | null> {
  return (await getPreviews()).find((p) => p.task === taskId) ?? null;
}
