# Modal orchestration seam

The platform launches real benchmark runs by shelling out to
`harbor run -e modal`. This note records how that runs in production and the
fallback if "Modal-in-Modal" turns out to be constrained on the account.

## Topology (primary)

```
browser ──POST /api/runs (admin)──► FastAPI (Modal ASGI web endpoint)
                                      │  RunManager.launch() spawns a worker
                                      ▼
                          HarborModalOrchestrator.run()
                                      │  subprocess: harbor run -e modal …
                                      ▼
                          harbor creates GPU + verifier SANDBOXES on Modal
                                      │  writes jobs/<job>/<trial>/…
                                      ▼
                          ingest_job() → Volume (runs/, index.jsonl)
```

- **Token:** the Modal token is a Modal **Secret** (`pdbench`), injected as
  env into the web container. The agent's LLM key arrives per-request, is
  exported into the harbor subprocess env (consumed by the `--ae` template),
  and is never written to the Volume or logged.
- **Persistence:** `PDBENCH_DATA_DIR` is a Modal **Volume** (`pdbench-data`),
  so runs + the leaderboard index survive restarts.

## The Modal-in-Modal question

`harbor -e modal` itself talks to the Modal API to create sandboxes. Running
that *from inside* a Modal function requires the Modal client to authenticate
outward from within the container. This is the one thing to confirm on the
target account before the first paid run:

- [ ] Confirm `modal` client calls succeed from inside a Modal function with
      the `pdbench` Secret mounted (a trivial `modal.Sandbox.create` smoke test).

## Fallback (same API contract, one swap)

If Modal-in-Modal is constrained, run the **orchestrator on a small always-on
host** (or a CI runner) that has the repo + `modal` + `harbor`, and deploy only
the web/API on Modal. `main.py` already supports this: set `PDBENCH_ORCH=modal`
and run `uvicorn main:app` on that host. Nothing else changes — the front end,
store, and ingest are identical.

## Cost gate

A real `-e modal` run provisions an `RTX-PRO-6000` for up to an hour and spends
real money. The admin-token gate exists for this reason. Do not wire the
first live run into CI; trigger it manually once to validate
(`oracle` agent → expect `valid 1, score 0.0`), then record the result.
