import { describe, it, expect } from "vitest";
import {
  subscore,
  validateWeights,
  effectiveWeights,
  compositeScore,
  parseReference,
  rewardPayload,
  METRIC_KEYS,
} from "@/lib/scoring";

// Mirrors tasks/.../tests/test_scoring.py vectors.
const REFERENCE = { hpwl: 200, tns_viol: 1000, wns_viol: 50, cong_h: 10, cong_v: 10 };
const WEIGHTS = { hpwl: 0.3, tns_viol: 0.2, wns_viol: 0.1, cong_h: 0.2, cong_v: 0.2 };
const zeros = () => Object.fromEntries(METRIC_KEYS.map((k) => [k, 0]));

describe("subscore", () => {
  it("zero metric scores one", () => expect(subscore(0, REFERENCE.hpwl)).toBe(1));
  it("baseline scores zero", () => expect(subscore(200, REFERENCE.hpwl)).toBe(0));
  it("half of baseline", () => expect(subscore(100, REFERENCE.hpwl)).toBeCloseTo(0.5));
  it("clips below zero when worse", () => expect(subscore(500, REFERENCE.hpwl)).toBe(0));
});

describe("weights", () => {
  it("accepts summing to one", () => expect(validateWeights(WEIGHTS).hpwl).toBe(0.3));
  it("rejects bad sum", () =>
    expect(() => validateWeights({ ...WEIGHTS, hpwl: 0.5 })).toThrow(/sum to 1.0/));
  it("rejects missing metric", () => {
    const bad = { ...WEIGHTS } as Record<string, number>;
    delete bad.cong_v;
    expect(() => validateWeights(bad)).toThrow(/keys/);
  });
});

describe("drop rule", () => {
  it("zero reference dropped and renormalized", () => {
    const { eff, dropped } = effectiveWeights(WEIGHTS, { ...REFERENCE, wns_viol: 0 }, 1e-9);
    expect(dropped).toEqual(["wns_viol"]);
    expect("wns_viol" in eff).toBe(false);
    expect(Object.values(eff).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(eff.hpwl).toBeCloseTo(0.3 / 0.9);
  });
  it("below epsilon dropped", () => {
    const { dropped } = effectiveWeights(WEIGHTS, { ...REFERENCE, cong_h: 1e-12 }, 1e-9);
    expect(dropped).toEqual(["cong_h"]);
  });
  it("all dropped raises", () => {
    expect(() => effectiveWeights(WEIGHTS, zeros(), 1e-9)).toThrow(/all metrics dropped/);
  });
});

describe("composite score", () => {
  it("all zero is 100", () => expect(compositeScore(zeros(), WEIGHTS, REFERENCE, 1e-9).score).toBeCloseTo(100));
  it("baseline scores 0", () =>
    expect(compositeScore({ ...REFERENCE }, WEIGHTS, REFERENCE, 1e-9).score).toBeCloseTo(0));
  it("weighted mix: only hpwl perfect -> 30", () =>
    expect(compositeScore({ ...REFERENCE, hpwl: 0 }, WEIGHTS, REFERENCE, 1e-9).score).toBeCloseTo(30));

  it("ariane133 effective weights after cong drop: hpwl 1/2, tns 1/3, wns 1/6", () => {
    const ref = { hpwl: 781044057, tns_viol: 18228591, wns_viol: 3082, cong_h: 0, cong_v: 0 };
    const { eff, dropped } = effectiveWeights(WEIGHTS, ref, 1e-9);
    expect(dropped.sort()).toEqual(["cong_h", "cong_v"]);
    expect(eff.hpwl).toBeCloseTo(0.5);
    expect(eff.tns_viol).toBeCloseTo(1 / 3);
    expect(eff.wns_viol).toBeCloseTo(1 / 6);
  });
});

describe("reference parsing", () => {
  it("TO_FREEZE raises", () => {
    const raw = { ...zeros(), hpwl: "TO_FREEZE" } as Record<string, unknown>;
    expect(() => parseReference(raw)).toThrow(/hpwl/);
  });
  it("negative rejected", () => {
    expect(() => parseReference({ ...zeros(), hpwl: -2 })).toThrow(/hpwl/);
  });
});

describe("reward payload", () => {
  it("gate failure flattens to zero", () => {
    const p = rewardPayload({ valid: false });
    expect(p).toMatchObject({ reward: 0, valid: 0, score: 0 });
  });
  it("valid scored payload", () => {
    const r = compositeScore(zeros(), WEIGHTS, REFERENCE, 1e-9);
    const p = rewardPayload({ valid: true, metrics: zeros(), scoreResult: r });
    expect(p.reward).toBeCloseTo(1);
    expect(p.score).toBeCloseTo(100);
    expect(p.valid).toBe(1);
    expect(p.s_hpwl).toBe(1);
    expect(p.m_hpwl).toBe(0);
  });
});
