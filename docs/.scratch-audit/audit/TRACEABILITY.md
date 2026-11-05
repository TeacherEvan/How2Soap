# TRACEABILITY.md — Milestone M1

| Objective | Requirement | Code Locations | Test / Verification Evidence | Status |
|---|---|---|---|---|
| **OBJ-M1-001** (Experiments Model) | AC-M1-001 | `src/engine/campaign/experiments.ts` | `tests/campaignExperiments.test.ts` (7 tests: turns conversion, concurrency, reservation, living sour rolls) | VERIFIED |
| **OBJ-M1-002** (The Realm Model) | AC-M1-002 | `src/engine/campaign/realm.ts` | `tests/campaignRealm.test.ts` (7 tests: 5 countries, Wasting decay, doses & exposure crash, clothing & weapons, estate warnings at 25/10, deposals) | VERIFIED |
| **OBJ-M1-003** (Campaign Save Integration) | AC-M1-003 | `src/engine/persistence.ts` | `SerializedWorldSave` v3 roundtrips `experiments` and `realm` cleanly; `tests/saveV3Integrity.test.ts` passes | VERIFIED |
| **OBJ-M1-004** (Experiments Test Suite) | AC-M1-001 | `tests/campaignExperiments.test.ts` | 7 passing tests | VERIFIED |
| **OBJ-M1-005** (Realm Test Suite) | AC-M1-002 | `tests/campaignRealm.test.ts` | 7 passing tests | VERIFIED |
| **OBJ-M1-006** (60-Turn Soak & Budget) | AC-M1-004 | `tests/campaignSoakAndDeterminism.test.ts` | Headless 60-turn soak serialized save size < 15 KiB (strictly ≤ 512,000 bytes budget) | VERIFIED |
| **OBJ-M1-007** (Replay Determinism) | AC-M1-005 | `tests/campaignSoakAndDeterminism.test.ts` | 30-turn scripted action log replay byte-identical with same seed | VERIFIED |
| **OBJ-M1-008** (Zero-Defect Gate) | AC-M1-006 | Full test/build pipeline | 55/55 test files (262 passing tests); `tsc --noEmit` 0 errors; entrypoint 187 KiB (< 200 KiB) | VERIFIED |
| **OBJ-M1-009** (SAB Invariant) | AC-M1-006 | `tests/memoryLayout.test.ts` | 67,648 bytes strictly verified | VERIFIED |
| **OBJ-M1-010** (Debrief & Handoff) | AC-M1-001–006 | `docs/.scratch-audit/debrief.md` | Full debrief compiled | VERIFIED |
