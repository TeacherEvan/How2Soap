# Requirements — Milestone M1 (Campaign Engine Spine + Chemistry Clock)

## Request Restatement
Implement Milestone M1 as defined in `docs/plans/2026-11-05-civ7-4x-conversion-plan.md` §9:
- Pure modules in `src/engine/campaign/`: `experiments.ts` (workTicks/workHours → turn scheduling, multi-turn experiments, queue management, input reservation, sour batch mechanics per §6.17) and `realm.ts` (national indices Health, Safety, Vigor; the 5 countries, the 3 Estates Crown/Army/Public, deposal triggers per §6.18).
- Save v3 serialization integration for campaign/experiments/realm state.
- Headless 60-turn save soak test asserting save payload size strictly ≤ 512,000 bytes (§4.1).
- Unit test coverage with 45–65 tests for campaign logic and replay determinism.
- Strict preservation of invariants (`SAB_BYTE_LENGTH === 67648`, bundle size < 200,000 bytes, `tsc --noEmit` 0 errors).

## Acceptance Criteria
- **AC-M1-001 (Experiments Model)**: `src/engine/campaign/experiments.ts` exports `TURNS_PER_EXPERIMENT`, `ExperimentQueue`, `startExperiment`, `stepExperiments`, and supports sour chances for living cultures (fermentation, penicillin, mash) with deterministic seeded replay.
- **AC-M1-002 (The Realm Model)**: `src/engine/campaign/realm.ts` exports `createRealmState`, `stepRealmTurn`, country definitions (5 countries with starting endowments & estate temperaments), the 3 Estates (Crown, Army, Public) with warnings at 25 and 10, and deposal detection.
- **AC-M1-003 (Campaign State & Save)**: `SerializedWorldSave` cleanly persists `experiments` and `realm` state with backwards-compatible migration for existing saves.
- **AC-M1-004 (60-Turn Soak & Storage Budget)**: Headless 60-turn simulation soak test verifies save output size is ≤ 512,000 bytes with zero quota or memory leaks.
- **AC-M1-005 (Determinism)**: Identical action log with identical RNG seed produces byte-identical serialized saves across 30+ turns.
- **AC-M1-006 (Zero-Defect Verification)**: `npx vitest run` passes all tests, `npx tsc --noEmit` exits 0, and `npm run build` entrypoint remains < 200,000 bytes.
