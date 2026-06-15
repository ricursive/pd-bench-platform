import type { MetricSpec, RunDetail, TaskDetail } from "./types";
import { compositeScore } from "./scoring";

const FIX = "/fixtures/ariane133";
const LEF = `${FIX}/cells.lef`;

export const METRICS: MetricSpec[] = [
  { key: "hpwl", weight: 0.3, reference: 781044057, label: "HPWL", unit: "dbu" },
  { key: "tns_viol", weight: 0.2, reference: 18228591, label: "TNS viol", unit: "ps" },
  { key: "wns_viol", weight: 0.1, reference: 3082, label: "WNS viol", unit: "ps" },
  { key: "cong_h", weight: 0.2, reference: 0, label: "Cong H", unit: "" },
  { key: "cong_v", weight: 0.2, reference: 0, label: "Cong V", unit: "" },
];

export const REFERENCE = Object.fromEntries(METRICS.map((m) => [m.key, m.reference]));
export const WEIGHTS = Object.fromEntries(METRICS.map((m) => [m.key, m.weight]));
export const EPSILON = 1e-9;

export const TASK: TaskDetail = {
  id: "ariane133-asap7-mixed-placement",
  name: "ricursive/ariane133-asap7-mixed-placement",
  description:
    "Mixed-size placement of Ariane133 on ASAP7 (133 fakeram7 macros + ~100K std cells).",
  difficulty: "easy",
  status: "frozen",
  authors: ["Ebrahim Songhori"],
  keywords: ["vlsi", "physical-design", "placement", "macro-placement", "openroad", "asap7"],
  resources: {
    gpu: "RTX-PRO-6000",
    cpus: 16,
    memoryMb: 65536,
    agentTimeoutSec: 3600,
    verifierMode: "separate · no-network",
  },
  metrics: METRICS,
  epsilon: EPSILON,
  haloUm: 2.0,
  clockPeriodPs: 900,
  gates: [
    { id: 1, title: "Floorplan unchanged", detail: "die area, rows, tracks, and pin placements identical to the input floorplan" },
    { id: 2, title: "Component set unchanged", detail: "exact (instance, master) set; no resize/buffer/clone/delete; net connectivity unchanged" },
    { id: 3, title: "Legal placement", detail: "all PLACED/FIXED, legal orientation, on-row & site-aligned, no overlaps, 2 µm macro halos" },
    { id: 4, title: "check_placement passes", detail: "OpenROAD check_placement -verbose reports no violations" },
  ],
  objective:
    "Produce a legal, high-quality mixed-size placement (133 SRAM macros + ~100K standard cells) " +
    "for the Ariane133 RISC-V core on the ASAP7 7nm predictive PDK. Any flow that produces a legal " +
    "DEF counts — DREAMPlace and Xplace are provided but optional. The compute budget is the task timeout.",
  inputs: [
    { path: "floorplan/ariane133_fp.def", contents: "Fixed floorplan: die, rows, tracks, placed I/O pins, unplaced components. Your starting point." },
    { path: "netlist/", contents: "Synthesized gate-level Verilog netlist." },
    { path: "asap7/lef/", contents: "ASAP7 tech LEF, std-cell LEF, SRAM macro LEF." },
    { path: "asap7/lib/", contents: "Liberty timing libraries (std cells + SRAM)." },
    { path: "constraints/ariane133.sdc", contents: "Timing constraints (clock definition)." },
    { path: "tools/DREAMPlace · tools/xplace", contents: "GPU-accelerated analytical placers (optional)." },
  ],
  reproduce:
    "read_lef <tech,std,sram> ; read_liberty <*.lib>\n" +
    "create_clock -name core_clock -period 900 [get_ports clk_i]\n" +
    "# hpwl = Σ net getTermBBox (OpenDB, dbu)\n" +
    "check_placement -verbose\n" +
    "global_route -allow_congestion -verbose        # cong_h / cong_v\n" +
    "estimate_parasitics -global_routing            # tns_viol / wns_viol",
  instruction: "", // fetched from /fixtures/ariane133/instruction.md
  floorplanDef: `${FIX}/ariane133_fp.def`,
  lef: LEF,
};

export const SAMPLE_SOLUTION = {
  gif: "/prerender/ariane133/solution.gif",
  poster: "/prerender/ariane133/solution.png",
  lef: LEF,
};

export const PHASES = [
  { stage: "00_floorplan", label: "Floorplan (unplaced)", def: `${FIX}/ariane133_fp.def`, elapsed_s: 0 },
  { stage: "10_global_place", label: "Global placement", def: `${FIX}/phases/10_global_place.def`, elapsed_s: 240 },
  { stage: "20_legalize", label: "Legalization", def: `${FIX}/phases/20_legalize.def`, elapsed_s: 410 },
  { stage: "30_detailed", label: "Detailed placement", def: `${FIX}/phases/30_detailed.def`, elapsed_s: 560 },
];

function gatesFor(valid: 0 | 1) {
  const ok = valid === 1;
  return TASK.gates.map((g) => ({
    gate: g.title.toLowerCase().replace(/\s+/g, "_"),
    label: g.title,
    status: (ok ? "pass" : g.id === 3 ? "fail" : "pass") as "pass" | "fail" | "skipped",
    detail: ok ? undefined : g.id === 3 ? "a hard gate failed during this run → reward 0" : undefined,
  }));
}

function scoreOf(metrics: Record<string, number>) {
  return compositeScore(metrics, WEIGHTS, REFERENCE, EPSILON);
}

interface SeedRun {
  runId: string;
  agent: string;
  model: string;
  date: string;
  job: string;
  valid: 0 | 1;
  task?: string;
  metrics?: Record<string, number>;
}

const SEED: SeedRun[] = [
  {
    runId: "ariane133-asap7-mixed-placement__DTxa2ZM",
    agent: "codex",
    model: "gpt-5.3-codex",
    date: "2026-06-12",
    job: "codex-bench",
    valid: 1,
    metrics: { hpwl: 728344038, tns_viol: 18228591, wns_viol: 3082, cong_h: 0, cong_v: 0 },
  },
  {
    runId: "ariane133-asap7-mixed-placement__MznmoRR",
    agent: "oracle",
    model: "-",
    date: "2026-06-12",
    job: "oracle-modal-final",
    valid: 1,
    metrics: { hpwl: 781044057, tns_viol: 18228591, wns_viol: 3082, cong_h: 0, cong_v: 0 },
  },
  {
    runId: "ariane133-asap7-mixed-placement__8Vo2xFM",
    agent: "claude-code",
    model: "claude-sonnet-4-6",
    date: "2026-06-12",
    job: "claude-bench",
    valid: 0,
  },
];

export function seedRuns(): RunDetail[] {
  return SEED.map((r) => {
    const sr = r.metrics && r.valid ? scoreOf(r.metrics) : null;
    const score = sr ? sr.score : 0;
    const reward_json =
      r.metrics != null
        ? ({
            reward: score / 100,
            valid: r.valid,
            score,
            frozen: 1,
            ...Object.fromEntries(Object.entries(r.metrics).map(([k, v]) => [`m_${k}`, v])),
            ...(sr ? Object.fromEntries(Object.entries(sr.subscores).map(([k, v]) => [`s_${k}`, v])) : {}),
          } as RunDetail["reward_json"])
        : ({ reward: 0, valid: 0, score: 0 } as RunDetail["reward_json"]);
    return {
      runId: r.runId,
      task: r.task ?? TASK.id,
      agent: r.agent,
      model: r.model,
      date: r.date,
      job: r.job,
      status: "done",
      valid: r.valid,
      score,
      reward: score / 100,
      reward_json,
      gates: gatesFor(r.valid),
      placementDef: r.valid ? `${FIX}/ariane133_placed.def` : null,
      lef: LEF,
      phases: r.valid ? PHASES : [],
      logTail:
        r.valid === 0
          ? "check_placement -verbose … VIOLATION: detailed placement failed legality\nverifier: hard gate failed → reward 0"
          : "verifier: all gates pass · metrics measured · score computed",
    };
  });
}
