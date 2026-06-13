import Link from "next/link";
import type { RunSummary } from "@/lib/types";
import { fmtScore } from "@/lib/format";

export function RunCard({ run }: { run: RunSummary }) {
  return (
    <Link
      href={`/run?id=${run.runId}`}
      className="panel ticks p-4 block hover:border-line-strong transition-colors group"
    >
      <div className="flex items-center justify-between">
        <span className="text-ink group-hover:text-amber transition-colors">{run.agent}</span>
        <StatusChip run={run} />
      </div>
      <div className="tnum text-xs text-ink-faint mt-0.5">{run.model}</div>
      <div className="flex items-end justify-between mt-3">
        <div>
          <div className="label">score</div>
          <div className="font-display font-bold text-xl tnum text-ink">{fmtScore(run.score)}</div>
        </div>
        <div className="tnum text-xs text-ink-faint text-right">
          {run.date}
          <br />
          {run.job}
        </div>
      </div>
    </Link>
  );
}

function StatusChip({ run }: { run: RunSummary }) {
  if (run.status !== "done") {
    const live = run.status === "running" || run.status === "grading" || run.status === "queued";
    return (
      <span className="flex items-center gap-1.5 label !text-cyan">
        {live && <span className="live-dot w-1.5 h-1.5 rounded-full bg-cyan inline-block" />}
        {run.status}
      </span>
    );
  }
  return (
    <span className={`label ${run.valid ? "!text-good" : "!text-bad"}`}>
      {run.valid ? "valid" : "gate fail"}
    </span>
  );
}
