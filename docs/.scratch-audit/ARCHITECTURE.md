# Architecture — Milestone M1

## 1. Module Design
- `src/engine/campaign/experiments.ts`:
  - `TURNS_PER_EXPERIMENT(workHours: number): number = Math.ceil(workHours / 24)` (≤ 3 hours complete on turn 1).
  - `ExperimentInstance`: `id`, `recipeId`, `turnsStarted`, `totalTurns`, `turnsLeft`, `sour`, `sourChance`.
  - Concurrency: `4 + benchBuildings` (max 32 = `MAX_VESSELS`).
  - `startExperiment(...)`: checks preconditions, commits/reserves inputs, creates instance with seeded sour roll.
  - `stepExperiments(...)`: decrements `turnsLeft`, resolves completions, emits results and bench ledger entries.
- `src/engine/campaign/realm.ts`:
  - National indices: `health`, `safety`, `vigor` clamped to 0–100, decaying −1/turn base.
  - Exposure gauge: accumulates with doses, recovers −8/turn; crash roll at ≥60.
  - Five Countries: `The Brass Coast`, `The Salt Steppes`, `The Fever Marches`, `The Iron Weald`, `The Sunk Capital`.
  - Three Estates: `estate.crown`, `estate.army`, `estate.public` (0–100, baseline 60), warnings at 25 and 10, deposal triggers at 0 (`The Dismissal`, `The Mutiny`, `The Pyre`).
  - Distribution orders: `DISTRIBUTE_STIMULANTS`, `DISTRIBUTE_CLOTHES`, `DISTRIBUTE_WEAPONS`.
- `src/engine/persistence.ts`:
  - Add optional `experiments` and `realm` to `SerializedWorldSave` and `deserializeSave` / `migrateSave`.

## 2. Invariants
- Zero runtime dependencies added.
- All code pure and portable to Web Workers or main thread.
- Memory layout `SAB_BYTE_LENGTH === 67648` preserved.
