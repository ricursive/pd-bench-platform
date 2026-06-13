"use client";

import type { MetricSpec, RewardJson } from "@/lib/types";
import { compositeScore } from "@/lib/scoring";
import { fmtInt, fmtScore } from "@/lib/format";

interface Props {
  metrics: MetricSpec[];
  reward: RewardJson | null;
  epsilon: number;
}

/**
 * Transparent scoring panel: per-metric ref / measured / s = max((ref-m)/ref,0)
 * / effective weight, plus the weighted contribution to the composite score.
 * Mirrors the verifier's scoring.py exactly (see lib/scoring.ts).
 */
export function ScoreBreakdown({ metrics, reward, epsilon }: Props) {
  const ref = Object.fromEntries(metrics.map((m) => [m.key, m.reference]));
  const weights = Object.fromEntries(metrics.map((m) => [m.key, m.weight]));
  const measured = Object.fromEntries(
    metrics.map((m) => [m.key, reward?.[`m_${m.key}`] ?? m.reference]),
  );
  const hasMetrics = reward?.valid === 1 && reward?.m_hpwl !== undefined;

  let result: ReturnType<typeof compositeScore> | null = null;
  try {
    if (hasMetrics) result = compositeScore(measured, weights, ref, epsilon);
  } catch {
    result = null;
  }
  const dropped = new Set(result?.dropped ?? metrics.filter((m) => m.reference < epsilon).map((m) => m.key));

  return (
    <div className="panel ticks">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <span className="label">Score breakdown</span>
        <span className="tnum text-xs text-ink-faint">100 · Σ wₘ·sₘ</span>
      </div>

      <div className="px-4 py-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="label border-b border-line">
              <th className="text-left font-normal py-1.5">metric</th>
              <th className="text-right font-normal">reference</th>
              <th className="text-right font-normal">measured</th>
              <th className="text-right font-normal">sₘ</th>
              <th className="text-right font-normal">wₘ·</th>
              <th className="text-left font-normal pl-3 w-[34%]">contribution</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const isDropped = dropped.has(m.key);
              const eff = result?.effectiveWeights[m.key];
              const s = result?.subscores[m.key];
              const contrib = eff !== undefined && s !== undefined ? eff * s : 0;
              return (
                <tr
                  key={m.key}
                  className={`border-b border-line/60 ${isDropped ? "text-ink-faint" : ""}`}
                >
                  <td className={`py-2 tnum ${isDropped ? "line-through" : "text-ink"}`}>{m.key}</td>
                  <td className="text-right tnum text-ink-dim">{fmtInt(m.reference)}</td>
                  <td className="text-right tnum text-ink">{hasMetrics ? fmtInt(measured[m.key]) : "—"}</td>
                  <td className="text-right tnum">
                    {isDropped ? <span className="text-ink-faint">drop</span> : s !== undefined ? s.toFixed(3) : "—"}
                  </td>
                  <td className="text-right tnum text-ink-dim">
                    {eff !== undefined ? eff.toFixed(2) : `${m.weight.toFixed(2)}`}
                  </td>
                  <td className="pl-3">
                    {isDropped ? (
                      <span className="text-[11px] text-ink-faint">ref ≈ 0, dropped</span>
                    ) : (
                      <div className="h-2 bg-panel-2 relative">
                        <div
                          className="h-full bg-amber/80"
                          style={{ width: `${Math.min(100, contrib * 100)}%` }}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-line-strong">
          <span className="label">composite score</span>
          <span className="font-display font-bold text-2xl tnum text-amber">
            {hasMetrics ? fmtScore(result?.score ?? 0) : "—"}
          </span>
        </div>
        {dropped.size > 0 && (
          <p className="text-[11px] text-ink-faint mt-2 leading-relaxed">
            {[...dropped].join(", ")} dropped (baseline reference ≈ 0); remaining weights renormalize to
            hpwl ½, tns_viol ⅓, wns_viol ⅙.
          </p>
        )}
      </div>
    </div>
  );
}
