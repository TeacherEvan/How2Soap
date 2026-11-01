# CODEBASE-STATE Baseline Report

## Metadata
- **Date**: 2026-11-01
- **Target Repo**: How to make soap (Chemistry Survival Engine)
- **Baseline Git Commit**: `ff8639215792a16e14f3c84a56e75f356b938aca` ("Phase 1: Engine foundation")
- **Node Environment**: Node.js v20 LTS / Linux
- **TypeScript**: 5.4.5, strict mode enabled
- **Bundler**: Webpack 5.112.2, TerserPlugin, MiniCssExtractPlugin
- **Test Runner**: Vitest 3.2.7 (14/14 tests passing)

## Architecture Overview
The project is an emergent chemistry and survival simulation engine designed for browser execution with strict Cross-Origin Isolation (`SharedArrayBuffer` via COOP/COEP headers).

### Current File Tree
- `vercel.json`: Edge headers (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`).
- `webpack.config.js`: Webpack 5 bundle configuration with strict entrypoint size budgets (<200 KB). Current entrypoint: 22.1 KB.
- `src/data/speciesRegistry.ts`: 34 species defined out of 256 indexed capacity (H2O, K2CO3, CaO, Ca(OH)2, CaCO3, KOH, Tristearin, Potash Soap, Glycerol, NaCl, Sodium Stearate, etc.).
- `src/data/reactionRules.ts`: Arrhenius reaction rules (hydration, double displacement, saponification, salting out) and electrolysis rules.
- `src/engine/memoryLayout.ts`: Flat 67,648-byte `SharedArrayBuffer` layout with `syncFlags` SeqLock, telemetry stride (8 float64s/vessel), and mole matrix (32 vessels x 256 species).
- `src/engine/chemistry.ts`: Pure physical chemistry solver: Arrhenius rate calculation, enthalpy & calorimetry, latent heat phase clamping & boiling, Ksp precipitation, SID dynamic pH solver, Faraday electrolysis.
- `src/engine/world.ts`: Authoritative multi-vessel state container, decanting, skimming, stepping, and SeqLock sync to SharedArrayBuffer.
- `src/engine/sim.worker.ts`: 10 Hz deterministic Web Worker event loop responding to worker commands (`INIT`, `STEP`, `SET_HEAT`, `ADD_SPECIES`, `DECANT`, `SKIM`, etc.).
- `src/main.ts`: UI layer currently bootstrapping a 4-panel workbench with real-time SeqLock snapshot polling at 60 FPS.
- `tests/`:
  - `memoryLayout.test.ts`: SeqLock atomicity and buffer indexing tests (5 passed).
  - `chemistry.test.ts`: Calorimetry, Arrhenius kinetics, pH, precipitation, latent heat boiling, and Faraday electrolysis tests (8 passed).
  - `soapWalkthrough.test.ts`: Canonical ash -> lye -> decant -> saponify -> salt-out test (1 passed).

## Existing Strengths
1. Rock-solid zero-copy multithreaded architecture with SeqLock preventing torn reads.
2. Verified physical chemistry equations for the core soap pathway.
3. Clean TypeScript code without external runtime dependencies (zero UI bloat).
4. Fast build and test suite (<1s test execution, <3.5s webpack production build).

## Gaps Identified vs Master Specification
1. **Bio-Thermodynamic Metabolism (`src/engine/metabolism.ts`)**: Missing BMR (70 kcal/h), blood glucose (0-2000 kcal), adipose reserve (15,000 kcal), hypothermia/hyperthermia thermogenesis, and clothing insulation ($I_{\text{clo}}$).
2. **Biome DAG & Resource Nodes (`src/data/biomeNodes.ts`)**: Missing 3-level hierarchical explorer (Trees: White Oak, Sugar Maple, Scots Pine, White Willow; Rocks: Chert, Kaolinite, Limestone, Halite, Malachite, Pyrite; Fungi/Flora; Animals).
3. **Mechanical Fabrication & Tool System (`src/engine/fabrication.ts`)**: Missing tool mechanical advantage ($MA$), Mohs hardness scaling, knapping, carving, dehairing, tannin steeping, and Leather Backpack 24-slot unlock.
4. **Domestication & Animal Husbandry (`src/engine/husbandry.ts`)**: Missing live capture, paddocks, feeding/culling, manure generation.
5. **Persistence & Save Management**: Missing IndexedDB (`chem_world_v1`) asynchronous storage and `CompressionStream('gzip')` export/import.
6. **Compendium & Accessibility Settings**: Missing dynamic chemical compendium and accessible color palettes / audio routing stubs.
