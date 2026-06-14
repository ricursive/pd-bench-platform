"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { PhaseEntry } from "@/lib/types";

// The live renderer (DEF parse + canvas) is only loaded when the user opts in,
// so the task page stays light: it just shows the prerendered GIF by default.
const PhaseScrubber = dynamic(() => import("./PhaseScrubber").then((m) => m.PhaseScrubber), {
  ssr: false,
  loading: () => <div className="h-[520px] grid place-items-center label text-ink-faint">loading renderer…</div>,
});

interface Props {
  gif: string;
  poster: string;
  phases: PhaseEntry[];
  lef: string;
  haloUm?: number;
}

export function SampleSolution({ gif, poster, phases, lef, haloUm = 2 }: Props) {
  const [interactive, setInteractive] = useState(false);
  const [replayKey, setReplayKey] = useState(0);

  return (
    <div className="panel ticks overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="label">Sample solution</span>
          <span className="label !text-amber border border-amber/30 px-1.5 py-0.5 normal-case tracking-normal">
            illustration only · not provided to the agent
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {!interactive && (
            <button
              onClick={() => setReplayKey((k) => k + 1)}
              className="label !text-ink-dim border border-line-strong px-2 py-0.5 hover:!text-amber transition-colors"
            >
              ↻ replay
            </button>
          )}
          <button
            onClick={() => setInteractive((v) => !v)}
            className={`label px-2 py-0.5 border transition-colors ${
              interactive ? "!text-amber border-amber/50" : "!text-ink-dim border-line-strong hover:!text-amber"
            }`}
          >
            {interactive ? "← back to animation" : "explore interactively →"}
          </button>
        </div>
      </div>

      {interactive ? (
        <PhaseScrubber phases={phases} lef={lef} haloUm={haloUm} />
      ) : (
        <div
          className="relative bg-[#080a0d] bg-center bg-no-repeat bg-contain"
          style={{ backgroundImage: `url(${poster})` }}
        >
          {/* keyed so "replay" remounts and restarts the GIF from frame 0;
              the poster PNG sits behind it as an instant first paint */}
          <img
            key={replayKey}
            src={`${gif}?r=${replayKey}`}
            alt="Sample placement of ariane133 on ASAP7, evolving floorplan → global → legalize → detailed"
            className="block w-full max-h-[560px] object-contain mx-auto"
            loading="lazy"
          />
          <span className="absolute bottom-2.5 left-3 label !text-ink-dim bg-base/70 px-1.5 py-0.5">
            floorplan → global → legalize → detailed
          </span>
        </div>
      )}
    </div>
  );
}
