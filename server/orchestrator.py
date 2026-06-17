"""Run orchestration.

Both orchestrators produce the SAME harbor job-dir shape
(``<job>/config.json``, ``<job>/result.json``, ``<job>/<trial>/verifier/
reward.json`` + collected artifacts), so the ingest path (store.ingest_job)
is identical whether the run was real or mocked. This is what lets the whole
platform be validated on a box with no GPU/Modal before going live.
"""

from __future__ import annotations

import abc
import json
import pathlib
import shutil
import subprocess
from typing import Optional

from spec import LaunchSpec


class Orchestrator(abc.ABC):
    """Produces a harbor-shaped job directory for a launch spec."""

    @abc.abstractmethod
    def run(self, spec: LaunchSpec, job_name: str, jobs_root: pathlib.Path) -> pathlib.Path:
        """Execute (blocking) and return the job directory. Raise on failure."""


def _write_job_scaffold(job_dir: pathlib.Path, spec: LaunchSpec, trial: str) -> pathlib.Path:
    """Write the config.json/result.json harbor emits at the job + trial level."""
    job_dir.mkdir(parents=True, exist_ok=True)
    (job_dir / "config.json").write_text(
        json.dumps({"agents": [{"name": spec.agent, "model_name": spec.model}]}, indent=2)
    )
    (job_dir / "result.json").write_text(
        json.dumps({"started_at": "2026-06-13T00:00:00", "task_name": spec.task}, indent=2)
    )
    trial_dir = job_dir / trial
    (trial_dir / "verifier").mkdir(parents=True, exist_ok=True)
    (trial_dir / "agent").mkdir(parents=True, exist_ok=True)
    (trial_dir / "result.json").write_text(json.dumps({"task_name": spec.task}))
    return trial_dir


class LocalMockOrchestrator(Orchestrator):
    """Simulate a finished harbor run by copying the synthetic fixture.

    Useful for development and the API contract tests — no GPU, no Modal, no
    money. Produces a valid scored result (or a gate failure when
    ``force_invalid``) with the fixture's DEF + phase snapshots as artifacts.
    """

    def __init__(self, fixtures_dir: pathlib.Path, force_invalid: bool = False) -> None:
        self.fixtures = fixtures_dir
        self.force_invalid = force_invalid

    def run(self, spec: LaunchSpec, job_name: str, jobs_root: pathlib.Path) -> pathlib.Path:
        trial = f"{spec.task.rsplit('/', 1)[-1]}__MOCK{job_name[-4:]}"
        job_dir = jobs_root / job_name
        trial_dir = _write_job_scaffold(job_dir, spec, trial)

        artifacts = trial_dir / "agent" / "artifacts"
        (artifacts / "phases").mkdir(parents=True, exist_ok=True)

        if self.force_invalid:
            reward = {"reward": 0.0, "valid": 0, "score": 0.0}
            (trial_dir / "verifier" / "report.json").write_text(
                json.dumps({"result": "gate_failure", "gates": {"all_placed": ["unplaced cells"]}})
            )
        else:
            shutil.copy(self.fixtures / "ariane133_placed.def", artifacts / "ariane133_placed.def")
            shutil.copy(self.fixtures / "cells.lef", artifacts / "cells.lef")
            shutil.copy(self.fixtures / "ariane133_fp.def", artifacts / "phases" / "ariane133_fp.def")
            for f in sorted((self.fixtures / "phases").glob("*.def")):
                shutil.copy(f, artifacts / "phases" / f.name)
            shutil.copy(self.fixtures / "phases.json", artifacts / "phases" / "phases.json")
            # A representative scored reward (mirrors a real codex-class result).
            reward = {
                "reward": 0.0337, "valid": 1, "score": 3.37, "frozen": 1,
                "m_hpwl": 728344038.0, "m_tns_viol": 18228591.0, "m_wns_viol": 3082.0,
                "m_cong_h": 0.0, "m_cong_v": 0.0,
                "s_hpwl": 0.0675, "s_tns_viol": 0.0, "s_wns_viol": 0.0,
            }
            (trial_dir / "verifier" / "report.json").write_text(
                json.dumps({"result": "scored", "gates": {"pure_python": "pass", "check_placement": "pass"}})
            )
        (trial_dir / "verifier" / "reward.json").write_text(json.dumps(reward, indent=2))
        (trial_dir / "agent" / "transcript.txt").write_text(
            f"[mock] {spec.agent} ({spec.model}) placed ariane133 on asap7\n"
        )
        return job_dir


class HarborModalOrchestrator(Orchestrator):
    """Real orchestration: shell out to ``harbor run -e modal``.

    Runs inside a CPU Modal function (the Modal token is provided as a Modal
    Secret). harbor spawns the GPU + verifier sandboxes on Modal. See
    server/MODAL_SEAM.md for the Modal-in-Modal validation + the host-side
    fallback. The agent key is passed via the environment harbor templates
    into ``--ae`` and is never written to disk.
    """

    def __init__(self, repo_root: pathlib.Path, extra_args: Optional[list[str]] = None) -> None:
        self.repo_root = repo_root
        self.extra_args = extra_args or []

    def run(self, spec: LaunchSpec, job_name: str, jobs_root: pathlib.Path) -> pathlib.Path:
        import os

        cmd = spec.harbor_command(job_name, str(jobs_root)) + self.extra_args
        env = dict(os.environ)
        if spec.agent_key:
            env[spec.agent_key_var] = spec.agent_key  # consumed by harbor --ae template
        proc = subprocess.run(cmd, cwd=self.repo_root, env=env, capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError(f"harbor exited {proc.returncode}: {proc.stderr[-2000:]}")
        return jobs_root / job_name
