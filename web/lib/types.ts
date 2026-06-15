/** Shared platform types (front end ⇄ backend contract). */

export type RunStatus = "queued" | "running" | "grading" | "done" | "error";

export interface RewardJson {
  reward: number;
  valid: 0 | 1;
  score: number;
  frozen?: number;
  m_hpwl?: number;
  m_tns_viol?: number;
  m_wns_viol?: number;
  m_cong_h?: number;
  m_cong_v?: number;
  [k: string]: number | undefined;
}

export interface GateReport {
  gate: string;
  label: string;
  status: "pass" | "fail" | "skipped";
  detail?: string;
}

export interface PhaseEntry {
  stage: string;
  label: string;
  def: string; // url/path to the phase DEF
  elapsed_s: number;
  metrics?: Partial<Record<string, number>>;
}

export interface RunSummary {
  runId: string;
  task: string;
  agent: string;
  model: string;
  date: string;
  job: string;
  status: RunStatus;
  valid: 0 | 1;
  score: number;
  reward: number;
  m_hpwl?: number;
  m_tns_viol?: number;
  m_wns_viol?: number;
}

export interface RunDetail extends RunSummary {
  reward_json: RewardJson | null;
  gates: GateReport[];
  /** fixture/artifact paths for the renderer */
  placementDef: string | null;
  lef: string;
  phases: PhaseEntry[];
  logTail?: string;
  error?: string;
}

export interface MetricSpec {
  key: string;
  weight: number;
  reference: number;
  label: string;
  unit: string;
}

export interface TaskDetail {
  id: string;
  name: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  status: string;
  authors: string[];
  keywords: string[];
  resources: {
    gpu: string;
    cpus: number;
    memoryMb: number;
    agentTimeoutSec: number;
    verifierMode: string;
  };
  metrics: MetricSpec[];
  epsilon: number;
  haloUm: number;
  clockPeriodPs: number;
  gates: { id: number; title: string; detail: string }[];
  objective: string;
  inputs: { path: string; contents: string }[];
  reproduce: string; // a short OpenROAD/flow recipe (code)
  instruction: string; // markdown
  floorplanDef: string;
  lef: string;
}

/** One task in the benchmark registry, from web/public/prerender/index.json. */
export interface PreviewEntry {
  task: string; // short id
  org: string;
  name: string;
  difficulty: "easy" | "medium" | "hard";
  blurb: string;
  /** "live" tasks are runnable + have a preview; "planned" are roadmap cards. */
  status: "live" | "planned";
  gif: string;
  poster: string;
  refMetrics: { label: string; value: string }[];
  /** true until a real oracle-derived preview replaces the synthetic one */
  synthetic: boolean;
}

export interface LaunchRequest {
  task: string;
  agent: string;
  model: string;
  agentKeyVar: string; // e.g. ANTHROPIC_API_KEY
  agentKey: string; // injected, never persisted
  timeoutMult: number;
}
