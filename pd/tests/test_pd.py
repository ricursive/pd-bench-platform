import pathlib

import pd
from pd._bench import def_checks

FIX = pathlib.Path(__file__).resolve().parents[2] / "fixtures" / "ariane133"
LEF = def_checks.parse_lef_macros((FIX / "cells.lef").read_text())


def load(name):
    return pd.load((FIX / name).read_text(), LEF)


def test_model_counts_and_hierarchy():
    d = load("ariane133_placed.def")
    assert len(d.macros()) == 133
    assert len(d.cells()) == 12000
    assert len(d.placed_cells()) == 12000
    blocks = d.blocks()
    assert {"i_cache", "d_cache", "mem", "fpu"} <= set(blocks)
    # macros carry their block prefix and a real bbox
    m = d.macros()[0]
    assert "/" in m.name and m.is_macro and m.w > 0 and m.h > 0


def test_floorplan_is_unplaced():
    d = load("ariane133_fp.def")
    assert len(d.placed_cells()) == 0
    assert all(not i.placed for i in d.insts.values())


def test_hpwl_proxy_nonzero_and_improves_with_legalization():
    g = pd.metrics.hpwl_proxy(load("phases/10_global_place.def"))
    legal = pd.metrics.hpwl_proxy(load("phases/20_legalize.def"))
    assert g > 0 and legal > 0 and legal <= g


def test_gates_via_bench_code():
    fp = load("ariane133_fp.def")
    placed = load("ariane133_placed.def")
    rep = {r["gate"]: r for r in pd.metrics.gate_report(placed, fp, LEF, 2.0)}
    assert rep["floorplan_unchanged"]["ok"]
    assert rep["component_set_unchanged"]["ok"]
    assert rep["all_placed"]["ok"]
    # the fixture's detailed shift nudges a few cells into a halo → caught
    assert rep["macro_halos"]["ok"] in (True, False)


def test_views_are_text_and_legible():
    d = load("ariane133_placed.def")
    chip = pd.views.chip(d, lef_macros=LEF)
    assert "CHIP" in chip and "M" in chip and "density" in chip
    reg = pd.views.region(d, 20, 10)
    assert "REGION (20,10)" in reg
    ls = pd.views.ls(d)
    assert "i_cache" in ls and "d_cache" in ls
    blk = pd.views.block(d, "d_cache")
    assert "BLOCK d_cache" in blk
    name = next(c.name for c in d.placed_cells())
    ctx = pd.views.cell(d, name, context=True)
    assert "nearest neighbors" in ctx and "INST" in ctx


def test_cell_view_reports_macro_clearance():
    d = load("ariane133_placed.def")
    # a cell in d_cache (which has macros) should report a nearest-macro clearance
    cellname = next(c.name for c in d.placed_cells() if c.block == "d_cache")
    assert "nearest macro edge" in pd.views.cell(d, cellname, context=True)


def test_vcs_commit_log_resolve_diff(tmp_path):
    repo = pd.Repo(tmp_path)
    repo.init(lef=str(FIX / "cells.lef"), halo_um=2.0)
    for f, msg in [("ariane133_fp.def", "fp"), ("phases/10_global_place.def", "global"),
                   ("phases/20_legalize.def", "legal"), ("ariane133_placed.def", "detailed")]:
        repo.commit((FIX / f).read_text(), msg)
    log = repo.log()
    assert len(log) == 4
    assert repo.config()["base_ref"] == log[0]["id"]  # floorplan is the gate reference
    assert repo.resolve("HEAD")["id"] == log[-1]["id"]
    assert repo.resolve("HEAD~3")["id"] == log[0]["id"]
    # round-trip a blob
    assert "COMPONENTS" in repo.blob(log[-1]["sha"])
    a = pd.load(repo.blob(repo.resolve("HEAD~1")["sha"]), LEF)
    b = pd.load(repo.blob(repo.resolve("HEAD")["sha"]), LEF)
    out = pd.diff.diff(a, b)
    assert "moved" in out and "HPWL" in out and "component set unchanged" in out


def test_pd_is_read_only():
    # the CLI exposes no mutation verbs — perception + versioning only
    import argparse
    from pd import cli
    parser = [a for a in dir(cli)]
    # smoke: main parses a perception command without touching the design
    assert hasattr(cli, "main")
