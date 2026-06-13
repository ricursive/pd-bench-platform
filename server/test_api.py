import pathlib
import time

from fastapi.testclient import TestClient

from api import create_app
from orchestrator import LocalMockOrchestrator
from store import RunStore

REPO = pathlib.Path(__file__).resolve().parent.parent
FIX = REPO / "fixtures" / "ariane133"
ADMIN = "test-admin-token"


def make_client(tmp_path):
    store = RunStore(tmp_path / "data")
    orch = LocalMockOrchestrator(FIX)
    app = create_app(store, orch, admin_token=ADMIN, repo_root=REPO)
    return TestClient(app), store


def launch_body():
    return {
        "task": "ricursive/ariane133-asap7-mixed-placement",
        "agent": "codex", "model": "gpt-5.3-codex",
        "agentKeyVar": "OPENAI_API_KEY", "agentKey": "sk-x", "timeoutMult": 1.0,
    }


def wait_done(client, run_id, timeout=10):
    for _ in range(int(timeout * 20)):
        r = client.get(f"/api/runs/{run_id}").json()
        if r["status"] in ("done", "error"):
            return r
        time.sleep(0.05)
    raise AssertionError("run did not finish")


def test_launch_requires_admin(tmp_path):
    client, _ = make_client(tmp_path)
    assert client.post("/api/runs", json=launch_body()).status_code == 401
    assert client.post("/api/runs", json=launch_body(), headers={"authorization": "Bearer wrong"}).status_code == 401


def test_launch_and_full_run(tmp_path):
    client, _ = make_client(tmp_path)
    resp = client.post("/api/runs", json=launch_body(), headers={"authorization": f"Bearer {ADMIN}"})
    assert resp.status_code == 200
    run_id = resp.json()["runId"]

    run = wait_done(client, run_id)
    assert run["status"] == "done" and run["valid"] == 1 and run["score"] > 0
    assert run["reward_json"]["m_hpwl"] == 728344038.0
    assert run["placementDef"].endswith("ariane133_placed.def")
    assert len(run["phases"]) >= 4
    assert all(g["status"] == "pass" for g in run["gates"])

    # artifact is fetchable + is a real DEF
    art = client.get(run["placementDef"])
    assert art.status_code == 200 and "COMPONENTS" in art.text

    # leaderboard + listing include the run
    lb = client.get("/api/leaderboard").json()
    assert any(s["runId"] == run_id for s in lb)
    assert any(s["runId"] == run_id for s in client.get("/api/runs").json())


def test_task_endpoint(tmp_path):
    client, _ = make_client(tmp_path)
    task = client.get("/api/tasks/ariane133-asap7-mixed-placement").json()
    assert task["name"] == "ricursive/ariane133-asap7-mixed-placement"
    assert {m["key"] for m in task["metrics"]} == {"hpwl", "tns_viol", "wns_viol", "cong_h", "cong_v"}
    assert task["metrics"][0]["reference"] == 781044057
    assert task["haloUm"] == 2.0
    assert "Deliverable" in task["instruction"]


def test_missing_run_404(tmp_path):
    client, _ = make_client(tmp_path)
    assert client.get("/api/runs/nope").status_code == 404


def test_path_traversal_rejected(tmp_path):
    client, _ = make_client(tmp_path)
    # malicious task id / run id / artifact path must not escape their roots
    assert client.get("/api/tasks/..%2f..%2f..%2fetc").status_code == 404
    assert client.get("/api/tasks/%2e%2e").status_code == 404
    assert client.get("/api/runs/..%2f..").status_code == 404
    # a real run, then try to climb out of its artifact dir
    rid = client.post("/api/runs", json=launch_body(), headers={"authorization": f"Bearer {ADMIN}"}).json()["runId"]
    wait_done(client, rid)
    assert client.get(f"/api/runs/{rid}/artifacts/..%2f..%2f..%2fmeta.json").status_code == 404
    assert client.get(f"/api/runs/{rid}/artifacts/%2fetc%2fpasswd").status_code == 404
