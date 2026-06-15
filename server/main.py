"""Dev/standalone entrypoint: `uvicorn main:app` (run from server/).

Path roots:
  PLATFORM_ROOT   this repo (fixtures/, server_data/, jobs)
  BENCH_ROOT      the pd-bench benchmark (tasks/, config, instruction, results)
                  — the `vendor/pd-bench` git submodule by default.

Env:
  PDBENCH_ADMIN_TOKEN   admin bearer token required to launch (default: dev-token)
  PDBENCH_DATA_DIR      run store dir (default: <platform>/server_data)
  PDBENCH_ORCH          "mock" (default) | "modal"
  PDBENCH_REPO_ROOT     benchmark root (default: <platform>/vendor/pd-bench)

For the live Modal deployment see server/app.py.
"""

from __future__ import annotations

import os
import pathlib

from api import create_app
from orchestrator import HarborModalOrchestrator, LocalMockOrchestrator
from store import RunStore

PLATFORM_ROOT = pathlib.Path(__file__).resolve().parent.parent
BENCH_ROOT = pathlib.Path(os.environ.get("PDBENCH_REPO_ROOT", PLATFORM_ROOT / "vendor" / "pd-bench"))
DATA_DIR = pathlib.Path(os.environ.get("PDBENCH_DATA_DIR", PLATFORM_ROOT / "server_data"))
ADMIN_TOKEN = os.environ.get("PDBENCH_ADMIN_TOKEN", "dev-token")

store = RunStore(DATA_DIR)
store.seed_from_results(BENCH_ROOT / "leaderboard" / "results.jsonl")

if os.environ.get("PDBENCH_ORCH") == "modal":
    orch = HarborModalOrchestrator(BENCH_ROOT)
else:
    orch = LocalMockOrchestrator(PLATFORM_ROOT / "fixtures" / "ariane133")

app = create_app(store, orch, admin_token=ADMIN_TOKEN, repo_root=BENCH_ROOT)
