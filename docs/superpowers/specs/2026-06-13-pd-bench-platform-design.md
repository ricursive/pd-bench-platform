# PD-Bench Platform — Design Spec

Status: approved 2026-06-13. Branch: `christina/eval`.

## Goal

A serious benchmark platform for PD-Bench with five capabilities:

1. **Launch** an agent on a PD task — live, on the maintainer's Modal GPUs.
2. **Explore** the example task (`ricursive/ariane133-asap7-mixed-placement`).
3. **Visualize** placements — empty floorplan, final placement, and phase-by-phase snapshots.
4. **Inspect** metrics and scoring from the grading pipeline.
5. **Leaderboard** over committed + live results.

Aesthetic: a technical research tool — dense, precise, monospace-accented, dark-first.
No marketing gradients or toy demos.

## Locked decisions

| Decision | Choice |
|---|---|
| Stack | Next.js 15 (App Router) + TypeScript + Tailwind |
| Launch scope | Live backend on Modal (real `harbor run -e modal`) |
| Auth | Single **admin token** gates launching; browsing is public |
| Agent LLM keys | Submitter pastes their own per-run key; injected into `harbor --ae`, never persisted/logged |
| Phase snapshots | Real harness capture (`/logs/artifacts/phases/NN_label.def` + manifest) + timeline UI |
| Deploy | Modal app: one ASGI web endpoint serves API + exported Next.js site |
| Viz data | Synthetic ariane133 fixture now + auto-ingest real DEFs from completed runs |

## Data model (the inputs the platform consumes)

- `task.toml` — name, description, difficulty, GPU/verifier resources, docker digests.
- `instruction.md` — agent spec: hard gates, metric table, scoring recipe.
- `tests/config.yaml` — weights, frozen reference values, epsilon, drop-rule.
- `reward.json` (per trial) — `reward, valid, score, m_*, s_*, dropped_*, frozen`.
- `report.json` (per trial) — gate pass/fail diagnostics, result, dropped_metrics.
- `leaderboard/results.jsonl` — per-trial rows (date, agent, model, job, score, valid, m_*).
- Submitted **DEF** — `DIEAREA, ROWS, TRACKS, COMPONENTS(name,master,status,x,y,orient), PINS, NETS` + LEF macro sizes. Source for placement visualization.
- Harbor job dir — `config.json`, `result.json`, `<trial>/agent/` transcript, `<trial>/verifier/reward.json`.

**Scoring (must match `tests/scoring.py` exactly):**
`s_m = max((ref_m − m)/ref_m, 0)`; `score = 100·Σ wₘ·sₘ`; `reward = score/100`.
Metrics with `ref < epsilon` are dropped and weights renormalize. For ariane133:
cong_h/cong_v drop (ref≈0) → effective weights hpwl ½, tns_viol ⅓, wns_viol ⅙.

## Repo layout (new top-level dirs; nothing existing disturbed)

```
web/                      Next.js 15 (App Router) + TS + Tailwind
  app/                    / , /tasks/[id] , /runs/[id] , /leaderboard , /launch
  components/             RunCard, MetricBar, ScoreBreakdown, GatesPanel, Leaderboard, PlacementView, PhaseScrubber
  lib/def/                DEF/LEF parser → compact placement payload (shared with ingest)
  lib/render/             WebGL2 placement renderer (instanced quads + LOD heatmap)
  lib/scoring.ts          TS port of scoring.py (parity-tested)
  lib/api.ts              typed client for the backend contract
server/                   Python backend (FastAPI), deployed as a Modal app
  app.py                  Modal app: ASGI web endpoint + spawned run function
  runs.py                 launch → harbor run -e modal → ingest jobs/<job>
  ingest.py               DEF→JSON, reward.json, phases, transcript → Volume
  store.py                Modal Volume + results index (reuses leaderboard.py logic)
packages/def-ingest/      CLI: DEF → placement.json (build-time fixture + run-time)
fixtures/                 synthetic ariane133 placed DEF + phase DEFs (dev/demo data)
```

## Two hard technical decisions

### (a) Rendering ~100K cells

Parse DEF → typed arrays (`x,y,w,h,categoryId`), render with **WebGL2 instanced quads**
(one draw call, 100K+ rects at 60fps with pan/zoom). 133 macros draw as outlined,
labeled blocks; std cells as instanced fills colored by category/orientation; zoomed out
switches to a **binned density heatmap (LOD)** — the canonical placement-density image.
Fallback: a density-canvas (2D) path when WebGL is unavailable.
Rejected: server-side slippy-map tiles — heavy infra, overkill for one 100K design.

### (b) Orchestration "Modal-in-Modal"

The backend runs on Modal and invokes `harbor run -e modal`, which itself spawns GPU
sandboxes on Modal. A CPU orchestrator Modal Function holds the token + repo, shells out
to harbor, then ingests results. **Risk:** spawning Modal GPU work from inside a Modal
function — validated as implementation step 1. **Fallback (clean):** orchestrator runs on
the host while only the web app is on Modal — same API contract, one adapter swap.

`harbor` is a pip package (`harbor==0.13.2`), invoked as a CLI producing
`jobs/<job>/<trial>/{agent/, verifier/reward.json}` + `config.json`/`result.json`;
`scripts/leaderboard.py` already ingests that shape.

## Launch flow & API contract

`/launch` form: task, agent (claude-code / codex / custom import-path), model, submitter's
own LLM key (injected into `harbor --ae 'KEY=${KEY}'`, never persisted/logged), timeout
multiplier (the `--agent-timeout-multiplier` cheap-probe flag). Submitting requires the
admin token (entered once, stored client-side only, sent as a bearer header); browsing
needs nothing.

```
POST /api/runs            {task, agent, model, agentKey, timeoutMult} → {runId}     [admin]
GET  /api/runs            → [{runId, status, agent, model, score, valid, date}]
GET  /api/runs/:id        → {status: queued|running|grading|done|error, reward, report}
GET  /api/runs/:id/logs   → agent transcript + verifier log (poll/stream)
GET  /api/runs/:id/placement   → placement payload (final DEF)
GET  /api/runs/:id/phases      → phase manifest + per-phase placement payloads
GET  /api/tasks/:id       → parsed task.toml + instruction.md + config.yaml
GET  /api/leaderboard     → results.jsonl rows, grouped by task
```

A run never blocks a request: `POST` returns `runId` instantly; the UI polls status.
Completed runs append to `leaderboard/results.jsonl` (reusing `scripts/leaderboard.py`
logic) and land in the Modal Volume.

## Phase snapshots (real capture)

Convention: intermediate DEFs at `/logs/artifacts/phases/NN_label.def` + `phases.json`
manifest `[{stage, label, def, elapsed_s, metrics?}]`. Canonical stages:
`00_floorplan` (unplaced input = the "empty design" view) → `10_global_place` →
`20_legalize` → `30_detailed`. The baseline `solution/solve.tcl` is wired to emit these at
its natural dump points; `task.toml` `artifacts` extended to collect the dir; the
convention documented in `instruction.md` so any agent can opt in. UI: a phase
scrubber/timeline that morphs the placement view stage-to-stage. Backward-compatible: a run
with no phases shows only the final placement.

## Placement visualization

Always renders the **fixed substrate** (DIEAREA, ROWS as faint banding, TRACKS, fixed I/O
PINS on the boundary) — hard-gated invariants. Layers on top: macros, std cells (LOD), and
toggleable overlays: HPWL flylines / net-bbox, global-route congestion heatmap
(`cong_h`/`cong_v` grid), macro 2µm halos (the gate), placement density. Empty/floorplan
DEF → substrate + a "parts to place" inventory panel (133× SRAM macro, ~100K std cells,
total cell area, target utilization).

## Metrics, scoring & leaderboard

- **Scoring panel** renders the formula transparently: per-metric `ref`, measured `m`,
  `s_m`, effective weight (post-drop), and the weighted bar summing to `score`. Dropped
  metrics struck through with "ref≈0, dropped". Math ported from `scoring.py`, parity-tested
  against `tests/test_scoring.py`.
- **Gates panel**: the four hard gates with pass/fail from `report.json`; a failed gate shows
  `valid 0` and which gate, prominently.
- **Leaderboard**: reads `results.jsonl`, grouped per task, sortable, same columns as
  `LEADERBOARD.md`, valid/invalid styling, links to each run's detail + viz.

## Pages

`/` overview (what PD-Bench is, task list, top leaderboard rows, launch CTA) ·
`/tasks/[id]` (rendered instruction.md + gates + scoring config + floorplan viz) ·
`/leaderboard` · `/runs/[id]` (status, metrics, scoring breakdown, gates, placement viz with
phase scrubber, transcript/logs) · `/launch` (the form).

## Visual system

Dark technical theme: near-black canvas, one restrained accent (electric blue or amber),
monospace for all numbers/IDs/metrics, hairline borders, data-dense tables, EDA color
language for the chip (macros distinct from a std-cell density ramp; congestion as a heat
ramp). Built with the frontend-design skill.

## Error handling

Backend mirrors the benchmark's own principle — always a parseable result: a failed launch,
harbor crash, or missing DEF surfaces as `status:error` + message, never a hung UI.
Renderer degrades: malformed/huge DEF → substrate + warning; no WebGL → density-canvas
fallback. Admin-gated endpoints `401` cleanly.

## Secrets

The Modal token lives in a Modal Secret (prod) and gitignored `.env` (local dev) — never
committed, never logged. Submitter LLM keys are per-run only, injected via harbor's
`${VAR}` template form, never persisted.

## Testing

- TS scoring math unit-tested against the Python `test_scoring.py` vectors (parity).
- DEF parser tested against the synthetic fixture + `def_checks.py` expectations.
- API contract has a mock implementation so the whole frontend is testable without Modal.
- One end-to-end "launch → mock harbor → ingest → render" test on the host; the live Modal
  seam validated as step 1.

## Build order

1. Validate the Modal-in-Modal seam (de-risk).
2. Repo scaffold + design system.
3. DEF parser + ingest CLI + synthetic ariane133 fixture (with phases).
4. WebGL placement renderer + substrate + LOD + overlays.
5. Task / leaderboard / scoring pages (static data).
6. Backend API + mock orchestrator (full frontend testable).
7. Live Modal orchestration + admin auth + per-run key injection.
8. Phase-capture harness wiring + timeline UI.
9. Deploy to Modal.
