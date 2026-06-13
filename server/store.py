"""Filesystem-backed run store + leaderboard index.

Layout under DATA_DIR:
  runs/<run_id>/meta.json          RunRecord
  runs/<run_id>/reward.json        verifier reward (numeric)
  runs/<run_id>/report.json        verifier diagnostics (gates)
  runs/<run_id>/artifacts/...      DEF, cells.lef, phases/
  index.jsonl                      append-only leaderboard rows (results.jsonl shape)

On Modal this DATA_DIR is a persisted Volume. The index rows match
leaderboard/results.jsonl so scripts/leaderboard.py stays the source of truth
for the committed board.
"""

from __future__ import annotations

import dataclasses
import json
import pathlib
from typing import Optional

from spec import RunRecord


class RunStore:
    def __init__(self, data_dir: pathlib.Path) -> None:
        self.data_dir = data_dir
        self.runs_dir = data_dir / "runs"
        self.index_path = data_dir / "index.jsonl"
        self.runs_dir.mkdir(parents=True, exist_ok=True)

    def run_dir(self, run_id: str) -> pathlib.Path:
        d = self.runs_dir / run_id
        d.mkdir(parents=True, exist_ok=True)
        return d

    def artifact_dir(self, run_id: str) -> pathlib.Path:
        d = self.run_dir(run_id) / "artifacts"
        d.mkdir(parents=True, exist_ok=True)
        return d

    # ── meta ────────────────────────────────────────────────────────────────
    def save_meta(self, rec: RunRecord) -> None:
        (self.run_dir(rec.run_id) / "meta.json").write_text(
            json.dumps(dataclasses.asdict(rec), indent=2)
        )

    def load_meta(self, run_id: str) -> Optional[RunRecord]:
        path = self.runs_dir / run_id / "meta.json"
        if not path.is_file():
            return None
        return RunRecord(**json.loads(path.read_text()))

    def set_status(self, run_id: str, status: str, **fields) -> None:
        rec = self.load_meta(run_id)
        if not rec:
            return
        rec.status = status  # type: ignore[assignment]
        for k, v in fields.items():
            setattr(rec, k, v)
        self.save_meta(rec)

    def list_records(self) -> list[RunRecord]:
        out: list[RunRecord] = []
        for d in sorted(self.runs_dir.iterdir()):
            rec = self.load_meta(d.name)
            if rec:
                out.append(rec)
        return out

    # ── leaderboard index (results.jsonl shape) ──────────────────────────────
    def append_index(self, row: dict) -> None:
        with self.index_path.open("a") as fh:
            fh.write(json.dumps(row) + "\n")

    def index_rows(self) -> list[dict]:
        if not self.index_path.is_file():
            return []
        return [json.loads(line) for line in self.index_path.read_text().splitlines() if line]

    def seed_from_results(self, results_jsonl: pathlib.Path) -> int:
        """Import committed leaderboard rows once (idempotent on run_id+job)."""
        if not results_jsonl.is_file() or self.index_path.exists():
            return 0
        n = 0
        for line in results_jsonl.read_text().splitlines():
            if line.strip():
                self.append_index(json.loads(line))
                n += 1
        return n
