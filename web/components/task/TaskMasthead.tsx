import type { TaskDetail } from "@/lib/types";

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "text-good border-good/40",
  medium: "text-warn border-warn/40",
  hard: "text-bad border-bad/40",
};

export function TaskMasthead({ task }: { task: TaskDetail }) {
  const [org, name] = task.name.split("/");
  return (
    <header className="rise">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="label mb-2">{org} / task</div>
          <h1 className="font-display font-extrabold tracking-[-0.03em] leading-[0.95] text-3xl md:text-5xl break-words">
            {name}
          </h1>
          <p className="text-ink-dim mt-3 max-w-2xl text-[15px]">{task.description}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <span className={`label px-2 py-0.5 border ${DIFFICULTY_COLOR[task.difficulty] ?? ""}`}>
            {task.difficulty}
          </span>
          <span className="label px-2 py-0.5 border border-line-strong text-ink-dim">{task.status}</span>
        </div>
      </div>

      <hr className="rule mt-6" />
      <div className="ribbon flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
        <span>GPU <b>{task.resources.gpu}</b></span><Dot />
        <span><b>{task.resources.cpus}</b> cpu</span><Dot />
        <span><b>{task.resources.agentTimeoutSec / 3600}h</b> budget</span><Dot />
        <span><b>{task.metrics.filter((m) => m.reference >= task.epsilon).length}</b> scored metrics</span><Dot />
        <span><b>{task.gates.length}</b> hard gates</span><Dot />
        <span>clock <b>{task.clockPeriodPs} ps</b></span><Dot />
        <span>verifier <b>{task.resources.verifierMode}</b></span>
      </div>
      <hr className="rule" />
    </header>
  );
}

function Dot() {
  return <span className="text-ink-faint">·</span>;
}
