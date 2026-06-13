"use client";

import { useEffect, useRef, useState } from "react";
import type { PhaseEntry } from "@/lib/types";
import type { PlacementPayload } from "@/lib/def/types";
import { loadPlacement } from "@/lib/def/load";
import { PlacementView } from "./PlacementView";
import { fmtDuration } from "@/lib/format";

interface Props {
  phases: PhaseEntry[];
  lef: string;
  /** single final placement when there are no phases */
  finalDef?: string | null;
  haloUm?: number;
}

/**
 * Phase timeline scrubber: morphs the placement view across captured stages
 * (floorplan → global place → legalize → detailed). Falls back to a single
 * final-placement view when a run captured no phases.
 */
export function PhaseScrubber({ phases, lef, finalDef, haloUm = 2 }: Props) {
  const steps =
    phases.length > 0
      ? phases
      : finalDef
        ? [{ stage: "final", label: "Final placement", def: finalDef, elapsed_s: 0 }]
        : [];
  const [idx, setIdx] = useState(steps.length - 1 >= 0 ? steps.length - 1 : 0);
  const [payload, setPayload] = useState<PlacementPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map<string, PlacementPayload>());

  useEffect(() => {
    if (!steps.length) return;
    const step = steps[Math.min(idx, steps.length - 1)];
    const cached = cache.current.get(step.def);
    if (cached) {
      setPayload(cached);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadPlacement(step.def, lef)
      .then((p) => {
        if (cancelled) return;
        cache.current.set(step.def, p);
        setPayload(p);
      })
      .catch(() => !cancelled && setPayload(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, lef]);

  if (!steps.length) {
    return (
      <div className="panel ticks h-[460px] grid place-items-center text-ink-faint label">
        no placement captured for this run
      </div>
    );
  }

  const step = steps[Math.min(idx, steps.length - 1)];

  return (
    <div className="panel ticks overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
        <span className="label">Placement · {step.label}</span>
        {phases.length > 0 && (
          <span className="tnum text-xs text-ink-faint">{fmtDuration(step.elapsed_s)} elapsed</span>
        )}
      </div>

      <div className="relative h-[520px]">
        {payload ? (
          <PlacementView payload={payload} haloUm={haloUm} className="absolute inset-0" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-ink-faint label">
            {loading ? "loading placement…" : "failed to load DEF"}
          </div>
        )}
      </div>

      {steps.length > 1 && (
        <div className="px-4 py-3 border-t border-line">
          <div className="flex items-stretch gap-0">
            {steps.map((s, i) => {
              const active = i === idx;
              const done = i <= idx;
              return (
                <button
                  key={s.stage}
                  onClick={() => setIdx(i)}
                  className="group relative flex-1 text-left"
                >
                  <div className="h-1 bg-panel-2 overflow-hidden">
                    <div className={`h-full transition-all ${done ? "bg-amber" : "bg-transparent"}`} style={{ width: "100%" }} />
                  </div>
                  <div className="pt-2 pr-2">
                    <div className={`tnum text-[11px] ${active ? "text-amber" : "text-ink-faint"}`}>
                      {String(i).padStart(2, "0")}
                    </div>
                    <div className={`text-xs leading-tight ${active ? "text-ink" : "text-ink-dim group-hover:text-ink"}`}>
                      {s.label}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
