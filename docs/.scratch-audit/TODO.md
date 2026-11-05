# TODO.md — Milestone M1 Objectives

- [ ] **OBJ-M1-001**: Implement `src/engine/campaign/experiments.ts` (turns conversion, concurrency cap, `startExperiment`, `stepExperiments`, deterministic sour mechanics).
- [ ] **OBJ-M1-002**: Implement `src/engine/campaign/realm.ts` (national indices Health/Safety/Vigor, exposure crash rolls, 5 countries, 3 Estates with 25/10 warnings & deposal).
- [ ] **OBJ-M1-003**: Extend `src/engine/persistence.ts` with `experiments` and `realm` fields in save v3.
- [ ] **OBJ-M1-004**: Author unit test suite for `experiments.ts` (queue, concurrency, reservation, completion, sour rolls, determinism).
- [ ] **OBJ-M1-005**: Author unit test suite for `realm.ts` (indices decay, doses, clothing, weapons, estate warnings, deposals).
- [ ] **OBJ-M1-006**: Author headless 60-turn soak test verifying save payload size ≤ 512,000 bytes.
- [ ] **OBJ-M1-007**: Verify 30-turn deterministic replay (byte-identical serialized save).
- [ ] **OBJ-M1-008**: Run full verification gate (`npx vitest run`, `npx tsc --noEmit`, `npm run build`).
- [ ] **OBJ-M1-009**: Confirm `tests/memoryLayout.test.ts` invariant (67,648 bytes).
- [ ] **OBJ-M1-010**: Generate completion evidence, update traceability, and commit M1.
