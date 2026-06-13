"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LIVE, launchRun } from "@/lib/api";
import { TASK } from "@/lib/seed";

const AGENTS: Record<string, { label: string; model: string; keyVar: string }> = {
  "claude-code": { label: "Claude Code", model: "claude-sonnet-4-6", keyVar: "ANTHROPIC_API_KEY" },
  codex: { label: "Codex", model: "gpt-5.3-codex", keyVar: "OPENAI_API_KEY" },
  custom: { label: "Custom (import-path)", model: "", keyVar: "AGENT_API_KEY" },
};

export default function LaunchPage() {
  const router = useRouter();
  const [agent, setAgent] = useState("claude-code");
  const [model, setModel] = useState(AGENTS["claude-code"].model);
  const [keyVar, setKeyVar] = useState(AGENTS["claude-code"].keyVar);
  const [agentKey, setAgentKey] = useState("");
  const [timeoutMult, setTimeoutMult] = useState(1);
  const [adminToken, setAdminToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pickAgent = (a: string) => {
    setAgent(a);
    setModel(AGENTS[a].model);
    setKeyVar(AGENTS[a].keyVar);
  };

  const command = useMemo(
    () =>
      [
        `harbor run -p tasks/${TASK.name}`,
        `  -a ${agent}${model ? ` -m ${model}` : ""}`,
        `  --ae '${keyVar}=\${${keyVar}}'`,
        timeoutMult !== 1 ? `  --agent-timeout-multiplier ${timeoutMult}` : null,
        `  -e modal --job-name pdbench-<id> -o jobs`,
      ]
        .filter(Boolean)
        .join(" \\\n"),
    [agent, model, keyVar, timeoutMult],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { runId } = await launchRun(
        { task: TASK.name, agent, model, agentKeyVar: keyVar, agentKey, timeoutMult },
        adminToken,
      );
      router.push(`/run?id=${runId}`);
    } catch (e2) {
      setErr(String((e2 as Error)?.message ?? e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="label mb-1">launch</div>
      <h1 className="font-display font-extrabold text-3xl tracking-[-0.02em]">Run an agent on PD-Bench</h1>
      <p className="text-ink-dim mt-2 max-w-2xl text-sm leading-relaxed">
        Launches your agent in a GPU sandbox on Modal and grades the DEF it produces. Your agent&apos;s
        LLM key is injected into harbor&apos;s <code className="tnum text-cyan">--ae</code> template for the
        run and never stored. Launching requires the admin token.
      </p>

      {!LIVE && (
        <div className="panel border-warn/40 mt-5 p-3 text-sm text-warn flex gap-2">
          <span>⚠</span>
          <span>
            Backend not connected (static demo). The form below previews the exact harbor command;
            set <code className="tnum">NEXT_PUBLIC_API_BASE</code> and deploy <code className="tnum">server/</code> to launch live.
          </span>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_minmax(0,420px)] gap-6 mt-6">
        <form onSubmit={submit} className="panel ticks p-5 space-y-5">
          <Field label="task">
            <input readOnly value={TASK.name} className="input tnum text-ink-dim" />
          </Field>

          <Field label="agent">
            <div className="flex gap-1.5">
              {Object.entries(AGENTS).map(([k, a]) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => pickAgent(k)}
                  className={`flex-1 px-3 py-2 text-sm border transition-colors ${
                    agent === k ? "border-amber/60 text-amber bg-amber/[0.06]" : "border-line-strong text-ink-dim hover:text-ink"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label={agent === "custom" ? "agent import-path / model" : "model"}>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="model name" className="input tnum" />
            </Field>
            <Field label="timeout multiplier">
              <select value={timeoutMult} onChange={(e) => setTimeoutMult(Number(e.target.value))} className="input tnum">
                <option value={0.25}>0.25× — cheap probe (~15m)</option>
                <option value={0.5}>0.5×</option>
                <option value={1}>1× — full 1h budget</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="agent key var">
              <input value={keyVar} onChange={(e) => setKeyVar(e.target.value)} className="input tnum" />
            </Field>
            <Field label={`${keyVar} (not stored)`}>
              <input type="password" value={agentKey} onChange={(e) => setAgentKey(e.target.value)} placeholder="sk-…" className="input tnum" autoComplete="off" />
            </Field>
          </div>

          <Field label="admin token">
            <input type="password" value={adminToken} onChange={(e) => setAdminToken(e.target.value)} placeholder="required to launch" className="input tnum" autoComplete="off" />
          </Field>

          {err && <div className="text-sm text-bad">{err}</div>}

          <button
            type="submit"
            disabled={busy || !agentKey || !adminToken}
            className="w-full px-4 py-2.5 bg-amber text-base font-medium hover:bg-amber/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "launching…" : LIVE ? "Launch run →" : "Launch (backend required)"}
          </button>
        </form>

        <div className="space-y-4">
          <div className="panel ticks p-4">
            <div className="label mb-2">generated command</div>
            <pre className="tnum text-[11.5px] text-cyan whitespace-pre-wrap leading-relaxed">{command}</pre>
          </div>
          <div className="panel ticks p-4 text-[11px] text-ink-faint leading-relaxed space-y-2">
            <p><span className="text-ink-dim">GPU.</span> Runs on {TASK.resources.gpu} via Modal; up to {TASK.resources.agentTimeoutSec / 3600}h.</p>
            <p><span className="text-ink-dim">Verifier.</span> Separate {TASK.resources.verifierMode} container grades the committed DEF.</p>
            <p><span className="text-ink-dim">Cost.</span> Launching spends real GPU time on the maintainer&apos;s Modal account — hence the admin gate.</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          background: var(--color-base);
          border: 1px solid var(--color-line-strong);
          padding: 0.55rem 0.7rem;
          color: var(--color-ink);
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: rgba(245, 177, 76, 0.55);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
