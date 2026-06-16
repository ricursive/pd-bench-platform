"""Cheap, instant metrics for the perception layer (no OpenROAD).

These are *indicators* for the agent to reason with, computed from geometry
alone. The authoritative HPWL/timing/congestion still come from the verifier's
OpenROAD pass — pd never claims to replace it, only to make the design legible.
"""

from __future__ import annotations

from .model import Design
from ._bench import def_checks


def hpwl_proxy(design: Design) -> int:
    """Σ over nets of the bounding box (W+H) of connected instance centers, dbu.

    Instance-center approximation (no pin offsets) — a fast proxy, not the
    OpenDB term-bbox HPWL the verifier reports.
    """
    total = 0
    for terms in design.nets.values():
        xs: list[float] = []
        ys: list[float] = []
        for inst_name, _pin in terms:
            inst = design.insts.get(inst_name)
            if inst is None or not inst.placed:
                continue
            xs.append(inst.cx)
            ys.append(inst.cy)
        if len(xs) >= 2:
            total += int((max(xs) - min(xs)) + (max(ys) - min(ys)))
    return total


def gate_report(design: Design, reference: Design | None, lef_macros: dict, halo_um: float) -> list[dict]:
    """Run the verifier's pure-Python gates; return per-gate pass/fail + offenders."""
    out: list[dict] = []
    if reference is not None:
        out.append(_g("floorplan_unchanged", def_checks.check_floorplan_unchanged(reference.raw, design.raw)))
        out.append(_g("component_set_unchanged", def_checks.check_components_unchanged(reference.raw, design.raw)))
    out.append(_g("all_placed", def_checks.check_all_placed(design.raw)))
    out.append(_g("macro_halos", def_checks.check_macro_halos(design.raw, lef_macros, halo_um)))
    return out


def _g(name: str, failures: list[str]) -> dict:
    return {"gate": name, "ok": not failures, "failures": failures}
