"""Modal deployment: one ASGI web endpoint serving the API + the exported site.

    modal serve server/app.py     # local dev against Modal (free; no GPU)
    modal deploy server/app.py    # production

Requires (set once):
    modal secret create pdbench \
        MODAL_TOKEN_ID=… MODAL_TOKEN_SECRET=… PDBENCH_ADMIN_TOKEN=…

See server/MODAL_SEAM.md for the orchestration topology + the host-side
fallback. This module is only imported when `modal` is installed
(the optional `modal` extra); the tests never touch it.
"""

from __future__ import annotations

import pathlib

import modal

PLATFORM_ROOT = pathlib.Path(__file__).resolve().parent.parent
BENCH_ROOT = PLATFORM_ROOT / "vendor" / "pd-bench"  # pd-bench submodule

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("fastapi>=0.115", "uvicorn>=0.30", "pyyaml>=6.0", "pydantic>=2.7", "harbor==0.13.2")
    # benchmark (the pd-bench submodule) → /bench ; platform server + site
    .add_local_dir(BENCH_ROOT, "/bench")
    .add_local_dir(PLATFORM_ROOT / "fixtures", "/repo/fixtures")
    .add_local_dir(PLATFORM_ROOT / "server", "/repo/server")
    .add_local_dir(PLATFORM_ROOT / "web" / "out", "/repo/web/out")
)

app = modal.App("pd-bench")
data_volume = modal.Volume.from_name("pdbench-data", create_if_missing=True)


@app.function(
    image=image,
    volumes={"/data": data_volume},
    secrets=[modal.Secret.from_name("pdbench")],
    timeout=3600,
    min_containers=1,
)
@modal.concurrent(max_inputs=50)
@modal.asgi_app()
def web():
    import os
    import sys

    sys.path.insert(0, "/repo/server")
    os.environ.setdefault("PDBENCH_DATA_DIR", "/data")
    os.environ["PDBENCH_REPO_ROOT"] = "/bench"
    os.environ.setdefault("PDBENCH_ORCH", "modal")

    from fastapi.staticfiles import StaticFiles

    from api import create_app
    from orchestrator import HarborModalOrchestrator
    from store import RunStore

    bench = pathlib.Path("/bench")  # the pd-bench benchmark
    store = RunStore(pathlib.Path(os.environ["PDBENCH_DATA_DIR"]))
    store.seed_from_results(bench / "leaderboard" / "results.jsonl")
    orch = HarborModalOrchestrator(bench)
    fastapi_app = create_app(
        store, orch,
        admin_token=os.environ.get("PDBENCH_ADMIN_TOKEN", ""),
        repo_root=bench,
    )
    # API routes are registered above; mount the static export last so it
    # only catches paths the API didn't claim.
    out = pathlib.Path("/repo/web/out")
    if out.is_dir():
        fastapi_app.mount("/", StaticFiles(directory=str(out), html=True), name="site")
    return fastapi_app
