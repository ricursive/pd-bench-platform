"use client";

import { getLeaderboard } from "@/lib/api";
import { TASK } from "@/lib/seed";
import { useAsync } from "@/lib/useAsync";
import { Leaderboard } from "@/components/Leaderboard";

export default function LeaderboardPage() {
  const { data: runs, loading } = useAsync(getLeaderboard, []);
  return (
    <div className="space-y-5">
      <div>
        <div className="label mb-1">leaderboard</div>
        <h1 className="font-display font-bold text-2xl">{TASK.id}</h1>
        <p className="text-ink-dim text-sm mt-1.5 max-w-2xl">
          Score is the weighted percent improvement over the task&apos;s baseline flow (the baseline
          scores 0 by construction). <span className="tnum text-bad">valid 0</span> means a hard gate
          failed.
        </p>
      </div>
      {runs ? <Leaderboard runs={runs} /> : <div className="panel h-48 animate-pulse" />}
      {loading && <div className="label">loading…</div>}
    </div>
  );
}
