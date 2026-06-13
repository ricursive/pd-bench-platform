"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { PlacementPayload } from "@/lib/def/types";
import { drawPlacement, type RenderOpts } from "@/lib/render/canvas";
import { fitView, pan, zoomAt, type View } from "@/lib/render/view";

interface Props {
  payload: PlacementPayload;
  /** macro halo gate in microns (drawn when the halo overlay is on) */
  haloUm?: number;
  className?: string;
}

export function PlacementView({ payload, haloUm = 2, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View | null>(null);
  const [opts, setOpts] = useState<RenderOpts>({
    mode: "auto",
    showHalos: false,
    showTracks: true,
    haloDbu: haloUm * payload.substrate.dbuPerMicron,
  });
  const [hud, setHud] = useState({ mode: "cells" as "cells" | "density", zoom: 1 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const v = viewRef.current;
    if (!canvas || !v) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(v.w * dpr)) canvas.width = Math.round(v.w * dpr);
    if (canvas.height !== Math.round(v.h * dpr)) canvas.height = Math.round(v.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const res = drawPlacement(ctx, payload, v, opts);
    setHud((h) => (h.mode === res.mode ? h : { ...h, mode: res.mode }));
  }, [payload, opts]);

  // size + initial fit
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const prev = viewRef.current;
      if (!prev) viewRef.current = fitView(payload.substrate.die, w, h);
      else viewRef.current = { ...prev, w, h };
      draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [payload, draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const v = viewRef.current;
    if (!v) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const factor = Math.exp(-e.deltaY * 0.0014);
    viewRef.current = zoomAt(v, e.clientX - rect.left, e.clientY - rect.top, factor);
    setHud((h) => ({ ...h, zoom: viewRef.current!.scale / fitScale() }));
    draw();
  };

  const fitScale = () => {
    const wrap = wrapRef.current;
    if (!wrap) return 1;
    return fitView(payload.substrate.die, wrap.clientWidth, wrap.clientHeight).scale;
  };

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !viewRef.current) return;
    viewRef.current = pan(viewRef.current, e.clientX - drag.current.x, e.clientY - drag.current.y);
    drag.current = { x: e.clientX, y: e.clientY };
    draw();
  };
  const onUp = () => (drag.current = null);

  const resetView = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    viewRef.current = fitView(payload.substrate.die, wrap.clientWidth, wrap.clientHeight);
    setHud((h) => ({ ...h, zoom: 1 }));
    draw();
  };

  const unplacedMacros = payload.macros.filter((m) => m.status === "UNPLACED").length;
  const totalCells = payload.placedCells + (payload.unplaced - unplacedMacros);
  const isFloorplan = payload.placedCells === 0 && payload.unplaced > 0;

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        ref={wrapRef}
        className="relative w-full h-full overflow-hidden bg-[#080a0d] cursor-grab active:cursor-grabbing"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block touch-none"
          style={{ width: "100%", height: "100%" }}
          onWheel={onWheel}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />

        {/* HUD top-left */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 pointer-events-none">
          <span className="label !text-ink-dim bg-base/70 px-1.5 py-0.5">
            {payload.macros.length} macros · {totalCells.toLocaleString()} cells
          </span>
          <span className="label bg-base/70 px-1.5 py-0.5">
            {hud.mode === "density" ? "density (LOD)" : "cells"} · {hud.zoom.toFixed(1)}×
          </span>
        </div>

        {/* overlay controls top-right */}
        <div className="absolute top-2.5 right-2.5 flex flex-wrap justify-end gap-1.5">
          <Toggle on={opts.mode === "density"} onClick={() => setOpts((o) => ({ ...o, mode: o.mode === "density" ? "auto" : "density" }))}>
            density
          </Toggle>
          <Toggle on={opts.showHalos} onClick={() => setOpts((o) => ({ ...o, showHalos: !o.showHalos }))}>
            2µm halos
          </Toggle>
          <Toggle on={opts.showTracks} onClick={() => setOpts((o) => ({ ...o, showTracks: !o.showTracks }))}>
            tracks
          </Toggle>
          <button
            onClick={resetView}
            className="label !text-ink-dim border border-line-strong bg-base/70 px-2 py-0.5 hover:!text-amber transition-colors pointer-events-auto"
          >
            fit
          </button>
        </div>

        {/* parts-to-place inventory when nothing is placed yet */}
        {isFloorplan && (
          <div className="absolute bottom-3 right-3 w-60 panel ticks p-3 rise">
            <div className="label mb-2">Parts to place</div>
            <Row k={`${payload.macros.length}× macro`} v="sram_asap7_16x256_1rw" />
            <Row k={`~${totalCells.toLocaleString()}`} v="std cells" />
            <Row k={`${payload.categories.length}`} v="cell masters" />
            <div className="mt-2 pt-2 border-t border-line text-[11px] text-ink-faint leading-relaxed">
              Fixed floorplan: die, rows, tracks &amp; I/O pins shown. Every
              component starts unplaced — this is phase 0.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`label px-2 py-0.5 border bg-base/70 transition-colors pointer-events-auto ${
        on ? "!text-amber border-amber/50" : "!text-ink-faint border-line-strong hover:!text-ink-dim"
      }`}
    >
      {children}
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="tnum text-sm text-ink">{k}</span>
      <span className="text-[11px] text-ink-faint truncate">{v}</span>
    </div>
  );
}
