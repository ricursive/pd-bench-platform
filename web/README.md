# PD-Bench platform — web

Next.js 16 (App Router) + TypeScript + Tailwind v4 front end for PD-Bench:
launch agents, visualize placements (empty floorplan → phase snapshots →
final), inspect scoring/gates, and a leaderboard.

## Develop

```bash
npm install
npm run dev            # http://localhost:3000  (predev syncs the fixture)
npm test               # vitest: DEF parser, scoring parity, render math
```

With no backend the site runs on embedded seed data (the committed
`leaderboard/results.jsonl` + the synthetic `fixtures/ariane133`). To talk to
the live backend instead, set the API base:

```bash
NEXT_PUBLIC_API_BASE=https://<your-modal-app>.modal.run npm run dev
```

## Build

```bash
npm run build          # server build
npm run export         # NEXT_EXPORT=1 → static site in web/out (served by server/app.py)
```

## Layout

| Path | Responsibility |
|---|---|
| `lib/def/` | DEF/LEF parser → `PlacementPayload` (typed-array cells) |
| `lib/render/` | viewport math + canvas2D renderer (LOD density heatmap) + palette |
| `lib/scoring.ts` | TS port of the verifier's `scoring.py` (parity-tested) |
| `lib/api.ts` | data layer — embedded seed, or live backend via `NEXT_PUBLIC_API_BASE` |
| `components/PlacementView.tsx` | pan/zoom chip view, overlays, parts-to-place panel |
| `components/PhaseScrubber.tsx` | phase-snapshot timeline |
| `components/ScoreBreakdown.tsx` | transparent per-metric s / weight / contribution |
| `app/` | `/`, `/tasks/[id]`, `/leaderboard`, `/run?id=`, `/launch` |

The placement renderer is canvas2D with a binned density-heatmap LOD (handles
the ~100K-cell scale via viewport culling + heatmap when cells render
sub-pixel). The canvas path is the default and is fully sufficient; a WebGL
instanced backend is a possible future drop-in for raw cell counts.
