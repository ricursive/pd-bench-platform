import Link from "next/link";
import type { RunSummary } from "@/lib/types";
import { fmtInt, fmtScore } from "@/lib/format";

export function Leaderboard({ runs }: { runs: RunSummary[] }) {
  const ranked = [...runs].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
  return (
    <div className="panel ticks overflow-x-auto">
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className="label border-b border-line-strong">
            <th className="text-left font-normal px-4 py-2.5 w-10">#</th>
            <th className="text-left font-normal">agent</th>
            <th className="text-left font-normal">model</th>
            <th className="text-right font-normal">score</th>
            <th className="text-center font-normal">valid</th>
            <th className="text-right font-normal">HPWL</th>
            <th className="text-right font-normal">TNS viol</th>
            <th className="text-right font-normal">WNS viol</th>
            <th className="text-left font-normal pl-4">job</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r, i) => (
            <tr key={r.runId} className="border-b border-line/60 hover:bg-amber/[0.03] transition-colors group">
              <td className="px-4 py-2.5 tnum text-ink-faint">{i + 1}</td>
              <td className="py-2.5">
                <Link href={`/run?id=${r.runId}`} className="text-ink group-hover:text-amber transition-colors">
                  {r.agent}
                </Link>
              </td>
              <td className="text-ink-dim tnum text-xs">{r.model}</td>
              <td className="text-right tnum font-semibold text-ink">{fmtScore(r.score)}</td>
              <td className="text-center">
                <span className={`tnum text-xs px-1.5 py-0.5 ${r.valid ? "text-good" : "text-bad"}`}>
                  {r.valid}
                </span>
              </td>
              <td className="text-right tnum text-ink-dim">{r.valid ? fmtInt(metric(r, "m_hpwl")) : "—"}</td>
              <td className="text-right tnum text-ink-dim">{r.valid ? fmtInt(metric(r, "m_tns_viol")) : "—"}</td>
              <td className="text-right tnum text-ink-dim">{r.valid ? fmtInt(metric(r, "m_wns_viol")) : "—"}</td>
              <td className="pl-4 tnum text-xs text-ink-faint">{r.job}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// summaries don't carry raw metrics; the run detail does. The seed leaderboard
// is small, so we read metrics off the summary when present.
function metric(r: RunSummary, key: string): number | undefined {
  return (r as unknown as Record<string, number>)[key];
}
