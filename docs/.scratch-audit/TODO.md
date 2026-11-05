# TODO.md — Milestone M0.5 Objectives (Engagement Spine)

> Per `docs/plans/2026-11-05-engagement-spine-addendum.md` §4 M0.5 gate
> Precedence: Engagement Spine addendum wins on ES-1, ES-2, ES-3 elements; v8 remains authority elsewhere.

---

## ES-1 — Guided First Batch (3-beat arc: Stoke → Render → Deliver)

- [x] **OBJ-M05-001**: Add tutorial sensors to `src/engine/progression.ts` for `tutorial_stoke` (harvest timber), `tutorial_render` (SoapKettleMiniGame batch complete), `tutorial_deliver` (timedRequests fulfill).
- [x] **OBJ-M05-002**: Create `src/ui/TutorialProgressiveReveal.ts` — progressive reveal controller: beat index state, `.tutorial-focus` brass ring pulse, 55% opacity dim on non-focus panels, coachmark positioning via `getBoundingClientRect` on rAF, `prefers-reduced-motion` static ring fallback, skip persistence.
- [x] **OBJ-M05-003**: Wire ES-1 beats into `TutorialController.ts` — replace lecture-tier modal flow with progressive reveal controller; preserve 25-path matrix; keep Academy skip button.
- [x] **OBJ-M05-004**: Unit tests for tutorial sensors (headless event-driven advance) + `tests/tutorialSelectors.test.ts` compatibility.
- [x] **OBJ-M05-005**: Headless scripted first 3 beats advance test (deterministic replay, byte-identical save).

## ES-2 — The Crown's Ledger v1 (Dispatches from the Crown, tick-clocked)

- [x] **OBJ-M05-006**: Revive `src/engine/mandates.ts` as `src/engine/campaign/ledger.ts` — `LedgerSlot` type (id, family: 'craft'|'care'|'civic', text, deadlineDay, rewardRenown, rewardAffinity, status), `LedgerState` (day, slots[3], streak, bestStreak), `createInitialLedger`, `stepLedgerDay`, `rotateSlots`, `fulfillSlot`.
- [x] **OBJ-M05-007**: Wire ledger into `sim.worker.ts` — `ADVANCE` command calls `stepLedgerDay` on day rollover; new message `LEDGER_SYNC` posts ledger state to UI.
- [x] **OBJ-M05-008**: Add "Dispatcher's Desk" tab to `JournalPanel.ts` — renders 3 rotating slots, family badge, deadline, reward, accept/fulfill buttons; streak display; "Day Well Spent" event on all-three completion (+6 morale all colonists, recap line).
- [x] **OBJ-M05-009**: Seed determinism: ledger RNG from worker's seeded RNG; 2-seed replay produces byte-identical ledger state; save round-trip clean in v2 (pre-M1 migration proof).
- [x] **OBJ-M05-010**: Unit tests for ledger rotation, fulfillment, streak, determinism replay.

## ES-3 — Colony ↔ Chemistry Coupling (behind `featureFlags.colonyChemistryLink`)

- [x] **OBJ-M05-011**: Add `featureFlags` namespace to campaign save v2 (`colonyChemistryLink: boolean` default false).
- [x] **OBJ-M05-012**: Extend `crisis.ts` effect vocabulary (or new `couplings.ts`) with three read-points:
  - Labor → quality: `APPRENTICE_CHEMIST` assigned to vessel → mini-game trace target 12→9, Phase-2 band 80–95→78–96 °C
  - Unrest → spoilage: mean morale < 40 or any `STRIKE` → per-batch spoilage roll + vessel-rupture severity +1
  - Crash → clumsiness: colonist in `CRASH` phase assigned to vessel → Phase-1 tolerance -4%, Phase-2 band -4°C
- [x] **OBJ-M05-013**: Wire couplings into `SoapKettleMiniGame.ts` and `sim.worker.ts` SKIM/ADVANCE paths — all effects as seeded `roll`; flag off ⇒ bit-identical to M0.
- [x] **OBJ-M05-014**: Unit tests for each coupling (headless, flag on/off, determinism).
- [x] **OBJ-M05-015**: Balance harness pass — economy soak asserts net-yield bands with coupling on (M4 gate prep).

## M0.5 Gate (All Must Pass)

- [x] **OBJ-M05-016**: `npx vitest run` green (all existing + new tests) — 357 tests pass across 74 files
- [x] **OBJ-M05-017**: `npx tsc --noEmit` 0 errors
- [x] **OBJ-M05-018**: `npm run build` entrypoint ≤ 200,000 bytes (193 KiB — under budget)
- [x] **OBJ-M05-019**: CI lint HIGH = 0 (TypeScript strict clean, zero build warnings on entrypoint)
- [x] **OBJ-M05-020**: Offline reload smoke test; SW unchanged (no shell assets change → no cache bump)
- [x] **OBJ-M05-021**: Determinism verification: 2-seed replay × ES-1, ES-2, ES-3 flag off = byte-identical behavior to M0

---

## Definition of Done (per addendum §4 gate)

All objectives above `[x]` + gate checklist above `[x]` + traceability updated + commit with message:
```
M0.5: Engagement Spine — ES-1 guided first batch, ES-2 Crown's Ledger v1, ES-3 colony↔chem flag
```

---

## Notes

- ES-1/ES-2 are uncuttable (they are the M2 kill-gate instruments per §5 table).
- ES-3 is flag-fenced: off in M0.5 builds, on in M2 playtest builds, permanent post-M4 bands.
- No new runtime deps; SAB stays 67,648 B; entrypoint ≤ 200 KiB; all interactive targets ≥ 24 px; `prefers-reduced-motion` honored.
- Existing `tests/tutorialSelectors.test.ts` (v8 §6.26 law 2) applies unchanged to ES-1 hooks.
- `tests/telegraphAndMandates.test.ts` covers engine exists for ES-2; expand for ledger.