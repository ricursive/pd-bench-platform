import Link from "next/link";
import type { MetricSpec } from "@/lib/types";
import { effectiveWeights } from "@/lib/scoring";
import { fmtInt } from "@/lib/format";

/** Instrument readout: baseline reference values + effective weights + CTA. */
export function ReadoutPanel({ metrics, epsilon }: { metrics: MetricSpec[]; epsilon: number }) {
  const ref = Object.fromEntries(metrics.map((m) => [m.key, m.reference]));
  const weights = Object.fromEntries(metrics.map((m) => [m.key, m.weight]));
  let eff: Record<string, number> = {};
  let dropped: string[] = [];
  try {
    const r = effectiveWeights(weights, ref, epsilon);
    eff = r.eff;
    dropped = r.dropped;
  } catch {
    /* leave empty */
  }

  return (
    <div className="panel ticks flex flex-col">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between">
        <span className="label">reference</span>
        <span className="tnum text-[11px] text-ink-faint">baseline = 0</span>
      </div>

      <div className="px-4 py-3 flex-1">
        {metrics.map((m) => {
          const isDropped = dropped.includes(m.key) || m.reference < epsilon;
          return (
            <div key={m.key} className="flex items-baseline justify-between py-1.5 border-b border-line/50 last:border-0">
              <span className={`tnum text-xs ${isDropped ? "text-ink-faint line-through" : "text-ink-dim"}`}>{m.key}</span>
              <span className="text-right">
                <span className={`tnum text-sm ${isDropped ? "text-ink-faint" : "text-ink"}`}>
                  {isDropped ? "dropped" : fmtInt(m.reference)}
                </span>
                {!isDropped && eff[m.key] !== undefined && (
                  <span className="tnum text-[11px] text-amber ml-2">w {eff[m.key].toFixed(2)}</span>
                )}
              </span>
            </div>
          );
        })}
        <p className="text-[11px] text-ink-faint mt-2 leading-relaxed">
          Score = weighted % improvement over baseline; lower is better. Congestion drops (ref ≈ 0).
        </p>
      </div>

      <Link
        href="/launch"
        className="m-4 mt-0 px-4 py-2.5 bg-amber text-base text-sm font-medium text-center hover:bg-amber/90 transition-colors"
      >
        Launch your agent →
      </Link>
    </div>
  );
}
