"""Physically-meaningful, textual diff between two design states."""

from __future__ import annotations

import math

from .model import Design
from . import metrics, views


def diff(a: Design, b: Design) -> str:
    na, nb = set(a.insts), set(b.insts)
    added, removed = nb - na, na - nb
    moves = []
    for name in na & nb:
        ia, ib = a.insts[name], b.insts[name]
        if ia.placed and ib.placed and (ia.x != ib.x or ia.y != ib.y):
            d = math.hypot(ib.x - ia.x, ib.y - ia.y) / a.dbu
            moves.append((d, name, (ia.x, ia.y), (ib.x, ib.y)))
    moves.sort(reverse=True)

    lines = ["DIFF a..b"]
    if added or removed:
        lines.append(f"  ✗ component set changed: +{len(added)} / -{len(removed)}  (a hard gate)")
        for n in list(added)[:3]:
            lines.append(f"      added   {n}")
        for n in list(removed)[:3]:
            lines.append(f"      removed {n}")
    else:
        lines.append("  ✓ component set unchanged")

    if moves:
        avg = sum(m[0] for m in moves) / len(moves)
        lines.append(f"  moved {len(moves)} insts (avg {avg:.2f}um, max {moves[0][0]:.2f}um)")
        for d, name, (ax, ay), (bx, by) in moves[:5]:
            lines.append(f"      {d:7.2f}um  {name}  ({ax},{ay})->({bx},{by})")
    else:
        lines.append("  no instances moved")

    # region density delta on the chip grid
    ga = views._counts(a, a.die, views.COLS, views.ROWS)
    gb = views._counts(b, b.die, views.COLS, views.ROWS)
    deltas = []
    for r in range(views.ROWS):
        for c in range(views.COLS):
            dd = gb[r][c] - ga[r][c]
            if dd:
                deltas.append((abs(dd), dd, c, r))
    deltas.sort(reverse=True)
    if deltas:
        lines.append("  region cell-count Δ (top):")
        for _, dd, c, r in deltas[:5]:
            lines.append(f"      ({c},{r})  {'+' if dd > 0 else ''}{dd}")

    ha, hb = metrics.hpwl_proxy(a), metrics.hpwl_proxy(b)
    pct = (hb - ha) / ha * 100 if ha else 0.0
    lines.append(f"  HPWL~ {ha:,} -> {hb:,} dbu  ({pct:+.1f}%)")
    return "\n".join(lines)
