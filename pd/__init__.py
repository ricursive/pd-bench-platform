"""pd — GitHub for physical design.

A read-only, LLM-legible, version-controlled representation of physical-design
state: hierarchical/zoomable text views + a content-addressed history with
physically-meaningful diffs. Perception + versioning only — the agent brings
its own EDA tools and engineering.
"""

from .model import load, Design, Inst
from .store import Repo
from . import views, diff, metrics

__all__ = ["load", "Design", "Inst", "Repo", "views", "diff", "metrics"]
