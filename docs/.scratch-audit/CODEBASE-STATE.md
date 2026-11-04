# CODEBASE-STATE — How2Soap FF-Mining (FINAL)

## Run Metadata
- Workflow: surgical-implementation
- Run ID: run-2026-11-04-blender-offensive
- Plan source: docs/plans/blender-offensive/HOW2SOAP_FF_MINING_PLAN.md (404 lines, 11 sections)
- Date: 2026-11-04
- Target: /home/leandi-duplessis/github/workspaces/How to make soap/
- GitHub: TeacherEvan/How2Soap.git → main @ a5d0189

## Tech Stack
- TypeScript 5.4.5, webpack 5.99.9, vitest 3.2.4
- Runtime: 0 dependencies (pure browser APIs: Canvas, WebGL, Web Audio, Web Workers, SharedArrayBuffer)
- Testing: 230 tests passing (48 files) — README badge stale at 194
- Build: entrypoint <200 KiB enforced

## Relevant Structure
```
src/
  engine/   17 modules, ~3,400 LOC
    sim.worker.ts       1,029 LOC — 10 Hz loop, COLONY_SYNC, command router
    memoryLayout.ts       134 LOC — 67,648-byte SAB, Atomic SeqLock
    chemistry.ts          426 LOC — Arrhenius, calorimetry, pH, Faraday
    fabrication.ts        725 LOC — recipes, metallurgy, Mohs
    colony.ts             547 LOC — 4 archetypes, 32×32 desire-path, Boids
    crisis.ts             681 LOC — telegraphed calamities
    metabolism.ts         255 LOC — dual-compartment bio-energetics
    world.ts              127 LOC — WorldState, vessels, stepWorld
    ... 9 more
  app/      8 modules, ~1,500 LOC
    panels.ts             253 LOC — switchTab() → transitionDisplay() (NEW: display transitions)
    splash.ts             190 LOC — new splash video + loading veil (JUST PUSHED a5d0189)
    state.ts, dom.ts, views.ts, launcher.ts, autosave.ts, workerMessages.ts
  ui/
    StrategyMapCanvas.ts  — 2D astrolabe map, #12151c slate/brass, rings 100–1600m (TO BE REPLACED)
    LabBench3DCanvas.ts   — WebGL low-poly preview (PROOF: WebGL viable)
    lowPolyMeshes.ts      — hand-built low-poly geometry (PROOF: 3D approach works)
    SoapKettleMiniGame, TimedRequests, BiomeTreePanel, WorkbenchCanvas, WindowManager
  main.ts                 325 LOC — wiring only
  styles.css              — WCAG 2.2 compliant
```

## Baseline Tests
- 230 passing, 48 files, 6.80s duration (measured 2026-11-04 23:42)
- Includes: chemistry, metabolism, fabrication, husbandry, workerDispatch, persistenceV2, strategyMapCanvas, audioAndAccessibility, etc.

## Dependencies (no secrets in this file)
- webpack 5.99.9 (build)
- typescript 5.4.5 (typecheck)
- vitest 3.2.4 (tests)
- **three ^0.160.0 (PROPOSED — not yet installed)**
- **@types/three ^0.160.0 (PROPOSED)**

## Known Issues
- README badge "194/194" stale (actual 230 passing)
- StrategyMapCanvas is 2D-only — has no 3D WebGL path for diorama/bloom/DoF
- No glTF assets exist yet (public/assets/ absent)

## Initial Risks
- Three.js bundle size vs <200 KiB entrypoint (mitigate: dynamic import lazy chunk)
- Blender version not yet verified (mitigate: Phase 0 survey_skills)
- glTF Validator not in CI yet (mitigate: Phase 0 add step)
