# PD-Bench Platform

The web platform for [PD-Bench](https://github.com/ricursive/pd-bench) — a benchmark
for evaluating AI agents on chip physical-design tasks. Launch agents on a task,
visualize placements (empty floorplan → phase snapshots → final), inspect the grading
pipeline's scoring + hard gates, and browse the leaderboard.

> The benchmark itself (tasks, grading, scoring, leaderboard data) lives in the separate
> open-source [`ricursive/pd-bench`](https://github.com/ricursive/pd-bench) repo and is
> pulled in here as the `vendor/pd-bench` submodule. This repo is the **presentation +
> launch ops** layer; that one is the **data + rules**.

```
web/        Next.js 16 + TS + Tailwind front end (datasheet UI, WebGL-free canvas renderer)
server/     FastAPI backend + run orchestration; deployable as a Modal app (server/app.py)
fixtures/   synthetic demo data (gen_fixture.py) for the static demo
vendor/     pd-bench submodule  → PDBENCH_REPO_ROOT (tasks, config, instruction, results)
```

## Clone

```bash
git clone --recurse-submodules https://github.com/bsflll/pd-bench-platform.git
# or, after a plain clone:  git submodule update --init
```

## Run the front end (no backend — embedded seed + synthetic fixture)

```bash
cd web && npm install && npm run dev        # http://localhost:3000
npm test                                    # vitest: DEF parser, scoring parity, render math
```

## Run the backend (mock orchestrator — no GPU/Modal)

```bash
cd server && uv venv .venv && uv pip install fastapi uvicorn pyyaml pydantic
PDBENCH_ADMIN_TOKEN=secret .venv/bin/python -m uvicorn main:app --port 8077
#   then: cd web && NEXT_PUBLIC_API_BASE=http://localhost:8077 npm run dev
```

The mock orchestrator reproduces a finished harbor job from the fixture, so the full
launch → grade → ingest → render cycle works with no GPU. Tests: `cd server && pytest`.

## Live (Modal)

`server/app.py` serves the API + the exported site from one Modal endpoint and runs real
`harbor run -e modal` jobs. See `server/MODAL_SEAM.md` for the Modal-in-Modal validation
step and the host-side fallback.

```bash
modal secret create pdbench MODAL_TOKEN_ID=… MODAL_TOKEN_SECRET=… PDBENCH_ADMIN_TOKEN=…
cd web && npm run export        # static site → web/out
modal deploy server/app.py
```

- Launching is **admin-token gated** (it spends real GPU time). Each run takes the
  submitter's own agent LLM key, injected into harbor's `--ae` template and never stored.
- The Modal token lives only in a Modal Secret / gitignored `.env` — never committed.

## Tasks & previews

The home gallery is driven by `web/public/prerender/index.json` (the task registry). The
live ariane133 task ships a **synthetic** sample-solution preview until a real oracle
(`harbor -a oracle -e modal`) run replaces it; other tasks are roadmap (`planned`) cards.
Regenerate a preview with `cd web && npx tsx scripts/prerender.mts`.

Design docs: `docs/superpowers/specs` and `docs/superpowers/plans`.
