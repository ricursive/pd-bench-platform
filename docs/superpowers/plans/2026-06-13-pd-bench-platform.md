# PD-Bench Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the PD-Bench benchmark platform — launch agents on PD tasks (live on Modal), visualize placements (empty floorplan → phase snapshots → final), inspect metrics/scoring, and a leaderboard.

**Architecture:** Next.js 15 (App Router) front end with a WebGL2 placement renderer; a Python/FastAPI backend deployed as a Modal app that shells out to `harbor run -e modal`; deterministic cores (scoring, DEF parsing) TDD'd in isolation. Everything except the paid Modal GPU run is built and tested on the host behind a mock orchestrator first.

**Tech Stack:** Next.js 15, TypeScript, Tailwind, WebGL2, FastAPI, Modal, harbor 0.13.2, vitest, pytest.

Spec: `docs/superpowers/specs/2026-06-13-pd-bench-platform-design.md`.

---

## File Structure

```
web/                       Next.js app (front end + static API client)
  package.json, tsconfig.json, tailwind.config.ts, next.config.mjs
  app/layout.tsx, app/page.tsx, app/globals.css
  app/tasks/[id]/page.tsx
  app/runs/[id]/page.tsx
  app/leaderboard/page.tsx
  app/launch/page.tsx
  lib/scoring.ts           TS port of tests/scoring.py (parity-tested)
  lib/def/parse.ts         DEF parser → PlacementPayload
  lib/def/lef.ts           LEF macro-size parser
  lib/def/types.ts         PlacementPayload, Component, Substrate types
  lib/render/renderer.ts   WebGL2 instanced-quad renderer + LOD heatmap
  lib/render/canvas2d.ts   non-WebGL density fallback
  lib/api.ts               typed client for the backend contract
  lib/api.mock.ts          in-memory mock backend (dev + tests)
  components/*.tsx          MetricBar, ScoreBreakdown, GatesPanel, Leaderboard, PlacementView, PhaseScrubber, RunCard, LaunchForm
  test/                     vitest specs
server/
  app.py                   Modal app: ASGI (FastAPI) web endpoint + spawned run fn
  api.py                   FastAPI routes (the contract)
  runs.py                  launch → harbor run -e modal → ingest
  ingest.py                DEF→placement.json, reward.json, phases, transcript
  store.py                 Modal Volume + results index (reuses leaderboard.py)
  mock_harbor.py           local fake harbor for host e2e test
  test_*.py                pytest
packages/def-ingest/
  ingest.py                CLI: DEF (+LEF) → placement.json (build + runtime)
fixtures/
  ariane133/               synthetic placed DEF + phases/NN_*.def + phases.json
  gen_fixture.py           generator (uses real die/rows from floorplan facts)
```

---

## Phase 1 — De-risk: Modal-in-Modal seam + orchestration adapter

### Task 1: Define the orchestrator adapter interface (no Modal yet)

**Files:**
- Create: `server/runs.py`
- Test: `server/test_runs.py`

- [ ] **Step 1: Write failing test** for an `Orchestrator` protocol with a `LocalMockOrchestrator` that, given a `LaunchSpec`, produces a job dir matching harbor's shape (`<job>/config.json`, `<job>/result.json`, `<job>/<trial>/verifier/reward.json`).

```python
# server/test_runs.py
from runs import LaunchSpec, LocalMockOrchestrator
def test_mock_orchestrator_produces_harbor_job(tmp_path):
    orch = LocalMockOrchestrator(jobs_root=tmp_path)
    run = orch.launch(LaunchSpec(task="ricursive/ariane133-asap7-mixed-placement",
                                 agent="codex", model="gpt-5.3-codex",
                                 agent_key="sk-x", timeout_mult=0.25))
    job = orch.wait(run.run_id)
    assert (job.dir / "result.json").is_file()
    trial = next(job.dir.glob("*__*"))
    reward = json.loads((trial/"verifier"/"reward.json").read_text())
    assert {"reward","valid","score"} <= set(reward)
```

- [ ] **Step 2:** Run `cd server && python -m pytest test_runs.py -v` → FAIL (no module).
- [ ] **Step 3:** Implement `LaunchSpec` dataclass, `RunHandle`, `Orchestrator` protocol, and `LocalMockOrchestrator` that writes a harbor-shaped job dir (copy the synthetic fixture's reward + DEF). Keep `HarborModalOrchestrator` as a documented stub that builds the exact CLI: `harbor run -p tasks/<task> -a <agent> -m <model> --ae '<KEYVAR>=${<KEYVAR>}' -e modal --agent-timeout-multiplier <m> --job-name <id> -o <jobs>`.
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5:** Commit `feat(server): orchestrator adapter + local mock (harbor job shape)`.

### Task 2: Document + smoke-check the live seam (no paid run)

- [ ] **Step 1:** `uv pip install --system modal harbor==0.13.2` (or a venv). Verify `modal --version` and `harbor --help`.
- [ ] **Step 2:** Author `server/MODAL_SEAM.md` recording: how `HarborModalOrchestrator` runs inside a CPU Modal function, how the token is passed (Modal Secret `pd-bench-modal`), and the **fallback** (orchestrator on host, web app on Modal). Record whether `modal` can be invoked from within a Modal function in this account — leave a `[ ]` check to confirm with the user before the first paid run.
- [ ] **Step 3:** Commit `docs(server): modal-in-modal seam + fallback`.

> **GATE:** The first *paid* GPU run (real `-e modal`) spends money and ~1h. Do not trigger it until the user explicitly approves. All earlier phases use `LocalMockOrchestrator`.

---

## Phase 2 — Scaffold + design system

### Task 3: Next.js app scaffold

**Files:** `web/package.json`, `web/tsconfig.json`, `web/next.config.mjs`, `web/tailwind.config.ts`, `web/app/layout.tsx`, `web/app/globals.css`, `web/app/page.tsx`

- [ ] **Step 1:** `cd web && npm create next-app@latest . --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*"` (non-interactive flags). Add `vitest`, `@vitejs/plugin-react`, `jsdom`.
- [ ] **Step 2:** Establish the design tokens in `globals.css` + `tailwind.config.ts`: near-black bg (`#0a0b0d`), panel (`#111317`), hairline border (`#1e2228`), accent (electric blue `#4da3ff`), mono font for data. Use the **frontend-design** skill for the system.
- [ ] **Step 3:** Build `app/layout.tsx` shell: top nav (PD-Bench / Tasks / Leaderboard / Launch), monospace wordmark, footer with repo link.
- [ ] **Step 4:** `npm run build` → succeeds. `npm run dev` smoke check.
- [ ] **Step 5:** Commit `feat(web): scaffold Next.js + design system`.

---

## Phase 3 — DEF parser + ingest + synthetic fixture (TDD)

### Task 4: TS DEF/LEF parser → PlacementPayload

**Files:** `web/lib/def/types.ts`, `web/lib/def/parse.ts`, `web/lib/def/lef.ts`, `web/test/def.test.ts`

- [ ] **Step 1:** Write failing tests parsing a small DEF literal: assert `dbuPerMicron`, `dieArea`, `rows.length`, a placed component `{name,master,x,y,orient,status}`, and an UNPLACED component is flagged. Mirror `def_checks.py` field semantics (rotated orients `E/W/FE/FW` swap w/h; placed statuses `PLACED/FIXED/COVER`).
- [ ] **Step 2:** Run `npm run test def` → FAIL.
- [ ] **Step 3:** Implement statement tokenizer + `parseDef`/`parseLefMacros`. `PlacementPayload` = `{ substrate:{dieArea,rows,tracks,pins,dbuPerMicron}, macros:[], cells: Int32Array (x,y,w,h,catId per cell), categories:[] }`.
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5:** Commit `feat(web): DEF/LEF parser → placement payload`.

### Task 5: Synthetic ariane133 fixture + phases

**Files:** `fixtures/gen_fixture.py`, `fixtures/ariane133/*`

- [ ] **Step 1:** Write `gen_fixture.py` that emits a DEF with the real ariane133 die scale (~1.4mm, dbu/micron from ASAP7), ROWS/TRACKS banding, ~133 SRAM macros laid on a grid honoring 2µm halos, and ~40K representative std cells in a density cloud (scaled down from 100K for repo size, flag count in a header comment). Emit phase DEFs `00_floorplan` (all UNPLACED) → `10_global_place` → `20_legalize` → `30_detailed`, plus `phases.json`.
- [ ] **Step 2:** Run it; parse output with the Task 4 parser in a test → asserts counts + halos.
- [ ] **Step 3:** Commit `feat(fixtures): synthetic ariane133 placement + phases`.

### Task 6: def-ingest CLI

**Files:** `packages/def-ingest/ingest.py`, test

- [ ] **Step 1:** Failing test: `ingest.py <def> --lef-dir <d> -o out.json` produces a JSON with `substrate/macros/cells/categories`.
- [ ] **Step 2:** Implement (pure Python; same field model as the TS parser; cells as flat arrays for compactness). PASS.
- [ ] **Step 3:** Commit `feat(ingest): DEF→placement.json CLI`.

---

## Phase 4 — WebGL placement renderer

### Task 7: Renderer core (substrate + instanced cells + LOD)

**Files:** `web/lib/render/renderer.ts`, `web/lib/render/canvas2d.ts`, `web/components/PlacementView.tsx`, `web/test/render.test.ts`

- [ ] **Step 1:** Test the *math* (not GL): viewport fit, world↔screen transform, LOD threshold (switch to heatmap when cells-per-pixel > k), bin/density accumulation. These are pure functions in `renderer.ts`.
- [ ] **Step 2:** Run → FAIL; implement the pure helpers; PASS.
- [ ] **Step 3:** Implement the WebGL2 instanced-quad draw (substrate lines + macro outlines + per-cell instances colored by category) and `canvas2d.ts` density fallback; `PlacementView.tsx` wires pan/zoom, overlay toggles (HPWL/congestion/halos/density), and the empty-floorplan "parts to place" panel.
- [ ] **Step 4:** Manual: render the fixture in `npm run dev`; verify macros, density LOD, pan/zoom.
- [ ] **Step 5:** Commit `feat(web): WebGL placement renderer + LOD + overlays`.

### Task 8: Phase scrubber

**Files:** `web/components/PhaseScrubber.tsx`

- [ ] **Step 1:** Component takes `phases.json` + per-phase payloads, renders a timeline (floorplan→global→legalize→detailed), scrubs the PlacementView, shows per-phase metrics when present; falls back to final-only when no phases.
- [ ] **Step 2:** Manual verify against fixture phases.
- [ ] **Step 3:** Commit `feat(web): phase-snapshot scrubber`.

---

## Phase 5 — Scoring, gates, pages (static data)

### Task 9: TS scoring (parity with scoring.py)

**Files:** `web/lib/scoring.ts`, `web/test/scoring.test.ts`

- [ ] **Step 1:** Port the test vectors from `tasks/.../tests/test_scoring.py` into vitest: `subscore`, `effectiveWeights` drop-rule, `compositeScore`, `rewardPayload`. Assert the ariane133 effective weights (hpwl ½, tns ⅓, wns ⅙) and that baseline metrics score 0.
- [ ] **Step 2:** Run → FAIL; implement `lib/scoring.ts` mirroring `scoring.py`; PASS.
- [ ] **Step 3:** Commit `feat(web): scoring math (parity with scoring.py)`.

### Task 10: Scoring + gates components

**Files:** `web/components/ScoreBreakdown.tsx`, `web/components/GatesPanel.tsx`, `web/components/MetricBar.tsx`

- [ ] Render per-metric ref/m/s/effective-weight + weighted bar summing to score; dropped metrics struck through; the 4 hard gates pass/fail from `report.json`; `valid 0` shown prominently. Commit.

### Task 11: Task / Leaderboard / Run / Home pages (mock data)

**Files:** `web/app/tasks/[id]/page.tsx`, `web/app/leaderboard/page.tsx`, `web/app/runs/[id]/page.tsx`, `web/app/page.tsx`, `web/components/Leaderboard.tsx`, `web/components/RunCard.tsx`, `web/lib/api.mock.ts`

- [ ] Build all read pages against `api.mock.ts` (seeded from `results.jsonl` + fixture). Task page renders `instruction.md` (markdown) + gates + scoring config + floorplan viz. Leaderboard mirrors `LEADERBOARD.md` columns, grouped/sortable. Run page = status + metrics + ScoreBreakdown + GatesPanel + PlacementView+PhaseScrubber + logs. Commit per page.

---

## Phase 6 — Backend API + mock orchestrator

### Task 12: FastAPI contract over the mock orchestrator

**Files:** `server/api.py`, `server/store.py`, `server/ingest.py`, `server/mock_harbor.py`, `server/test_api.py`

- [ ] **Step 1:** Failing tests (FastAPI `TestClient`) for the contract: `POST /api/runs` (requires admin bearer → 401 without), `GET /api/runs`, `GET /api/runs/:id`, `/logs`, `/placement`, `/phases`, `GET /api/tasks/:id`, `GET /api/leaderboard`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `api.py` using `LocalMockOrchestrator`; `ingest.py` converts a finished job dir → placement payloads + reward + phases (reuse def-ingest); `store.py` indexes results (reuse `scripts/leaderboard.py` `add_job`/`render` logic). Admin token from `PDBENCH_ADMIN_TOKEN`. Agent key injected into the orchestrator call, never stored.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(server): FastAPI contract + mock orchestrator`.

### Task 13: Wire `lib/api.ts` + end-to-end on host

**Files:** `web/lib/api.ts`, `server/test_e2e.py`

- [ ] Point the front end at the real FastAPI (env `NEXT_PUBLIC_API_BASE`); e2e test: launch via mock → poll to done → ingest → `/placement` returns a parseable payload. Commit.

---

## Phase 7 — Live Modal orchestration + auth + key injection

### Task 14: HarborModalOrchestrator (live)

**Files:** `server/runs.py` (fill the stub), `server/app.py`

- [ ] **Step 1:** Implement `HarborModalOrchestrator.launch` = a Modal `.spawn()` of a CPU function that: clones/uses the repo, writes the per-run agent key to env, runs the harbor CLI with `-e modal`, then ingests the job dir into the Volume. `wait/status` read the Volume.
- [ ] **Step 2:** `app.py`: Modal `App`, the ASGI FastAPI web endpoint, the Modal Secret (`pd-bench-modal`) for the Modal token, the Volume for jobs/results, and `modal serve`/`modal deploy` wiring serving the exported Next.js `out/`.
- [ ] **Step 3:** `modal serve server/app.py` locally (free; no GPU) → the site loads, mock path still works, contract green.
- [ ] **Step 4:** Commit `feat(server): live Modal orchestration + ASGI web endpoint`.

### Task 15: Admin auth + key handling hardening

- [ ] Bearer-token middleware on mutating routes; front-end `/launch` stores the admin token in `sessionStorage` only; assert (test) the agent key never appears in any persisted record/log. Commit.

> **GATE (paid):** With user approval, set the Modal Secret + `PDBENCH_ADMIN_TOKEN`, `modal deploy`, and trigger ONE real `-e modal` oracle run to validate the seam end-to-end (expect reward 0, valid 1). Record the outcome.

---

## Phase 8 — Phase-capture harness wiring

### Task 16: Emit phase DEFs from the baseline flow

**Files:** `tasks/ricursive/ariane133-asap7-mixed-placement/solution/solve.tcl`, `.../task.toml`, `.../instruction.md`

- [ ] **Step 1:** Add a tcl helper `dump_phase {label}` writing `/logs/artifacts/phases/NN_label.def` and appending to `phases.json`; call it after floorplan-init, after `rtl_macro_placer`+global, after legalize, after detailed.
- [ ] **Step 2:** Extend `task.toml` `artifacts` to collect `/logs/artifacts/phases/`.
- [ ] **Step 3:** Document the optional convention in `instruction.md` (agents may emit phases to get the timeline).
- [ ] **Step 4:** `uv run pytest` (repo consistency tests) still green; `scripts/sync_task_files.py --check` green.
- [ ] **Step 5:** Commit `feat(task): emit phase snapshot DEFs from baseline flow`.

---

## Phase 9 — Deploy

### Task 17: Deploy to Modal + README

- [ ] `web` static export → served by the ASGI endpoint; `modal deploy server/app.py`; smoke the public URL (browse leaderboard/task/viz). Add a `web/README.md` + a platform section to the repo `README.md` (run locally, deploy, admin token, per-run keys, rotate the Modal token). Commit.

---

## Self-Review

- **Spec coverage:** launch (T1,12,14,15), task viz (T4,7,11), placement viz incl empty+routing/congestion overlays (T7), metrics/scoring (T9,10), leaderboard (T11), phase snapshots real capture (T8,16), Modal deploy (T14,17), auth+keys (T15), error-as-result (T1,12 mock + e2e). Covered.
- **Placeholders:** none — each task names exact files + concrete behavior; deterministic cores carry real test assertions.
- **Type consistency:** `PlacementPayload`/`LaunchSpec`/`Orchestrator` names used consistently across web + server tasks; scoring keys match `scoring.py` (`hpwl,tns_viol,wns_viol,cong_h,cong_v`).
- **Paid-run gates:** the two money-spending steps are explicitly gated on user approval.
