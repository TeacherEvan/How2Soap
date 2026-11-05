# Debrief — Milestone M0 (Hygiene & Save Integrity)

## 1. Executive Summary
Milestone M0 has been implemented and verified on branch `feat/civ7-4x-v8-m0`. Pre-op defects D1, D2, D4, D5, D6, D8, and D17 are resolved. Critical invariants (clean zero-error TypeScript, 246 passing vitest tests, production entrypoint budget < 200,000 bytes at 187 KiB, and strict SAB memory layout at 67,648 bytes) all pass.

## 2. Original Request
Implement the Civ VII 4X conversion v8 plan (`docs/plans/2026-11-05-civ7-4x-conversion-plan.md`), beginning with Milestone M0.

## 3. Initial State
- Orphaned styles: `windows.css` and `soapKettle.css` were unreferenced, risking unstyled features in production.
- Layout thrashing in `timedRequests.css` on progress animation (`transition: width`).
- Incomplete autosave: colony roster, paddock animals, and timedRequests were dropped on save, and `rngSeed` was randomized on every autosave, destroying crisis determinism.
- Duplicated world restore logic between `sim.worker.ts` and `worldRestore.ts`.
- Service worker precache was pinned to `how2soap-v1`.

## 4. Key Architectural Changes & Decisions
- **Bundle Budget Preservation (D1 & D2)**: Instead of inflating the initial eager entrypoint beyond the 200,000-byte budget, `windows.css` is dynamically imported in `launcher.ts` on window open, and `soapKettle.css` is imported within `SoapKettleModal.ts`. The resulting main entrypoint is 187 KiB (well under the 200 KiB budget).
- **Compositor Animation (D4)**: Changed `.req-progress-fill` to `transform: scaleX(...)` with `transform-origin: left`, preventing CPU layout recalculations during progress updates.
- **Save Integrity (D5, D6, D8)**:
  - Save format upgraded to version 3 with backwards-compatible fallback for v1 and v2.
  - Runtime `state.rngSeed` tracks the worker's simulation seed and preserves it across autosaves.
  - Colony state (colonists, ledger, 1024-byte desire path grid, `nextColonistId`), paddock animals, and timed request slots are persisted in autosaves.
  - Worker `LOAD_WORLD` rehydrates timed request slots and delegates vessel reconstruction to `restoreWorldFromSave`.
- **Offline Shell (D17)**: Bumped service worker cache key to `how2soap-v2`.

## 5. Files Changed
- `public/sw.js`: Bumped cache version to `how2soap-v2`.
- `src/types/assets.d.ts`: Added module declaration for `*.css`.
- `src/app/launcher.ts`: Lazy-loaded `windows.css` upon opening windows.
- `src/ui/SoapKettleModal.ts`: Imported `soapKettle.css`.
- `src/ui/timedRequests.css`: Changed progress bar transition to `transform: scaleX(...)`.
- `src/ui/TimedRequestsWidget.ts`: Updated style attribute to `transform: scaleX(...)`.
- `src/engine/persistence.ts`: Added version 3 save structure with colony, paddock, timedRequests, and persistent `rngSeed`.
- `src/app/state.ts`: Added `rngSeed: 0` property.
- `src/app/autosave.ts`: Updated `AUTO_SAVE_KEY` to `how2soap.save.v3` and included colony/paddock/timedRequests in snapshot.
- `src/app/workerMessages.ts`: Recorded worker `rngSeed` on `READY` and removed v2/v3 save keys on new game.
- `src/main.ts`: Added dual check for `how2soap.save.v3` and `how2soap.save.v2`.
- `src/engine/timedRequests.ts`: Added `restore(...)` method.
- `src/engine/worldRestore.ts`: Enhanced `restoreWorldFromSave` to populate labels.
- `src/engine/sim.worker.ts`: Single-sourced `restoreWorldFromSave` and restored timed requests on `LOAD_WORLD`.
- `tests/saveV3Integrity.test.ts`: Added unit test suite covering full v3 save serialization, deserialization, and restoration.

## 6. Verification Results
- **Unit Tests**: `52 passed (52)`, `246 passed (246)` (100% green).
- **TypeScript**: `npx tsc --noEmit` exits 0.
- **Production Build**: `Entrypoint main 187 KiB` (< 200 KiB budget).
- **Memory Layout**: `SAB_BYTE_LENGTH === 67648` verified.
