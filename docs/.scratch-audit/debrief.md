# Debrief — Milestone M1 (Campaign Engine Spine + Chemistry Clock)

## 1. Executive Summary
Milestone M1 of the Civ VII 4X conversion plan (`docs/plans/2026-11-05-civ7-4x-conversion-plan.md`) has been fully implemented and verified on branch `feat/civ7-4x-v8-m0`. The campaign engine spine now features pure multi-turn experiment scheduling with living culture sour mechanics, the complete national Realm model (indices, 5 countries, 3 Estates, warnings, deposal triggers), save v3 integration, a passing 60-turn headless soak test (save size < 15 KiB, well within the 512 KiB budget), and 30-turn byte-identical determinism replay.

## 2. Requirements & Acceptance Verification
- **AC-M1-001 (Experiments Model)**: `src/engine/campaign/experiments.ts` implemented. Converts `workHours` to campaign turns (<=3h = 1 turn; 24h = 1 turn; 48h = 2 turns). Concurrency capped at 4 + benchBuildings (max 32). Commits inventory inputs on reservation. Deterministic sour rolls implemented for fermentation, mash, and penicillin.
- **AC-M1-002 (The Realm Model)**: `src/engine/campaign/realm.ts` implemented. Models Public Health, Public Safety, and Hearth Vigor (0–100). Baseline Wasting decay (-1/turn). Exposure accumulation and crash rolls (at >=60). Five starting countries with asymmetric endowments and estate multipliers. Three Estates (Crown, Army, Public) with warnings at 25 and 10, and 3 deposal outcomes (Dismissal, Mutiny, Pyre).
- **AC-M1-003 (Campaign Save Integration)**: `SerializedWorldSave` v3 extended with optional `experiments` and `realm` sub-trees with backwards compatibility.
- **AC-M1-004 (60-Turn Soak & Storage Budget)**: Headless 60-turn soak test verifies total serialized save size is ~11 KiB, strictly below the 512,000-byte budget (§4.1).
- **AC-M1-005 (Determinism)**: Byte-identical serialized saves verified across 30 scripted turns with identical seed.
- **AC-M1-006 (Zero-Defect Verification)**: Vitest suite (55 files, 262 tests) 100% green; `tsc --noEmit` exits 0; Webpack entrypoint 187 KiB (< 200 KiB budget); SAB layout at 67,648 bytes verified.

## 3. Files Created & Modified
- `src/engine/campaign/experiments.ts`: Pure scheduling model for experiments, concurrency, and living sour rolls.
- `src/engine/campaign/realm.ts`: Pure model for the 5 countries, national indices, stimulant/clothing/weapon distribution programs, and the 3 Estates.
- `src/engine/persistence.ts`: Added `experiments` and `realm` fields to `SerializedWorldSave`.
- `tests/campaignExperiments.test.ts`: 7 unit tests covering experiment turn conversion, concurrency caps, inventory reservation, and sour rolls.
- `tests/campaignRealm.test.ts`: 7 unit tests covering country endowments, Wasting decay, doses & crashes, clothes & weapons, warnings, and deposals.
- `tests/campaignSoakAndDeterminism.test.ts`: 60-turn soak test (storage budget ≤ 512 KiB) + 30-turn deterministic replay test.

## 4. Verification Gate Results
- **Vitest**: 55 test files, 262 passed (0 failed).
- **TypeScript**: `npx tsc --noEmit` passes with 0 errors.
- **Production Build**: Webpack entrypoint `main` = 187 KiB (< 200,000 bytes budget).
- **Memory Layout**: `SAB_BYTE_LENGTH === 67648` verified.
