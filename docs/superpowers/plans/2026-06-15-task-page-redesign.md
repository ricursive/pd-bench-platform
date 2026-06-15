# Task Page Redesign — "Component Datasheet / Instrument" Plan

> **For agentic workers:** front-end only. No backend/harness change. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the monotonous stacked-panel task page with a distinctive, reusable
"chip datasheet" template — chip-as-hero, structured spec sections, sticky contents
rail — that renders identically for every task from `TaskDetail` + the per-task preview
registry. Also add a task gallery driven by that registry.

**Approved direction (2026-06-15):** datasheet/instrument feel; render objective/inputs/
gates/scoring natively from parsed task data, with the raw `instruction.md` behind a
collapsible "full spec" disclosure.

**Decided earlier:** a task's example == its baseline/oracle run; previews are prerendered
platform-side (never in the task image) into `web/public/prerender/<task>/` + an
`index.json` registry. The current ariane133 GIF is **synthetic** and must be badged as
such until a real `harbor -a oracle -e modal` run replaces it.

---

## Diagnosis of the current page

- Every section is the same `panel ticks` box → no hierarchy, decoration everywhere.
- The chip viz is a mid-page card, not the hero.
- `instruction.md` is dumped raw beneath everything.
- Resource strip / scoring / gates are flat; nothing leads the eye.
- Not a template — each new task would be another identical stack.

## Layout (task detail)

```
MASTHEAD      big display name · one-line spec · [DIFFICULTY] [STATUS]
spec ribbon   GPU · cpu · budget · N metrics · N gates           (mono, tabular)

HERO (2-col)  [ placement preview — large, corner-tick "screen" ]  [ REFERENCE readout:
              illustration-only / synthetic badge                     HPWL/TNS/WNS refs,
              explore-interactively toggle                            weights, Launch CTA ]

BODY (2-col)  [ sticky CONTENTS rail + Launch ] [ numbered SpecSections:
                                                  01 Objective 02 Inputs 03 Gates
                                                  04 Scoring 05 Reproduce 06 Full spec ]

LEADERBOARD   top-3 for this task + "full board →"
```

Rules: corner-tick "instrument" framing ONLY on the chip screen + the readout panel;
elsewhere use hairline rules + whitespace, not nested panels. Atmosphere (grid/bloom)
behind masthead + hero only.

## Components (new / changed)

| File | Responsibility |
|---|---|
| `components/task/TaskMasthead.tsx` | display name, one-liner, difficulty/status tags, mono spec ribbon |
| `components/task/ReadoutPanel.tsx` | reference metrics stack + effective weights + Launch CTA (instrument readout) |
| `components/task/ContentsRail.tsx` | sticky anchor-link index + pinned Launch button; scroll-spy active state |
| `components/task/SpecSection.tsx` | numbered section shell (`01 · OBJECTIVE`) used by all body sections |
| `components/task/InputsTable.tsx` | the inputs table (paths + contents) from task data |
| `components/task/PreviewHero.tsx` | wraps `SampleSolution`, adds synthetic/real badge + framing |
| `components/TaskGallery.tsx` | home/index gallery of task cards from the registry |
| `lib/registry.ts` | load `web/public/prerender/index.json`; types `PreviewEntry` |
| `app/tasks/[id]/TaskClient.tsx` | rewrite to compose the template above |
| `app/page.tsx` | use `TaskGallery` for the task list |
| `app/globals.css` | tighten type scale; section-number display style; restrain `.ticks` usage |

Reused as-is: `ScoreBreakdown`, `GatesPanel`, `SampleSolution`, `PhaseScrubber`, `Markdown`.

## Data

- `TaskDetail` already carries metrics/refs/gates/resources/instruction — drives every
  section. Add `inputs: {path,contents}[]` (parse the instruction table or hardcode in
  seed for now) and `reproduce: string` (the recipe).
- `lib/registry.ts` reads `index.json`: `[{task, org, difficulty, gif, poster, refMetrics, synthetic}]`.
  Falls back to the embedded seed when absent (static demo).
- Badge `synthetic: true` until an oracle-derived preview exists.

## Tasks

- [ ] **1. Visual tokens.** In `globals.css`: add a section-number display style, a
      `.rule` hairline divider, tighten heading scale; verify nothing regresses.
- [ ] **2. `SpecSection` + `ContentsRail`.** Section shell with numbered header + id anchor;
      rail with scroll-spy (IntersectionObserver) and a pinned Launch button.
- [ ] **3. `TaskMasthead` + spec ribbon.** From `TaskDetail`. Snapshot-test the ribbon text.
- [ ] **4. `ReadoutPanel`.** Reference metrics + effective weights (reuse `lib/scoring`
      `effectiveWeights`) + Launch CTA; corner-tick framed.
- [ ] **5. `PreviewHero`.** Wrap `SampleSolution`; add synthetic/real badge from registry.
- [ ] **6. `InputsTable`** + a `reproduce` code block; structured Objective/Gates/Scoring
      sections (reuse `GatesPanel`, `ScoreBreakdown`); collapsible raw `instruction.md`.
- [ ] **7. Rewrite `TaskClient`** to compose masthead → hero → body(rail+sections) →
      task leaderboard. Keep it driven entirely by `TaskDetail`.
- [ ] **8. `lib/registry.ts` + `TaskGallery`;** wire into `app/page.tsx`. Synthetic badge.
- [ ] **9. Verify:** `npm test`, `tsc`, `next build` + export; re-screenshot via the tunnel;
      confirm the page is task-agnostic by rendering with mocked second-task data.

## Out of scope

Backend, harness, the real oracle run (gated). The synthetic preview stays, clearly
badged, until that run is made.
