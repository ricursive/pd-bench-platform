"""FastAPI app implementing the platform contract (see web/lib/api.ts).

create_app() is parameterized by an Orchestrator so the same routes serve the
LocalMockOrchestrator (tests, dev, no GPU) and the live HarborModalOrchestrator.
"""

from __future__ import annotations

import json
import pathlib
import threading
import tomllib
import uuid

import yaml
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ingest import GATES, ingest_job
from orchestrator import Orchestrator
from spec import LaunchSpec, RunRecord
from store import RunStore


class LaunchBody(BaseModel):
    task: str
    agent: str
    model: str = ""
    agentKeyVar: str = "ANTHROPIC_API_KEY"
    agentKey: str = ""
    timeoutMult: float = 1.0


class RunManager:
    """Launches runs on background threads; never blocks a request."""

    def __init__(self, store: RunStore, orch: Orchestrator, jobs_root: pathlib.Path) -> None:
        self.store = store
        self.orch = orch
        self.jobs_root = jobs_root
        self.jobs_root.mkdir(parents=True, exist_ok=True)

    def launch(self, spec: LaunchSpec) -> str:
        run_id = "run_" + uuid.uuid4().hex[:10]
        job = f"pdbench-{run_id}"
        rec = RunRecord(
            run_id=run_id, task=spec.task, agent=spec.agent, model=spec.model,
            date="2026-06-13", job=job, status="queued",
        )
        self.store.save_meta(rec)
        threading.Thread(target=self._run, args=(spec, run_id, job), daemon=True).start()
        return run_id

    def _run(self, spec: LaunchSpec, run_id: str, job: str) -> None:
        try:
            self.store.set_status(run_id, "running")
            job_dir = self.orch.run(spec, job, self.jobs_root)
            self.store.set_status(run_id, "grading")
            rec = self.store.load_meta(run_id)
            assert rec
            ingest_job(self.store, run_id, rec, job_dir)
        except Exception as exc:  # never leave a run hung
            self.store.set_status(run_id, "error", error=f"{type(exc).__name__}: {exc}")


def read_task_detail(repo_root: pathlib.Path, task_id: str) -> dict:
    base = repo_root / "tasks" / "ricursive" / task_id
    toml_data = tomllib.loads((base / "task.toml").read_text())
    cfg = yaml.safe_load((base / "tests" / "config.yaml").read_text())
    instruction = (base / "instruction.md").read_text()
    labels = {"hpwl": ("HPWL", "dbu"), "tns_viol": ("TNS viol", "ps"),
              "wns_viol": ("WNS viol", "ps"), "cong_h": ("Cong H", ""), "cong_v": ("Cong V", "")}
    metrics = [
        {"key": k, "weight": cfg["weights"][k], "reference": cfg["reference"][k],
         "label": labels[k][0], "unit": labels[k][1]}
        for k in ("hpwl", "tns_viol", "wns_viol", "cong_h", "cong_v")
    ]
    env = toml_data.get("environment", {})
    return {
        "id": task_id,
        "name": toml_data["task"]["name"],
        "description": toml_data["task"]["description"],
        "difficulty": toml_data.get("metadata", {}).get("difficulty", "easy"),
        "status": "frozen",
        "authors": [a["name"] for a in toml_data["task"].get("authors", [])],
        "keywords": toml_data["task"].get("keywords", []),
        "resources": {
            "gpu": (env.get("gpu_types") or ["?"])[0],
            "cpus": env.get("cpus", 0),
            "memoryMb": env.get("memory_mb", 0),
            "agentTimeoutSec": toml_data.get("agent", {}).get("timeout_sec", 3600),
            "verifierMode": "separate · no-network",
        },
        "metrics": metrics,
        "epsilon": float(cfg["epsilon"]),
        "haloUm": float(cfg["gates"]["macro_halo_um"]),
        "clockPeriodPs": cfg["metrics"]["clock_period_ps"],
        "gates": [
            {"id": i + 1, "title": label, "detail": ""}
            for i, (_gid, label) in enumerate(GATES)
        ],
        "instruction": instruction,
        "floorplanDef": None,
        "lef": None,
    }


def create_app(
    store: RunStore,
    orch: Orchestrator,
    *,
    admin_token: str,
    repo_root: pathlib.Path,
) -> FastAPI:
    app = FastAPI(title="PD-Bench platform")
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
    )
    mgr = RunManager(store, orch, repo_root / "server_jobs")

    def require_admin(authorization: str = Header(default="")) -> None:
        token = authorization.removeprefix("Bearer ").strip()
        if not admin_token or token != admin_token:
            raise HTTPException(status_code=401, detail="admin token required")

    def summary_from_meta(rec: RunRecord) -> dict:
        detail = _load_detail(store, rec.run_id)
        reward = (detail or {}).get("reward_json") or {}
        return {
            "runId": rec.run_id, "task": rec.task.rsplit("/", 1)[-1], "agent": rec.agent,
            "model": rec.model or "-", "date": rec.date, "job": rec.job, "status": rec.status,
            "valid": rec.valid, "score": rec.score, "reward": rec.reward,
            "m_hpwl": reward.get("m_hpwl"), "m_tns_viol": reward.get("m_tns_viol"),
            "m_wns_viol": reward.get("m_wns_viol"),
        }

    @app.post("/api/runs")
    def post_run(body: LaunchBody, _: None = Depends(require_admin)) -> dict:
        spec = LaunchSpec(
            task=body.task, agent=body.agent, model=body.model,
            agent_key_var=body.agentKeyVar, agent_key=body.agentKey, timeout_mult=body.timeoutMult,
        )
        return {"runId": mgr.launch(spec)}

    @app.get("/api/runs")
    def list_runs() -> list[dict]:
        return [summary_from_meta(r) for r in store.list_records()]

    @app.get("/api/leaderboard")
    def leaderboard() -> list[dict]:
        live = [summary_from_meta(r) for r in store.list_records() if r.status == "done"]
        seen = {s["runId"] for s in live}
        for row in store.index_rows():
            rid = row.get("runId") or row.get("trial")
            if rid in seen:
                continue
            live.append({
                "runId": rid, "task": row.get("task", ""), "agent": row.get("agent", ""),
                "model": row.get("model", "-"), "date": row.get("date", ""), "job": row.get("job", ""),
                "status": "done", "valid": row.get("valid", 0), "score": row.get("score", 0.0),
                "reward": row.get("reward", 0.0), "m_hpwl": row.get("m_hpwl"),
                "m_tns_viol": row.get("m_tns_viol"), "m_wns_viol": row.get("m_wns_viol"),
            })
            seen.add(rid)
        live.sort(key=lambda s: (-(s.get("score") or 0.0), s.get("date", "")))
        return live

    @app.get("/api/runs/{run_id}")
    def get_run(run_id: str) -> dict:
        rec = store.load_meta(run_id)
        if not rec:
            raise HTTPException(status_code=404, detail="run not found")
        detail = _load_detail(store, run_id) or {}
        base = f"/api/runs/{run_id}/artifacts"
        placement = detail.get("placementDef")
        phases = [
            {**p, "def": f"{base}/{p['def']}"} for p in detail.get("phases", [])
        ]
        return {
            **summary_from_meta(rec),
            "reward_json": detail.get("reward_json"),
            "gates": detail.get("gates", []),
            "placementDef": f"{base}/{placement}" if placement else None,
            "lef": f"{base}/{detail['lef']}" if detail.get("lef") else None,
            "phases": phases,
            "logTail": detail.get("logTail"),
            "error": rec.error,
        }

    @app.get("/api/runs/{run_id}/artifacts/{path:path}")
    def get_artifact(run_id: str, path: str) -> FileResponse:
        f = store.artifact_dir(run_id) / path
        if not f.is_file() or ".." in path:
            raise HTTPException(status_code=404, detail="artifact not found")
        return FileResponse(f)

    @app.get("/api/tasks/{task_id}")
    def get_task(task_id: str) -> dict:
        try:
            return read_task_detail(repo_root, task_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="task not found")

    return app


def _load_detail(store: RunStore, run_id: str) -> dict | None:
    path = store.runs_dir / run_id / "detail.json"
    return json.loads(path.read_text()) if path.is_file() else None
