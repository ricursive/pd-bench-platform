"use client";

import Link from "next/link";
import { useState } from "react";
import { getPreviews } from "@/lib/registry";
import { useAsync } from "@/lib/useAsync";
import type { PreviewEntry } from "@/lib/types";

const DIFF: Record<string, string> = {
  easy: "text-good border-good/40",
  medium: "text-warn border-warn/40",
  hard: "text-bad border-bad/40",
};

export function TaskGallery() {
  const { data: previews } = useAsync(getPreviews, []);
  const list = previews ?? [];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-line border border-line">
      {list.map((p) => (p.status === "live" ? <LiveCard key={p.task} p={p} /> : <PlannedCard key={p.task} p={p} />))}
    </div>
  );
}

function CardChrome({ p, children }: { p: PreviewEntry; children: React.ReactNode }) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display font-bold truncate">{p.name}</span>
        <span className={`label px-1.5 py-0.5 border shrink-0 ${DIFF[p.difficulty] ?? ""}`}>{p.difficulty}</span>
      </div>
      <p className="text-[13px] text-ink-dim mt-1.5 leading-relaxed min-h-[34px]">{p.blurb}</p>
      {children}
    </div>
  );
}

function LiveCard({ p }: { p: PreviewEntry }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={`/tasks/${p.task}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="bg-panel group block"
    >
      <div className="relative aspect-[4/3] bg-[#080a0d] overflow-hidden">
        <img src={p.poster} alt={p.name} className="absolute inset-0 w-full h-full object-contain" loading="lazy" />
        {hover && <img src={p.gif} alt="" className="absolute inset-0 w-full h-full object-contain" />}
        <span
          className={`absolute top-2 left-2 tnum text-[10px] px-1.5 py-0.5 border bg-base/80 ${
            p.synthetic ? "text-warn border-warn/50" : "text-good border-good/50"
          }`}
        >
          {p.synthetic ? "synthetic" : "baseline"}
        </span>
      </div>
      <CardChrome p={p}>
        <div className="flex gap-4 mt-3">
          {p.refMetrics.map((m) => (
            <div key={m.label}>
              <div className="label">{m.label}</div>
              <div className="tnum text-sm text-ink mt-0.5">{m.value}</div>
            </div>
          ))}
          <span className="ml-auto self-end label group-hover:text-amber transition-colors">open →</span>
        </div>
      </CardChrome>
    </Link>
  );
}

function PlannedCard({ p }: { p: PreviewEntry }) {
  return (
    <div className="bg-panel/60 block opacity-80">
      <div className="relative aspect-[4/3] bg-[#080a0d] grid place-items-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <span className="label text-ink-faint relative">planned</span>
        <span className="absolute top-2 left-2 tnum text-[10px] px-1.5 py-0.5 border border-line-strong text-ink-faint bg-base/80">
          roadmap
        </span>
      </div>
      <CardChrome p={p}>
        <div className="mt-3 label text-ink-faint">not yet available</div>
      </CardChrome>
    </div>
  );
}
