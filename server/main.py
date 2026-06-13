"""Dev/standalone entrypoint: `uvicorn main:app` (run from server/).

Builds the app from env:
  PDBENCH_ADMIN_TOKEN   admin bearer token required to launch (default: dev-token)
  PDBENCH_DATA_DIR      run store dir (default: ./server_data)
  PDBENCH_ORCH          "mock" (default) | "modal"
  PDBENCH_REPO_ROOT     repo root (default: parent of server/)

For the live Modal deployment see server/app.py.
"""

from __future__ import annotations

import os
import pathlib

from api import create_app
from orchestrator import HarborModalOrchestrator, LocalMockOrchestrator
from store import RunStore

REPO_ROOT = pathlib.Path(os.environ.get("PDBENCH_REPO_ROOT", pathlib.Path(__file__).resolve().parent.parent))
DATA_DIR = pathlib.Path(os.environ.get("PDBENCH_DATA_DIR", REPO_ROOT / "server_data"))
ADMIN_TOKEN = os.environ.get("PDBENCH_ADMIN_TOKEN", "dev-token")

store = RunStore(DATA_DIR)
store.seed_from_results(REPO_ROOT / "leaderboard" / "results.jsonl")

if os.environ.get("PDBENCH_ORCH") == "modal":
    orch = HarborModalOrchestrator(REPO_ROOT)
else:
    orch = LocalMockOrchestrator(REPO_ROOT / "fixtures" / "ariane133")

app = create_app(store, orch, admin_token=ADMIN_TOKEN, repo_root=REPO_ROOT)
