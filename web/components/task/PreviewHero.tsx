"use client";

import { SampleSolution } from "@/components/SampleSolution";
import type { PhaseEntry, PreviewEntry } from "@/lib/types";

interface Props {
  preview: PreviewEntry | null;
  fallbackGif: string;
  fallbackPoster: string;
  phases: PhaseEntry[];
  lef: string;
  haloUm?: number;
}

/** Hero "screen": the prerendered sample solution + a synthetic/real badge. */
export function PreviewHero({ preview, fallbackGif, fallbackPoster, phases, lef, haloUm }: Props) {
  const gif = preview?.gif ?? fallbackGif;
  const poster = preview?.poster ?? fallbackPoster;
  const synthetic = preview?.synthetic ?? true;

  return (
    <div className="relative">
      <SampleSolution gif={gif} poster={poster} phases={phases} lef={lef} haloUm={haloUm} />
      <span
        className={`absolute -top-2.5 left-3 z-10 tnum text-[10px] px-1.5 py-0.5 border ${
          synthetic ? "text-warn border-warn/50 bg-base" : "text-good border-good/50 bg-base"
        }`}
        title={synthetic ? "Synthetic illustration — replace with a real oracle/baseline run" : "Rendered from the real baseline (oracle) run"}
      >
        {synthetic ? "synthetic preview" : "baseline run"}
      </span>
    </div>
  );
}
