# TRACEABILITY.md — Milestone M0

| Objective | Requirement | Code Locations | Test / Verification Evidence | Status |
|---|---|---|---|---|
| **OBJ-001** (D1, D2) | AC-001, AC-002 | `src/app/launcher.ts`, `src/ui/SoapKettleModal.ts`, `src/types/assets.d.ts` | Webpack build output: `893.c83d585e.css` (10.3 KiB) and `128.ab51682a.css` (2.4 KiB) emitted in lazy chunks; `main` entrypoint 187 KiB (< 200 KiB) | VERIFIED |
| **OBJ-002** (D4) | AC-003 | `src/ui/timedRequests.css`, `src/ui/TimedRequestsWidget.ts` | CSS `transform: scaleX(...)` with `transform-origin: left` replacing `transition: width`; all 52 vitest suites pass | VERIFIED |
| **OBJ-003** (D5, D6) | AC-004 | `src/engine/persistence.ts` | `tests/persistence.test.ts`, `tests/persistenceV2.test.ts`, `tests/saveV3Integrity.test.ts` pass | VERIFIED |
| **OBJ-004** (D5) | AC-004 | `src/app/autosave.ts`, `src/app/state.ts`, `src/app/workerMessages.ts` | `buildSaveSnapshot()` retains deterministic `state.rngSeed`, serializes colony, paddock, timedRequests | VERIFIED |
| **OBJ-005** (D6, D8) | AC-005 | `src/engine/worldRestore.ts`, `src/engine/sim.worker.ts`, `src/engine/timedRequests.ts` | `restoreWorldFromSave` single-sourced in `LOAD_WORLD`; `timedRequests.restore()` rehydrates slots | VERIFIED |
| **OBJ-006** (D17) | AC-006 | `public/sw.js` | Cache name bumped to `how2soap-v2` | VERIFIED |
| **OBJ-007** | AC-007 | `tests/saveV3Integrity.test.ts` | 52/52 suites, 246/246 tests passing | VERIFIED |
| **OBJ-008** | AC-007, AC-008, AC-009 | Build & test runners | `vitest` (246 pass), `tsc --noEmit` (0 errors), `npm run build` (187 KiB < 200 KiB) | VERIFIED |
| **OBJ-009** | AC-010 | `src/engine/memoryLayout.ts` | `tests/memoryLayout.test.ts` passes (67648 bytes invariant strictly preserved) | VERIFIED |
| **OBJ-010** | AC-001–AC-010 | `docs/.scratch-audit/debrief.md` | Full debrief generated | VERIFIED |
