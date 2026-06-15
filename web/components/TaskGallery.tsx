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
      {list.map((p) => (
        <TaskCard key={`${p.org}/${p.task}`} p={p} />
      ))}
      {Array.from({ length: Math.max(0, 3 - list.length) }).map((_, i) => (
        <div key={i} className="bg-panel p-4 min-h-[230px] grid place-items-center">
          <span className="label text-ink-faint">more tasks soon</span>
        </div>
      ))}
    </div>
  );
}

function TaskCard({ p }: { p: PreviewEntry }) {
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
        {hover && (
          <img src={p.gif} alt="" className="absolute inset-0 w-full h-full object-contain" />
        )}
        <span
          className={`absolute top-2 left-2 tnum text-[10px] px-1.5 py-0.5 border bg-base/80 ${
            p.synthetic ? "text-warn border-warn/50" : "text-good border-good/50"
          }`}
        >
          {p.synthetic ? "synthetic" : "baseline"}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="font-display font-bold group-hover:text-amber transition-colors">{p.name}</span>
          <span className={`label px-1.5 py-0.5 border ${DIFF[p.difficulty] ?? ""}`}>{p.difficulty}</span>
        </div>
        <p className="text-[13px] text-ink-dim mt-1.5 leading-relaxed">{p.blurb}</p>
        <div className="flex gap-4 mt-3">
          {p.refMetrics.map((m) => (
            <div key={m.label}>
              <div className="label">{m.label}</div>
              <div className="tnum text-sm text-ink mt-0.5">{m.value}</div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}
