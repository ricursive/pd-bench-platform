"use client";

import Link from "next/link";
import { getTask, getLeaderboard } from "@/lib/api";
import { getPreview } from "@/lib/registry";
import { useAsync } from "@/lib/useAsync";
import { SAMPLE_SOLUTION, PHASES } from "@/lib/seed";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { Leaderboard } from "@/components/Leaderboard";
import { Markdown } from "@/components/Markdown";
import { TaskMasthead } from "@/components/task/TaskMasthead";
import { ReadoutPanel } from "@/components/task/ReadoutPanel";
import { PreviewHero } from "@/components/task/PreviewHero";
import { ContentsRail } from "@/components/task/ContentsRail";
import { SpecSection } from "@/components/task/SpecSection";
import { InputsTable } from "@/components/task/InputsTable";

const CONTENTS = [
  { id: "objective", label: "Objective" },
  { id: "inputs", label: "Inputs" },
  { id: "gates", label: "Hard gates" },
  { id: "scoring", label: "Scoring" },
  { id: "reproduce", label: "Reproduce" },
  { id: "spec", label: "Full spec" },
  { id: "results", label: "Results" },
];

export function TaskClient({ id }: { id: string }) {
  const { data: task, loading } = useAsync(() => getTask(id), [id]);
  const { data: preview } = useAsync(() => getPreview(id), [id]);
  const { data: runs } = useAsync(getLeaderboard, []);

  if (loading || !task) return <div className="panel h-96 animate-pulse" />;

  const taskRuns = (runs ?? []).filter((r) => r.task === task.id).slice(0, 3);

  return (
    <div className="space-y-8">
      <TaskMasthead task={task} />

      {/* hero: chip screen + reference readout */}
      <section className="grid lg:grid-cols-[1.7fr_1fr] gap-6 items-start">
        <PreviewHero
          preview={preview ?? null}
          fallbackGif={SAMPLE_SOLUTION.gif}
          fallbackPoster={SAMPLE_SOLUTION.poster}
          phases={PHASES}
          lef={task.lef ?? SAMPLE_SOLUTION.lef}
          haloUm={task.haloUm}
        />
        <ReadoutPanel metrics={task.metrics} epsilon={task.epsilon} />
      </section>

      {/* body: contents rail + structured sections */}
      <div className="grid lg:grid-cols-[180px_1fr] gap-8">
        <ContentsRail items={CONTENTS} launchHref="/launch" />

        <div className="min-w-0 divide-y divide-line/0">
          <SpecSection n={1} id="objective" title="OBJECTIVE">
            <p>{task.objective}</p>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {task.keywords.map((k) => (
                <span key={k} className="label border border-line px-1.5 py-0.5">{k}</span>
              ))}
            </div>
          </SpecSection>

          <SpecSection n={2} id="inputs" title="INPUTS">
            <p className="mb-3">Read-only, baked into the agent image at <code className="tnum text-cyan">/task/inputs/</code>.</p>
            <InputsTable inputs={task.inputs} />
          </SpecSection>

          <SpecSection n={3} id="gates" title="HARD GATES" action={<span className="label !text-bad">any failure → 0</span>}>
            <ul>
              {task.gates.map((g) => (
                <li key={g.id} className="flex gap-3 py-2.5 border-b border-line/60 last:border-0">
                  <span className="tnum text-amber shrink-0">{String(g.id).padStart(2, "0")}</span>
                  <div>
                    <div className="text-ink text-[14px]">{g.title}</div>
                    <div className="text-[12px] text-ink-faint mt-0.5">{g.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </SpecSection>

          <SpecSection n={4} id="scoring" title="SCORING">
            <ScoreBreakdown metrics={task.metrics} reward={null} epsilon={task.epsilon} />
          </SpecSection>

          <SpecSection n={5} id="reproduce" title="REPRODUCE">
            <p className="mb-3">The verifier&apos;s measurement pass is fully specified — replicate it with the installed OpenROAD:</p>
            <pre className="tnum text-[12.5px] bg-base border border-line p-4 overflow-x-auto text-ink-dim whitespace-pre-wrap">
              {task.reproduce}
            </pre>
          </SpecSection>

          <SpecSection n={6} id="spec" title="FULL SPEC">
            {task.instruction ? (
              <details className="group">
                <summary className="cursor-pointer label hover:!text-amber transition-colors list-none flex items-center gap-2">
                  <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
                  read the full instruction.md
                </summary>
                <div className="panel ticks p-6 mt-3">
                  <Markdown>{task.instruction}</Markdown>
                </div>
              </details>
            ) : (
              <p className="text-ink-faint">instruction unavailable.</p>
            )}
          </SpecSection>

          <SpecSection
            n={7}
            id="results"
            title="RESULTS"
            action={<Link href="/leaderboard" className="label hover:!text-amber transition-colors">full board →</Link>}
          >
            {taskRuns.length ? <Leaderboard runs={taskRuns} /> : <p className="text-ink-faint">no runs yet.</p>}
          </SpecSection>
        </div>
      </div>
    </div>
  );
}
