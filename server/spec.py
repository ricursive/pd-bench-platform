"""Core data types for the PD-Bench platform backend.

Deliberately dependency-light (stdlib dataclasses) so the orchestration and
store logic can be unit-tested without FastAPI/Modal. The JSON shapes here
match the front end's lib/types.ts (RunDetail / RunSummary).
"""

from __future__ import annotations

import dataclasses
from typing import Literal, Optional

RunStatus = Literal["queued", "running", "grading", "done", "error"]


@dataclasses.dataclass(frozen=True)
class LaunchSpec:
    """One launch request. agent_key is injected into harbor --ae, never stored."""

    task: str
    agent: str
    model: str
    agent_key_var: str = "ANTHROPIC_API_KEY"
    agent_key: str = ""
    timeout_mult: float = 1.0

    def harbor_command(self, job_name: str, jobs_root: str) -> list[str]:
        """The exact harbor CLI this spec maps to (secret stays templated)."""
        cmd = [
            "harbor", "run",
            "-p", f"tasks/{self.task}",
            "-a", self.agent,
        ]
        if self.model:
            cmd += ["-m", self.model]
        cmd += ["--ae", f"{self.agent_key_var}=${{{self.agent_key_var}}}"]
        if self.timeout_mult != 1.0:
            cmd += ["--agent-timeout-multiplier", str(self.timeout_mult)]
        cmd += ["-e", "modal", "--job-name", job_name, "-o", jobs_root]
        return cmd


@dataclasses.dataclass
class RunRecord:
    """Server-side record of a run, persisted as meta.json."""

    run_id: str
    task: str
    agent: str
    model: str
    date: str
    job: str
    status: RunStatus = "queued"
    valid: int = 0
    score: float = 0.0
    reward: float = 0.0
    error: Optional[str] = None

    def to_summary(self) -> dict:
        return dataclasses.asdict(self)
