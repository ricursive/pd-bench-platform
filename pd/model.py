"""A render-ready, hierarchy-aware view of a parsed DEF.

Built on top of the benchmark's `def_checks.parse_def`, so instance/net/gate
semantics match the verifier exactly.
"""

from __future__ import annotations

import dataclasses
from typing import Iterable

from ._bench import def_checks

_PLACED = frozenset({"PLACED", "FIXED", "COVER"})
_DEFAULT_CELL_UM = (0.2, 1.08)  # fallback footprint for unknown masters


@dataclasses.dataclass
class Inst:
    name: str
    master: str
    status: str
    x: int
    y: int
    orient: str
    w: int  # bbox width, dbu
    h: int  # bbox height, dbu
    is_macro: bool
    block: str

    @property
    def placed(self) -> bool:
        return self.status in _PLACED

    @property
    def cx(self) -> float:
        return self.x + self.w / 2

    @property
    def cy(self) -> float:
        return self.y + self.h / 2


@dataclasses.dataclass
class Design:
    dbu: int
    die: tuple[int, int, int, int]  # x0,y0,x1,y1
    insts: dict[str, Inst]
    nets: dict[str, tuple[tuple[str, str], ...]]
    pins: list[tuple[str, int, int]]  # name, x, y
    raw: object  # the def_checks.DefDesign (for gates)

    # ── selectors ────────────────────────────────────────────────────────
    def macros(self) -> list[Inst]:
        return [i for i in self.insts.values() if i.is_macro]

    def cells(self) -> list[Inst]:
        return [i for i in self.insts.values() if not i.is_macro]

    def placed_cells(self) -> list[Inst]:
        return [i for i in self.cells() if i.placed]

    def unplaced(self) -> list[Inst]:
        return [i for i in self.insts.values() if not i.placed]

    def blocks(self) -> dict[str, list[Inst]]:
        out: dict[str, list[Inst]] = {}
        for i in self.insts.values():
            out.setdefault(i.block, []).append(i)
        return dict(sorted(out.items()))

    def in_bbox(self, bbox: tuple[int, int, int, int], placed_only: bool = True) -> Iterable[Inst]:
        x0, y0, x1, y1 = bbox
        for i in self.insts.values():
            if placed_only and not i.placed:
                continue
            if i.cx >= x0 and i.cx < x1 and i.cy >= y0 and i.cy < y1:
                yield i

    @property
    def die_w(self) -> int:
        return self.die[2] - self.die[0]

    @property
    def die_h(self) -> int:
        return self.die[3] - self.die[1]


def _block_of(name: str) -> str:
    return name.split("/", 1)[0] if "/" in name else "(top)"


def load(def_text: str, lef_macros: dict) -> Design:
    d = def_checks.parse_def(def_text)
    dbu = d.dbu_per_micron or 1000
    (x0, y0), (x1, y1) = d.diearea if d.diearea else ((0, 0), (0, 0))
    insts: dict[str, Inst] = {}
    for name, c in d.components.items():
        macro = lef_macros.get(c.master)
        if macro is not None:
            bx0, by0, bx1, by1 = def_checks._bbox(c, macro, dbu)
            w, h, is_macro = bx1 - bx0, by1 - by0, macro.is_block
        else:
            w = int(_DEFAULT_CELL_UM[0] * dbu)
            h = int(_DEFAULT_CELL_UM[1] * dbu)
            is_macro = False
        insts[name] = Inst(
            name=name, master=c.master, status=c.status, x=c.x, y=c.y,
            orient=c.orient, w=w, h=h, is_macro=is_macro, block=_block_of(name),
        )
    pins = [(p.name, p.x, p.y) for p in d.pins.values()]
    return Design(dbu=dbu, die=(x0, y0, x1, y1), insts=insts, nets=d.nets, pins=pins, raw=d)
