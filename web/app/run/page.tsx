"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getRun } from "@/lib/api";
import { TASK } from "@/lib/seed";
import { useAsync } from "@/lib/useAsync";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { GatesPanel } from "@/components/GatesPanel";
import { PhaseScrubber } from "@/components/PhaseScrubber";
import { fmtScore } from "@/lib/format";

export default function RunPage() {
  return (
    <Suspense fallback={<div className="panel h-96 animate-pulse" />}>
      <RunInner />
    </Suspense>
  );
}

function RunInner() {
  const id = useSearchParams().get("id") ?? "";
  const { data: run, loading } = useAsync(() => getRun(id), [id]);

  if (loading) return <div className="panel h-96 animate-pulse" />;
  if (!run)
    return (
      <div className="panel ticks p-8 text-center">
        <div className="label mb-2">run not found</div>
        <Link href="/leaderboard" className="text-amber">← back to leaderboard</Link>
      </div>
    );

  const live = run.status !== "done" && run.status !== "error";

  return (
    <div className="space-y-7">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/leaderboard" className="label hover:!text-amber transition-colors">← leaderboard</Link>
          <h1 className="font-display font-extrabold text-3xl tracking-[-0.02em] mt-2">
            {run.agent} <span className="text-ink-faint">/</span>{" "}
            <span className="text-ink-dim text-2xl tnum">{run.model}</span>
          </h1>
          <div className="tnum text-xs text-ink-faint mt-1">
            {run.runId} · {run.date} · job {run.job}
          </div>
        </div>
        <div className="text-right">
          <div className="label">score</div>
          <div className="font-display font-extrabold text-4xl tnum text-amber leading-none mt-1">
            {run.valid ? fmtScore(run.score) : "0.00"}
          </div>
          <div className="mt-1">
            {run.status === "error" ? (
              <span className="label !text-bad">error</span>
            ) : live ? (
              <span className="label !text-cyan flex items-center gap-1.5 justify-end">
                <span className="live-dot w-1.5 h-1.5 rounded-full bg-cyan inline-block" />
                {run.status}
              </span>
            ) : (
              <span className={`label ${run.valid ? "!text-good" : "!text-bad"}`}>
                {run.valid ? "valid · scored" : "gate failed"}
              </span>
            )}
          </div>
        </div>
      </div>

      {run.error && (
        <div className="panel border-bad/40 p-4 text-sm text-bad">{run.error}</div>
      )}

      {/* placement viz + phases */}
      <section>
        <div className="label mb-3">placement · phase snapshots</div>
        <PhaseScrubber phases={run.phases} finalDef={run.placementDef} lef={run.lef} haloUm={TASK.haloUm} />
      </section>

      {/* scoring + gates */}
      <section className="grid lg:grid-cols-2 gap-6">
        <ScoreBreakdown metrics={TASK.metrics} reward={run.reward_json} epsilon={TASK.epsilon} />
        <GatesPanel gates={run.gates} valid={run.valid} />
      </section>

      {/* log tail */}
      {run.logTail && (
        <section>
          <div className="label mb-2">verifier log</div>
          <pre className="tnum text-[12px] bg-base border border-line p-4 overflow-x-auto text-ink-dim whitespace-pre-wrap">
            {run.logTail}
          </pre>
        </section>
      )}
    </div>
  );
}
