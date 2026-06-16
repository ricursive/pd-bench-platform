"""`pd` — read-only perception + versioning for physical design.

Verbs are perception (view/status/diff/log/ls/show) and versioning (commit).
There are deliberately NO mutation verbs: the agent changes the design with its
own EDA tools; pd only observes the resulting DEF and tracks it — like git over
an editor.
"""

from __future__ import annotations

import argparse
import pathlib
import re

from ._bench import def_checks
from .model import load as load_design, Design
from .store import Repo
from . import views, diff as diffmod


def _lef_macros(repo: Repo) -> dict:
    return def_checks.parse_lef_macros(pathlib.Path(repo.config()["lef"]).read_text())


def _design_at(repo: Repo, ref: str):
    rec = repo.resolve(ref)
    if rec is None:
        raise SystemExit(f"no such commit: {ref}")
    return load_design(repo.blob(rec["sha"]), _lef_macros(repo)), rec


def _reference(repo: Repo):
    base = repo.config().get("base_ref")
    return _design_at(repo, base)[0] if base else None


def _metrics(design: Design, reference, lef, halo) -> dict:
    from . import metrics
    gates = metrics.gate_report(design, reference, lef, halo)
    return {
        "hpwl_proxy": metrics.hpwl_proxy(design),
        "placed": len(design.placed_cells()),
        "cells": len(design.cells()),
        "gates": {g["gate"]: g["ok"] for g in gates},
        "valid": all(g["ok"] for g in gates),
    }


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="pd", description=__doc__)
    p.add_argument("--root", type=pathlib.Path, default=pathlib.Path.cwd())
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("init"); s.add_argument("--lef", required=True); s.add_argument("--halo", type=float, default=2.0)
    s = sub.add_parser("commit"); s.add_argument("def_path", type=pathlib.Path); s.add_argument("-m", "--message", default=""); s.add_argument("--stage", default="")
    s.add_argument("--lef"); s.add_argument("--halo", type=float, default=2.0)  # for implicit init
    sub.add_parser("log")
    sub.add_parser("ls")
    s = sub.add_parser("status"); s.add_argument("ref", nargs="?", default="HEAD"); s.add_argument("--def", dest="defp", type=pathlib.Path)
    s = sub.add_parser("view"); s.add_argument("target", nargs="?", default=""); s.add_argument("--context", action="store_true"); s.add_argument("--ref", default="HEAD"); s.add_argument("--def", dest="defp", type=pathlib.Path)
    s = sub.add_parser("diff"); s.add_argument("a"); s.add_argument("b")
    args = p.parse_args(argv)

    repo = Repo(args.root)

    if args.cmd == "init":
        repo.init(lef=str(pathlib.Path(args.lef).resolve()), halo_um=args.halo)
        print(f"initialized .pd at {repo.dir}")
        return 0

    if args.cmd == "commit":
        if not repo.initialized:
            if not args.lef:
                raise SystemExit("repo not initialized; pass --lef (and --halo) or run `pd init`")
            repo.init(lef=str(pathlib.Path(args.lef).resolve()), halo_um=args.halo)
        text = args.def_path.read_text()
        lef = _lef_macros(repo)
        design = load_design(text, lef)
        reference = _reference(repo)
        m = _metrics(design, reference, lef, repo.config()["halo_um"])
        rec = repo.commit(text, args.message, stage=args.stage, metrics=m)
        print(f"[{rec['id']}] {args.message}   valid={int(m['valid'])} placed={m['placed']}/{m['cells']} HPWL~{m['hpwl_proxy']:,}")
        return 0

    if args.cmd == "log":
        for c in repo.log():
            mm = c.get("metrics", {})
            print(f"{c['id']}  valid={int(mm.get('valid', 0))}  HPWL~{mm.get('hpwl_proxy', 0):,}  {c['message']}")
        return 0

    # remaining verbs need a design + lef + reference
    halo = repo.config()["halo_um"] if repo.initialized else 2.0
    lef = _lef_macros(repo) if repo.initialized else {}

    def load_target(defp, ref):
        if defp:
            return load_design(defp.read_text(), lef), None
        return _design_at(repo, ref)

    if args.cmd == "ls":
        design, _ = _design_at(repo, "HEAD")
        print(views.ls(design)); return 0

    if args.cmd == "status":
        design, _ = load_target(args.defp, args.ref)
        print(views.status(design, _reference(repo), lef, halo)); return 0

    if args.cmd == "diff":
        a, _ = _design_at(repo, args.a)
        b, _ = _design_at(repo, args.b)
        print(diffmod.diff(a, b)); return 0

    if args.cmd == "view":
        design, _ = load_target(args.defp, args.ref)
        print(_view(design, args.target, args.context, _reference(repo), lef, halo)); return 0

    return 0


def _view(design: Design, target: str, context: bool, reference, lef, halo) -> str:
    t = target.strip()
    if not t:
        return views.chip(design, reference, lef, halo)
    m = re.fullmatch(r"region\(?\s*(\d+)\s*[,\s]\s*(\d+)\s*\)?", t)
    if m:
        return views.region(design, int(m.group(1)), int(m.group(2)))
    if t in design.blocks():
        return views.block(design, t)
    return views.cell(design, t, context=context)


if __name__ == "__main__":
    raise SystemExit(main())
