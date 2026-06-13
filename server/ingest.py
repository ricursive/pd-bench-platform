"""Turn a finished harbor job dir into a RunDetail + leaderboard row.

Reuses the same job-dir conventions as scripts/leaderboard.py: per trial,
read verifier/reward.json (+ optional report.json), collect the placement DEF
and any phase snapshots from the agent artifacts. The DEF files are copied
into the run's artifact dir and served raw — the front end parses them with
the same TS parser it uses for the fixture.
"""

from __future__ import annotations

import json
import pathlib
import shutil
from typing import Optional

from spec import RunRecord
from store import RunStore

# Canonical hard gates (match the front end's seed + the task instruction).
GATES = [
    ("floorplan_unchanged", "Floorplan unchanged"),
    ("component_set_unchanged", "Component set unchanged"),
    ("all_placed", "Legal placement"),
    ("check_placement", "check_placement passes"),
]

# How report.json gate keys map onto the canonical gates (best effort).
_REPORT_FAIL_KEYS = {
    "floorplan_unchanged": "floorplan_unchanged",
    "component_set_unchanged": "component_set_unchanged",
    "all_placed": "all_placed",
    "macro_halos": "all_placed",
    "check_placement": "check_placement",
    "submission_exists": "all_placed",
}


def build_gates(report: Optional[dict], valid: int) -> list[dict]:
    failed: dict[str, str] = {}
    if report:
        for key, val in (report.get("gates") or {}).items():
            if isinstance(val, list):  # a list of failures => that gate failed
                canonical = _REPORT_FAIL_KEYS.get(key, "all_placed")
                failed[canonical] = "; ".join(str(x) for x in val)[:200]
    out = []
    for gid, label in GATES:
        if gid in failed:
            out.append({"gate": gid, "label": label, "status": "fail", "detail": failed[gid]})
        elif valid:
            out.append({"gate": gid, "label": label, "status": "pass"})
        else:
            # invalid but we couldn't attribute the failure precisely
            out.append({"gate": gid, "label": label, "status": "pass"})
    if not valid and not failed and out:
        out[2] = {"gate": "all_placed", "label": "Legal placement", "status": "fail",
                  "detail": "a hard gate failed during this run → reward 0"}
    return out


def _find_trial(job_dir: pathlib.Path) -> Optional[pathlib.Path]:
    for d in sorted(job_dir.iterdir()):
        if (d / "verifier" / "reward.json").is_file():
            return d
    return None


def ingest_job(
    store: RunStore,
    run_id: str,
    rec: RunRecord,
    job_dir: pathlib.Path,
) -> RunRecord:
    """Parse the job, copy artifacts, persist meta + index row. Returns rec."""
    trial = _find_trial(job_dir)
    if trial is None:
        rec.status = "error"
        rec.error = "no trial with reward.json in job dir"
        store.save_meta(rec)
        return rec

    reward = json.loads((trial / "verifier" / "reward.json").read_text())
    report_path = trial / "verifier" / "report.json"
    report = json.loads(report_path.read_text()) if report_path.is_file() else None

    rec.valid = int(reward.get("valid", 0))
    rec.score = float(reward.get("score", 0.0))
    rec.reward = float(reward.get("reward", 0.0))
    rec.status = "done"

    # persist verifier outputs
    (store.run_dir(run_id) / "reward.json").write_text(json.dumps(reward, indent=2))
    if report:
        (store.run_dir(run_id) / "report.json").write_text(json.dumps(report, indent=2))

    # collect placement artifacts (DEF + phases + lef)
    art_src = trial / "agent" / "artifacts"
    art_dst = store.artifact_dir(run_id)
    phases: list[dict] = []
    placement_def = None
    if art_src.is_dir():
        for f in art_src.glob("*.def"):
            shutil.copy(f, art_dst / f.name)
            if "placed" in f.name:
                placement_def = f.name
        for f in art_src.glob("*.lef"):
            shutil.copy(f, art_dst / f.name)
        psrc = art_src / "phases"
        if psrc.is_dir():
            (art_dst / "phases").mkdir(exist_ok=True)
            for f in psrc.iterdir():
                shutil.copy(f, art_dst / "phases" / f.name)
            manifest = psrc / "phases.json"
            if manifest.is_file():
                for ph in json.loads(manifest.read_text()):
                    phases.append({**ph, "def": f"phases/{pathlib.Path(ph['def']).name}"})

    detail = {
        "placementDef": placement_def,
        "lef": "cells.lef" if (art_dst / "cells.lef").is_file() else None,
        "phases": phases,
        "reward_json": reward,
        "gates": build_gates(report, rec.valid),
        "logTail": (trial / "agent" / "transcript.txt").read_text()[-1200:]
        if (trial / "agent" / "transcript.txt").is_file()
        else None,
    }
    (store.run_dir(run_id) / "detail.json").write_text(json.dumps(detail, indent=2))

    store.save_meta(rec)
    store.append_index(
        {
            "runId": rec.run_id,
            "date": rec.date,
            "task": rec.task.rsplit("/", 1)[-1],
            "agent": rec.agent,
            "model": rec.model or "-",
            "job": rec.job,
            "trial": trial.name,
            "reward": rec.reward,
            "score": rec.score,
            "valid": rec.valid,
            **{k: reward[k] for k in ("m_hpwl", "m_tns_viol", "m_wns_viol", "m_cong_h", "m_cong_v") if k in reward},
        }
    )
    return rec
