import type { PhaseEntry } from "./types";

export interface ArmTrace {
  kind: "final" | "phases";
  placementDef?: string;
  lef: string;
  phases?: PhaseEntry[];
  note: string;
}

export interface ArmData {
  label: string;
  blurb: string;
  n: number;
  mean: number;
  std: number;
  valid_rate: number;
  pass_at_1: number;
  scores: number[];
  trace: ArmTrace;
}

export interface Experiment {
  preview: boolean;
  title: string;
  agent: string;
  model: string;
  task: string;
  hypothesis: string;
  note: string;
  arms: { control: ArmData; treatment: ArmData };
  comparison: { delta_mean: number; delta_valid_rate: number; mannwhitney_p_approx: number };
  anchor: { real_control_score: number; real_control_valid: number; source: string };
}

export async function getExperiment(): Promise<Experiment | null> {
  try {
    const res = await fetch("/experiments/codex-ab.json", { cache: "no-cache" });
    if (res.ok) return (await res.json()) as Experiment;
  } catch {
    /* not present yet */
  }
  return null;
}
