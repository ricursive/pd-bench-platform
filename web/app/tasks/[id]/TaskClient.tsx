"use client";

import Link from "next/link";
import { getTask } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { PhaseScrubber } from "@/components/PhaseScrubber";
import { Markdown } from "@/components/Markdown";
import { fmtInt } from "@/lib/format";

export function TaskClient({ id }: { id: string }) {
  const { data: task, loading } = useAsync(() => getTask(id), [id]);

  if (loading || !task) return <div className="panel h-96 animate-pulse" />;

  return (
    <div className="space-y-8">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="label mb-1">task · {task.status}</div>
          <h1 className="font-display font-extrabold text-3xl tracking-[-0.02em]">{task.name}</h1>
          <p className="text-ink-dim mt-2 max-w-2xl">{task.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {task.keywords.map((k) => (
              <span key={k} className="label border border-line px-1.5 py-0.5">{k}</span>
            ))}
          </div>
        </div>
        <Link href="/launch" className="px-4 py-2.5 bg-amber text-base font-medium hover:bg-amber/90 transition-colors whitespace-nowrap">
          Launch on this task →
        </Link>
      </div>

      {/* resources */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-line border border-line">
        <Res k="difficulty" v={task.difficulty} accent />
        <Res k="GPU" v={task.resources.gpu} />
        <Res k="agent budget" v={`${task.resources.agentTimeoutSec / 3600}h`} />
        <Res k="verifier" v={task.resources.verifierMode} />
        <Res k="clock" v={`${task.clockPeriodPs} ps`} />
      </div>

      {/* floorplan viz */}
      <section>
        <div className="label mb-3">input floorplan · phase 0</div>
        <PhaseScrubber phases={[]} finalDef={task.floorplanDef} lef={task.lef} haloUm={task.haloUm} />
      </section>

      {/* scoring + gates */}
      <section className="grid lg:grid-cols-2 gap-6">
        <ScoreBreakdown metrics={task.metrics} reward={null} epsilon={task.epsilon} />
        <div className="panel ticks">
          <div className="px-4 py-3 border-b border-line label">Hard gates · any failure scores 0</div>
          <ul className="px-4 py-2">
            {task.gates.map((g) => (
              <li key={g.id} className="flex gap-3 py-2 border-b border-line/60 last:border-0">
                <span className="tnum text-amber">{String(g.id).padStart(2, "0")}</span>
                <div>
                  <div className="text-sm text-ink">{g.title}</div>
                  <div className="text-[11px] text-ink-faint mt-0.5 leading-relaxed">{g.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* instruction.md */}
      {task.instruction && (
        <section>
          <div className="label mb-3">instruction.md — exactly what the agent sees</div>
          <div className="panel ticks p-6">
            <Markdown>{task.instruction}</Markdown>
          </div>
        </section>
      )}

      <p className="text-[11px] text-ink-faint">
        Reference values frozen 2026-06-12 · HPWL {fmtInt(task.metrics[0].reference)} dbu · provenance in the task README.
      </p>
    </div>
  );
}

function Res({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="bg-panel p-3">
      <div className="label">{k}</div>
      <div className={`tnum text-sm mt-1 ${accent ? "text-amber" : "text-ink"}`}>{v}</div>
    </div>
  );
}
