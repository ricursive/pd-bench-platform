/**
 * TS port of the verifier's scoring math (tasks/.../tests/scoring.py).
 * Kept in lockstep with the Python module — see web/test/scoring.test.ts,
 * which mirrors tests/test_scoring.py. The site computes scores client-side
 * for transparency, but the verifier's reward.json remains authoritative.
 *
 *   s = max((ref - m) / ref, 0)
 *   score = 100 * Σ w·s     (weights renormalized after the drop rule)
 */

export const METRIC_KEYS = [
  "hpwl",
  "tns_viol",
  "wns_viol",
  "cong_h",
  "cong_v",
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export type MetricMap = Record<string, number>;

export interface ScoreResult {
  score: number; // 0..100
  subscores: Record<string, number>; // metric -> s in [0,1]
  effectiveWeights: Record<string, number>; // post drop-rule
  dropped: string[];
}

export function subscore(value: number, reference: number): number {
  if (reference <= 0)
    throw new Error("subscore called on a degenerate reference; apply the drop rule");
  return Math.max(0, (reference - value) / reference);
}

export function validateWeights(weights: MetricMap, tol = 1e-9): Record<string, number> {
  const keys = Object.keys(weights).sort();
  const expect = [...METRIC_KEYS].sort();
  if (keys.length !== expect.length || keys.some((k, i) => k !== expect[i]))
    throw new Error(`weights keys ${JSON.stringify(keys)} != expected ${JSON.stringify(expect)}`);
  const out: Record<string, number> = {};
  for (const k of METRIC_KEYS) out[k] = Number(weights[k]);
  if (Object.values(out).some((w) => w < 0)) throw new Error("weights must be non-negative");
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 1) > tol) throw new Error(`weights must sum to 1.0, got ${total}`);
  return out;
}

export function effectiveWeights(
  weights: MetricMap,
  reference: MetricMap,
  epsilon: number,
): { eff: Record<string, number>; dropped: string[] } {
  const kept: Record<string, number> = {};
  const dropped: string[] = [];
  for (const key of METRIC_KEYS) {
    if (reference[key] < epsilon) dropped.push(key);
    else kept[key] = Number(weights[key]);
  }
  const total = Object.values(kept).reduce((a, b) => a + b, 0);
  if (!Object.keys(kept).length || total <= 0)
    throw new Error("all metrics dropped (or zero total weight); cannot score");
  const eff: Record<string, number> = {};
  for (const [k, w] of Object.entries(kept)) eff[k] = w / total;
  return { eff, dropped };
}

export function compositeScore(
  metrics: MetricMap,
  weights: MetricMap,
  reference: MetricMap,
  epsilon: number,
): ScoreResult {
  const w = validateWeights(weights);
  const { eff, dropped } = effectiveWeights(w, reference, epsilon);
  const subscores: Record<string, number> = {};
  for (const key of Object.keys(eff)) {
    if (!(key in metrics)) throw new Error(`missing metric value for ${key}`);
    subscores[key] = subscore(Number(metrics[key]), reference[key]);
  }
  const score = 100 * Object.keys(eff).reduce((acc, k) => acc + eff[k] * subscores[k], 0);
  return { score, subscores, effectiveWeights: eff, dropped };
}

export const TO_FREEZE = "TO_FREEZE";

export function parseReference(raw: Record<string, unknown>): Record<string, number> {
  const reference: Record<string, number> = {};
  for (const key of METRIC_KEYS) {
    if (!(key in raw)) throw new Error(`reference missing metric ${key}`);
    const value = raw[key];
    if (typeof value === "string")
      throw new Error(`reference.${key} is ${value}; freeze it first (see the task README)`);
    if (typeof value !== "number") throw new Error(`reference.${key} must be numeric`);
    if (value < 0) throw new Error(`reference.${key} must be >= 0, got ${value}`);
    reference[key] = value;
  }
  return reference;
}

export interface RewardPayload {
  reward: number;
  valid: 0 | 1;
  score: number;
  [k: string]: number;
}

export function rewardPayload(args: {
  valid: boolean;
  metrics?: MetricMap;
  scoreResult?: ScoreResult;
}): RewardPayload {
  const payload: RewardPayload = { reward: 0, valid: args.valid ? 1 : 0, score: 0 };
  if (args.metrics) for (const [k, v] of Object.entries(args.metrics)) payload[`m_${k}`] = Number(v);
  if (args.valid && args.scoreResult) {
    payload.score = args.scoreResult.score;
    payload.reward = args.scoreResult.score / 100;
    for (const [k, s] of Object.entries(args.scoreResult.subscores)) payload[`s_${k}`] = s;
    for (const k of args.scoreResult.dropped) payload[`dropped_${k}`] = 1;
  }
  return payload;
}
