# Ariane133 / ASAP7 — Mixed-Size Placement

Produce a legal, high-quality mixed-size placement (133 SRAM macros
(`sram_asap7_16x256_1rw`) + ~100K standard cells) for the Ariane133
RISC-V core on the ASAP7 7nm predictive PDK.

## Inputs (read-only, baked into this image)

| Path | Contents |
|---|---|
| `/task/inputs/floorplan/ariane133_fp.def` | Fixed floorplan: die area, rows, tracks, placed I/O pins, **unplaced** components. Your starting point. |
| `/task/inputs/netlist/` | Synthesized gate-level netlist (Verilog). |
| `/task/inputs/asap7/lef/` | ASAP7 tech LEF, standard-cell LEF, SRAM macro LEF. |
| `/task/inputs/asap7/lib/` | Liberty timing libraries (std cells + SRAM macros). |
| `/task/inputs/constraints/ariane133.sdc` | Timing constraints (clock definition). |
| `/task/tools/DREAMPlace/` | DREAMPlace (GPU-accelerated analytical placer; `dreamplace/Placer.py`). |
| `/task/tools/xplace/` | Xplace (GPU-accelerated placement framework; `main.py`). |

OpenROAD (with Python/Tcl scripting and OpenDB) is installed and on
`PATH`. PyTorch 2.7 (CUDA 12.8) is installed; DREAMPlace and Xplace are
prebuilt for the provided GPU. Using them is optional — any flow that
produces a legal DEF counts. Your compute budget is the task timeout;
there are no call limits.

## Deliverable

Write your final placement as a single DEF file to:

```
/logs/artifacts/ariane133_placed.def
```

The DEF must be derived from the provided floorplan DEF: same design,
same floorplan, with every component placed.

## Hard gates — any failure scores 0

1. **Floorplan unchanged**: die area, rows, tracks, and pin placements
   must be identical to `ariane133_fp.def`.
2. **Component set unchanged**: the exact set of (instance, master)
   pairs from the input. No resizing, buffering, cloning, or deletion.
   Net connectivity must be unchanged.
3. **Legal placement**: every component has `PLACED` (or `FIXED`)
   status with a legal orientation; standard cells are on rows and
   site-aligned; no overlaps; every macro keeps a 2 µm halo clear of
   other macros and standard cells.
4. OpenROAD `check_placement` passes on your DEF.

## Score

If all gates pass, your reward is the weighted percent improvement over
a frozen baseline placement (the default OpenROAD flow), per metric:

```
s_m = max((ref_m - m) / ref_m, 0)
score = 100 * sum_m(w_m * s_m)        reward = score / 100
```

Matching the baseline scores 0; driving a metric to zero scores 1 on
that metric. Metrics whose baseline reference is already ~0 are dropped
and the remaining weights renormalize.

| Metric | Weight | Reference (baseline) | Definition |
|---|---|---|---|
| `hpwl` | 0.30 | 781044057 | Total HPWL, integer dbu, via OpenDB |
| `tns_viol` | 0.20 | 18228591 | −TNS (ps) after global route + estimated parasitics |
| `wns_viol` | 0.10 | 3082 | −WNS (ps), same analysis |
| `cong_h` | 0.20 | 0 (dropped) | Horizontal routing overflow from global route |
| `cong_v` | 0.20 | 0 (dropped) | Vertical routing overflow from global route |

The congestion references are 0 (the baseline routes congestion-free),
so those two metrics are dropped and the effective weights are
hpwl 1/2, tns_viol 1/3, wns_viol 1/6. Lower is better for every metric.

## Reproducing the score yourself

There is no built-in preview tool, but the verifier's measurement pass
is fully specified and you can replicate it with the installed OpenROAD
(the verifier recomputes everything independently in a separate
container — only the DEF you commit to `/logs/artifacts/` counts):

1. Read the three LEFs (tech, std cells, SRAM), all `.lib` files in
   lexicographic order, then your DEF.
2. `create_clock -name core_clock -period 900 [get_ports clk_i]`
   (period in ps) and `set_propagated_clock [all_clocks]`.
3. `hpwl` = sum over non-supply, non-special nets of
   `[$net getTermBBox]` width + height (OpenDB, integer dbu).
4. `check_placement -verbose` must pass (gate 4).
5. `global_route -allow_congestion -verbose`; `cong_h`/`cong_v` are the
   H/V totals from the "Final congestion report" table (GRT-0096) in
   the log.
6. `estimate_parasitics -global_routing`; then
   `tns_ps = [sta::total_negative_slack_cmd "max"] * 1e12` and
   `wns_ps = [sta::worst_slack_cmd "max"] * 1e12`, each rounded to
   1 ps; `tns_viol = max(0, -tns_ps)`, `wns_viol = max(0, -wns_ps)`.
7. Apply the formula above with the reference values from the table.

The 2 µm macro-halo gate means every placed macro's bounding box,
inflated by 2 µm on all sides, must not intersect any other component
(touching the boundary is legal).
