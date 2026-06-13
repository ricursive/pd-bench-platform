import json
import pathlib

from orchestrator import LocalMockOrchestrator
from spec import LaunchSpec, RunRecord
from store import RunStore
from ingest import ingest_job

REPO = pathlib.Path(__file__).resolve().parent.parent
FIX = REPO / "fixtures" / "ariane133"


def test_mock_orchestrator_produces_harbor_job(tmp_path):
    orch = LocalMockOrchestrator(FIX)
    spec = LaunchSpec(task="ricursive/ariane133-asap7-mixed-placement", agent="codex", model="gpt-5.3-codex")
    job = orch.run(spec, "job1", tmp_path / "jobs")
    assert (job / "result.json").is_file()
    assert (job / "config.json").is_file()
    trial = next(d for d in job.iterdir() if d.is_dir())
    reward = json.loads((trial / "verifier" / "reward.json").read_text())
    assert {"reward", "valid", "score"} <= set(reward)
    assert (trial / "agent" / "artifacts" / "ariane133_placed.def").is_file()


def test_ingest_builds_valid_run(tmp_path):
    orch = LocalMockOrchestrator(FIX)
    store = RunStore(tmp_path / "data")
    spec = LaunchSpec(task="ricursive/ariane133-asap7-mixed-placement", agent="codex", model="gpt-5.3-codex")
    job = orch.run(spec, "jobX", tmp_path / "jobs")
    rec = RunRecord(run_id="run_x", task=spec.task, agent="codex", model="gpt-5.3-codex", date="2026-06-13", job="jobX")
    store.save_meta(rec)
    ingest_job(store, "run_x", rec, job)

    assert rec.status == "done" and rec.valid == 1 and rec.score > 0
    detail = json.loads((store.run_dir("run_x") / "detail.json").read_text())
    assert detail["placementDef"] == "ariane133_placed.def"
    assert detail["lef"] == "cells.lef"
    assert len(detail["phases"]) >= 4
    assert (store.artifact_dir("run_x") / "phases" / "10_global_place.def").is_file()
    assert store.index_rows()[-1]["m_hpwl"] == 728344038.0


def test_harbor_command_templates_secret():
    spec = LaunchSpec(
        task="ricursive/ariane133-asap7-mixed-placement", agent="claude-code",
        model="claude-sonnet-4-6", agent_key_var="ANTHROPIC_API_KEY", agent_key="sk-secret",
        timeout_mult=0.25,
    )
    cmd = " ".join(spec.harbor_command("jobZ", "jobs"))
    assert "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}" in cmd  # templated, not the value
    assert "sk-secret" not in cmd
    assert "-e modal" in cmd and "--agent-timeout-multiplier 0.25" in cmd


def test_invalid_run_flattens_to_zero(tmp_path):
    orch = LocalMockOrchestrator(FIX, force_invalid=True)
    store = RunStore(tmp_path / "data")
    spec = LaunchSpec(task="ricursive/ariane133-asap7-mixed-placement", agent="claude-code", model="x")
    job = orch.run(spec, "jobF", tmp_path / "jobs")
    rec = RunRecord(run_id="run_f", task=spec.task, agent="claude-code", model="x", date="2026-06-13", job="jobF")
    store.save_meta(rec)
    ingest_job(store, "run_f", rec, job)
    assert rec.valid == 0 and rec.score == 0.0
    detail = json.loads((store.run_dir("run_f") / "detail.json").read_text())
    assert any(g["status"] == "fail" for g in detail["gates"])
