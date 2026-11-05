# Requirements — Milestone M0 (Hygiene & Save Integrity)

## Request Restatement
Implement the plan v8 starting with Milestone M0 ("Hygiene & save integrity") as defined in `docs/plans/2026-11-05-civ7-4x-conversion-plan.md` §9.

## Acceptance Criteria
- **AC-001 (D1)**: `windows.css` is loaded with window launcher/feature windows, eliminating unstyled window UI while keeping initial entrypoint under 200,000 bytes.
- **AC-002 (D2)**: `soapKettle.css` is loaded in `SoapKettleModal.ts`, styling the kettle mini-game properly.
- **AC-003 (D4)**: `timedRequests.css:89` animation changed from `transition: width` to compositor-only `transform: scaleX()` with `transform-origin: left`.
- **AC-004 (D5/D6)**: Save schema and autosave (`SerializedWorldSave` v3 with v2 backwards compatibility) captures colony roster, paddock animals, timedRequests, and preserves deterministic `rngSeed`.
- **AC-005 (D8)**: Single-source world restore logic between `worldRestore.ts` and `sim.worker.ts:LOAD_WORLD`.
- **AC-006 (D17/SW)**: Service worker cache version bumped to `how2soap-v2`.
- **AC-007 (Verification)**: Vitest test suite passes with 0 failures (`vitest run`).
- **AC-008 (Verification)**: TypeScript compilation passes with 0 errors (`tsc --noEmit`).
- **AC-009 (Verification)**: Production bundle size strictly `< 200,000` bytes entrypoint (`npm run build`).
- **AC-010 (Verification)**: Memory layout invariant `SAB_BYTE_LENGTH === 67648` preserved and verified.
