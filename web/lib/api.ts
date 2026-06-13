import type { LaunchRequest, RunDetail, RunSummary, TaskDetail } from "./types";
import { TASK, seedRuns } from "./seed";

/**
 * Data layer. With NEXT_PUBLIC_API_BASE set, talks to the live FastAPI
 * backend (server/). Without it, serves the embedded seed (committed
 * results.jsonl + the synthetic fixture) so the static site is fully
 * browsable with no backend. The component contract is identical either way.
 */
const BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ?? "";
export const LIVE = BASE !== "";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

function toSummary(r: RunDetail): RunSummary {
  const { runId, task, agent, model, date, job, status, valid, score, reward } = r;
  return {
    runId, task, agent, model, date, job, status, valid, score, reward,
    m_hpwl: r.reward_json?.m_hpwl,
    m_tns_viol: r.reward_json?.m_tns_viol,
    m_wns_viol: r.reward_json?.m_wns_viol,
  };
}

export async function getTask(id: string): Promise<TaskDetail> {
  if (LIVE) return api<TaskDetail>(`/api/tasks/${id}`);
  const instruction = await fetch("/fixtures/ariane133/instruction.md")
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");
  return { ...TASK, instruction };
}

export async function getLeaderboard(): Promise<RunSummary[]> {
  if (LIVE) return api<RunSummary[]>("/api/leaderboard");
  return seedRuns()
    .map(toSummary)
    .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
}

export async function listRuns(): Promise<RunSummary[]> {
  if (LIVE) return api<RunSummary[]>("/api/runs");
  return seedRuns().map(toSummary);
}

export async function getRun(id: string): Promise<RunDetail | null> {
  if (LIVE) return api<RunDetail>(`/api/runs/${id}`);
  return seedRuns().find((r) => r.runId === id) ?? null;
}

export async function launchRun(req: LaunchRequest, adminToken: string): Promise<{ runId: string }> {
  if (!LIVE) throw new Error("Launching requires the live backend (set NEXT_PUBLIC_API_BASE and deploy server/).");
  return api<{ runId: string }>("/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(req),
  });
}
