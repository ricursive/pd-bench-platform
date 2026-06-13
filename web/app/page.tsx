"use client";

import Link from "next/link";
import { getLeaderboard } from "@/lib/api";
import { TASK } from "@/lib/seed";
import { useAsync } from "@/lib/useAsync";
import { Leaderboard } from "@/components/Leaderboard";

export default function Home() {
  const { data: runs } = useAsync(getLeaderboard, []);

  return (
    <div className="space-y-12">
      {/* hero */}
      <section className="rise">
        <div className="label mb-3">physical-design benchmark · v0.1</div>
        <h1 className="font-display font-extrabold tracking-[-0.03em] leading-[0.95] text-4xl md:text-6xl max-w-4xl">
          Evaluating AI agents on
          <br />
          <span className="text-amber">chip physical design.</span>
        </h1>
        <p className="text-ink-dim max-w-2xl mt-5 text-[15px] leading-relaxed">
          PD-Bench gives an agent a real VLSI problem inside a GPU sandbox — OpenROAD, CUDA, and
          GPU placers — and grades the artifact it produces against a frozen baseline. Hard gates,
          normalized scoring, a separate no-network verifier. Launch a run, watch the placement
          evolve phase by phase, and compare on the leaderboard.
        </p>
        <div className="flex flex-wrap gap-3 mt-7">
          <Link
            href="/launch"
            className="px-4 py-2.5 bg-amber text-base font-medium hover:bg-amber/90 transition-colors"
          >
            Launch an agent →
          </Link>
          <Link
            href={`/tasks/${TASK.id}`}
            className="px-4 py-2.5 border border-line-strong text-ink hover:border-amber/50 hover:text-amber transition-colors"
          >
            Explore the task
          </Link>
        </div>
      </section>

      {/* pipeline strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line">
        {[
          ["01", "Sandbox", "Agent runs in a GPU container — OpenROAD + CUDA + DREAMPlace/Xplace, full network, task-timeout budget."],
          ["02", "Artifact", "It writes one placed DEF to /logs/artifacts — every component placed on the fixed floorplan."],
          ["03", "Verify", "A separate no-network verifier runs hard gates, then one OpenROAD measurement pass."],
          ["04", "Score", "Weighted % improvement over the baseline flow. Gate failure = reward 0."],
        ].map(([n, t, d]) => (
          <div key={n} className="bg-panel p-4">
            <div className="tnum text-amber text-xs mb-2">{n}</div>
            <div className="font-display font-semibold text-sm mb-1.5">{t}</div>
            <div className="text-[11px] text-ink-faint leading-relaxed">{d}</div>
          </div>
        ))}
      </section>

      {/* task + leaderboard */}
      <section className="grid lg:grid-cols-[340px_1fr] gap-6">
        <Link href={`/tasks/${TASK.id}`} className="panel ticks p-5 block hover:border-line-strong transition-colors group">
          <div className="flex items-center justify-between">
            <span className="label">task</span>
            <span className="label !text-amber border border-amber/30 px-1.5 py-0.5">{TASK.difficulty}</span>
          </div>
          <h3 className="font-display font-bold text-lg mt-3 group-hover:text-amber transition-colors">
            ariane133 · asap7
          </h3>
          <p className="text-ink-dim text-sm mt-1.5 leading-relaxed">{TASK.description}</p>
          <dl className="grid grid-cols-2 gap-2 mt-4 text-xs">
            <Stat k="GPU" v={TASK.resources.gpu} />
            <Stat k="budget" v={`${TASK.resources.agentTimeoutSec / 3600}h`} />
            <Stat k="metrics" v={`${TASK.metrics.length}`} />
            <Stat k="gates" v={`${TASK.gates.length}`} />
          </dl>
        </Link>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="label">leaderboard · {TASK.id}</h2>
            <Link href="/leaderboard" className="label hover:!text-amber transition-colors">
              full board →
            </Link>
          </div>
          {runs ? <Leaderboard runs={runs} /> : <Skeleton />}
        </div>
      </section>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="label">{k}</dt>
      <dd className="tnum text-ink mt-0.5">{v}</dd>
    </div>
  );
}

function Skeleton() {
  return <div className="panel h-48 animate-pulse" />;
}
