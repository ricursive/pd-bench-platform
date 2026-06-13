import type { GateReport } from "@/lib/types";

export function GatesPanel({ gates, valid }: { gates: GateReport[]; valid: 0 | 1 }) {
  return (
    <div className="panel ticks">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <span className="label">Hard gates</span>
        <span
          className={`tnum text-xs px-2 py-0.5 border ${
            valid ? "text-good border-good/40" : "text-bad border-bad/40"
          }`}
        >
          valid {valid}
        </span>
      </div>
      <ul className="px-4 py-2">
        {gates.map((g) => (
          <li key={g.gate} className="flex items-start gap-3 py-2 border-b border-line/60 last:border-0">
            <GateIcon status={g.status} />
            <div className="min-w-0">
              <div className="text-sm text-ink">{g.label}</div>
              {g.detail && <div className="text-[11px] text-bad/90 mt-0.5">{g.detail}</div>}
            </div>
          </li>
        ))}
      </ul>
      {!valid && (
        <p className="px-4 pb-3 text-[11px] text-ink-faint leading-relaxed">
          Any failed gate scores 0 — gate failures are reward 0, not verifier errors.
        </p>
      )}
    </div>
  );
}

function GateIcon({ status }: { status: GateReport["status"] }) {
  const map = {
    pass: { c: "text-good", ch: "✓" },
    fail: { c: "text-bad", ch: "✕" },
    skipped: { c: "text-ink-faint", ch: "·" },
  }[status];
  return (
    <span className={`tnum mt-0.5 w-4 text-center ${map.c}`} aria-label={status}>
      {map.ch}
    </span>
  );
}
