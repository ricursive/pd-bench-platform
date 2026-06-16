"use client";

import { getExperiment, type ArmData, type Experiment } from "@/lib/experiments";
import { useAsync } from "@/lib/useAsync";
import { PhaseScrubber } from "@/components/PhaseScrubber";

export default function ExperimentsPage() {
  const { data: exp, loading } = useAsync(getExperiment, []);
  if (loading) return <div className="panel h-96 animate-pulse" />;
  if (!exp)
    return (
      <div className="panel ticks p-8 text-center text-ink-faint label">
        no experiment results yet — run experiments/ab_feedback
      </div>
    );

  const { control, treatment } = exp.arms;
  const max = Math.max(...control.scores, ...treatment.scores, 1);

  return (
    <div className="space-y-8">
      {/* header */}
      <header>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="label">A/B experiment</span>
          {exp.preview && (
            <span className="tnum text-[10px] px-1.5 py-0.5 border border-warn/50 text-warn">
              PREVIEW · illustrative until live run
            </span>
          )}
        </div>
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.02em]">{exp.title}</h1>
        <p className="text-ink-dim mt-2 max-w-3xl text-[15px] leading-relaxed">{exp.hypothesis}</p>
        <p className="text-[11px] text-ink-faint mt-2 max-w-3xl">
          {exp.agent} · {exp.model} · {exp.task}. {exp.note}
        </p>
      </header>

      {/* headline numbers */}
      <section className="grid sm:grid-cols-3 gap-px bg-line border border-line">
        <Big k="control mean" v={control.mean.toFixed(2)} sub="raw DEF (open loop)" />
        <Big k="treatment mean" v={treatment.mean.toFixed(2)} sub="pd (closed loop)" accent />
        <Big
          k="lift"
          v={`${exp.comparison.delta_mean >= 0 ? "+" : ""}${exp.comparison.delta_mean.toFixed(2)}`}
          sub={`Mann-Whitney p≈${exp.comparison.mannwhitney_p_approx.toFixed(3)}`}
          accent
        />
      </section>

      {/* distributions */}
      <section className="grid md:grid-cols-2 gap-6">
        <ArmCard arm={control} max={max} tone="dim" />
        <ArmCard arm={treatment} max={max} tone="amber" />
      </section>

      {/* trace comparison */}
      <section>
        <div className="label mb-1">trace comparison · {exp.agent}</div>
        <p className="text-[12px] text-ink-faint mb-3">
          Left: today&apos;s run — a final DEF, nothing to inspect mid-flight. Right: the same agent with the
          legible <code className="tnum text-cyan">.pd</code> history it could read and diff while iterating.
        </p>
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <div className="label mb-2 !text-ink-dim">{control.label}</div>
            <PhaseScrubber phases={[]} finalDef={control.trace.placementDef ?? null} lef={control.trace.lef} />
            <p className="text-[11px] text-ink-faint mt-2">{control.trace.note}</p>
          </div>
          <div>
            <div className="label mb-2 !text-amber">{treatment.label}</div>
            <PhaseScrubber phases={treatment.trace.phases ?? []} lef={treatment.trace.lef} />
            <p className="text-[11px] text-ink-faint mt-2">{treatment.trace.note}</p>
          </div>
        </div>
      </section>

      <p className="text-[11px] text-ink-faint border-t border-line pt-4">
        Control is anchored to the real codex result on the leaderboard (score{" "}
        {exp.anchor.real_control_score}, valid {exp.anchor.real_control_valid}). When the gated live run
        lands, this page renders its <code className="tnum">report.json</code> in place — same view, real numbers.
      </p>
    </div>
  );
}

function Big({ k, v, sub, accent }: { k: string; v: string; sub: string; accent?: boolean }) {
  return (
    <div className="bg-panel p-4">
      <div className="label">{k}</div>
      <div className={`font-display font-extrabold text-3xl tnum mt-1 ${accent ? "text-amber" : "text-ink"}`}>{v}</div>
      <div className="text-[11px] text-ink-faint mt-0.5">{sub}</div>
    </div>
  );
}

function ArmCard({ arm, max, tone }: { arm: ArmData; max: number; tone: "dim" | "amber" }) {
  const color = tone === "amber" ? "bg-amber" : "bg-ink-faint";
  return (
    <div className="panel ticks p-4">
      <div className={`text-sm ${tone === "amber" ? "text-amber" : "text-ink"}`}>{arm.label}</div>
      <div className="text-[12px] text-ink-faint mt-0.5 mb-3 leading-relaxed">{arm.blurb}</div>
      {/* per-seed distribution */}
      <div className="flex items-end gap-1 h-20 border-b border-line/60">
        {arm.scores.map((s, i) => (
          <div
            key={i}
            className={`flex-1 ${color} ${s === 0 ? "opacity-30" : ""}`}
            style={{ height: `${Math.max(2, (s / max) * 100)}%` }}
            title={`seed ${i}: ${s.toFixed(2)}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
        <Stat k="mean±std" v={`${arm.mean.toFixed(2)}±${arm.std.toFixed(1)}`} />
        <Stat k="valid" v={`${Math.round(arm.valid_rate * 100)}%`} />
        <Stat k="pass@1" v={`${Math.round(arm.pass_at_1 * 100)}%`} />
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="label">{k}</div>
      <div className="tnum text-ink mt-0.5">{v}</div>
    </div>
  );
}
