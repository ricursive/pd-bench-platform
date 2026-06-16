"""The layout VCS: a content-addressed, read-only history of design states.

`pd` is to layout what git is to code: it versions and diffs, it does not
mutate. The agent changes the design with its own EDA tools (OpenROAD, TCL);
pd snapshots the resulting DEF and lets the design be inspected over time.

.pd/
  config.json          {lef, halo_um, base_ref}
  objects/<sha>.def.gz  content-addressed DEF blobs (dedup'd)
  commits.jsonl         append-only: {id, parent, sha, message, stage, metrics, ts}
  HEAD                  current commit id
"""

from __future__ import annotations

import gzip
import hashlib
import json
import pathlib
from typing import Optional


class Repo:
    def __init__(self, root: pathlib.Path):
        self.root = root
        self.dir = root / ".pd"

    # ── lifecycle ────────────────────────────────────────────────────────
    def init(self, *, lef: str, halo_um: float) -> None:
        (self.dir / "objects").mkdir(parents=True, exist_ok=True)
        (self.dir / "config.json").write_text(json.dumps({"lef": lef, "halo_um": halo_um, "base_ref": None}, indent=2))
        if not (self.dir / "commits.jsonl").exists():
            (self.dir / "commits.jsonl").write_text("")

    @property
    def initialized(self) -> bool:
        return (self.dir / "config.json").is_file()

    def config(self) -> dict:
        return json.loads((self.dir / "config.json").read_text())

    # ── objects ──────────────────────────────────────────────────────────
    def _put(self, def_text: str) -> str:
        sha = hashlib.sha256(def_text.encode()).hexdigest()[:16]
        path = self.dir / "objects" / f"{sha}.def.gz"
        if not path.exists():
            path.write_bytes(gzip.compress(def_text.encode()))
        return sha

    def blob(self, sha: str) -> str:
        return gzip.decompress((self.dir / "objects" / f"{sha}.def.gz").read_bytes()).decode()

    # ── commits (versioning — the one intentional write) ──────────────────
    def commit(self, def_text: str, message: str, *, stage: str = "", metrics: Optional[dict] = None) -> dict:
        sha = self._put(def_text)
        log = self.log()
        parent = log[-1]["id"] if log else None
        cid = f"{len(log):04d}-{sha[:6]}"
        rec = {"id": cid, "parent": parent, "sha": sha, "message": message, "stage": stage, "metrics": metrics or {}}
        with (self.dir / "commits.jsonl").open("a") as fh:
            fh.write(json.dumps(rec) + "\n")
        (self.dir / "HEAD").write_text(cid)
        # the first commit is the floorplan baseline reference for the gates
        cfg = self.config()
        if cfg.get("base_ref") is None:
            cfg["base_ref"] = cid
            (self.dir / "config.json").write_text(json.dumps(cfg, indent=2))
        return rec

    def log(self) -> list[dict]:
        p = self.dir / "commits.jsonl"
        if not p.is_file():
            return []
        return [json.loads(l) for l in p.read_text().splitlines() if l]

    def head(self) -> Optional[str]:
        h = self.dir / "HEAD"
        return h.read_text().strip() if h.is_file() else None

    def resolve(self, ref: str) -> Optional[dict]:
        log = self.log()
        if not log:
            return None
        by_id = {c["id"]: c for c in log}
        ref = ref.strip()
        if ref in ("HEAD", "@"):
            return by_id.get(self.head() or log[-1]["id"])
        if ref.startswith("HEAD~"):
            n = int(ref[5:] or "0")
            idx = next(i for i, c in enumerate(log) if c["id"] == (self.head() or log[-1]["id"]))
            j = idx - n
            return log[j] if 0 <= j else None
        if ref in by_id:
            return by_id[ref]
        for c in log:  # prefix match on id or sha
            if c["id"].startswith(ref) or c["sha"].startswith(ref):
                return c
        return None
