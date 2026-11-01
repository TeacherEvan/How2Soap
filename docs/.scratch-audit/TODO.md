# TODO.md — Governed Implementation Objectives

- [x] **OBJ-001**: Bio-Metabolism Model (`src/engine/metabolism.ts`)
  - *Requirements*: AC-004
  - *Details*: Implement two-compartment energy pool (Blood Glucose 0–2000 kcal, Adipose Reserves 15,000 kcal baseline), BMR (70 kcal/h), mechanical work expenditure ($\eta_{\text{human}} = 0.22$), environmental thermal dissipation with clothing insulation ($I_{\text{clo}}$), core body temperature tracking ($37.0^\circ\text{C}$ nominal, hypothermia < $35.0^\circ\text{C}$, hyperthermia > $39.5^\circ\text{C}$).
  - *Validation*: Vitest unit tests in `tests/metabolism.test.ts`.
  - *Evidence*: `tests/metabolism.test.ts` (6/6 passing)

- [x] **OBJ-002**: Hierarchical Biome DAG Resource Registry (`src/data/biomeNodes.ts`)
  - *Requirements*: AC-005
  - *Details*: Define complete 3-level DAG: Categories (`TREES`, `ROCKS_MINERALS`, `MUSHROOMS_FLORA`, `ANIMALS`), Species/Deposits (White Oak, Sugar Maple, Scots Pine, White Willow, Chert, Kaolinite, Limestone, Halite, Malachite, Pyrite, Field Mushroom, Tinder Fungus, Penicillium, Hare, Boar, Aurochs), and harvestable parts with base work $W_{\text{fracture}}$, moisture, yield stoichiometry, and transport haul energy cost $E_{\text{haul}}(d)$.
  - *Validation*: Vitest unit tests in `tests/biomeNodes.test.ts`.
  - *Evidence*: `tests/biomeNodes.test.ts` (6/6 passing)

- [x] **OBJ-003**: Tool Mechanics & Mohs Hardness Scaling (`src/engine/fabrication.ts`)
  - *Requirements*: AC-006, AC-007
  - *Details*: Define 6 tool slots: `CUTTING_SKINNING`, `CHOPPING_CARVING`, `PERCUSSION_MINING`, `THERMAL_HANDLING`, `STITCHING_MEDICAL`, `EATING_UTENSIL`. Implement Mohs hardness scaling formula $E_{\text{harvest}} = \frac{W_{\text{fracture}}}{MA_{\text{tool}}} \cdot (\frac{\text{Mohs}_{\text{target}}}{\text{Mohs}_{\text{tool}}})^2$ and tool durability.
  - *Validation*: Vitest unit tests in `tests/fabricationAndInventory.test.ts`.
  - *Evidence*: `tests/fabricationAndInventory.test.ts` (6/6 passing)

- [x] **OBJ-004**: Primitive Tool Crafting & Leather Backpack Pipeline (`src/engine/fabrication.ts`)
  - *Requirements*: AC-006
  - *Details*: Step-by-step pipeline implementation:
    1. Knap Chert/Flint (`FLINT_FLAKE_BLADE`, `FLINT_ADZE_HEAD`).
    2. Carve soft Pine trunk into `WOODEN_BUCKET` / `WOODEN_TROUGH`.
    3. Hunt/Skin medium animal for `RAW_MEDIUM_HIDE`, fat, and sinew.
    4. Alkaline dehairing in ash water (pH 11.2, 12 ticks).
    5. Oak bark vegetable tanning (leaching tannic acid, 48 ticks soak).
    6. Sinew bone-awl stitching into `LEATHER_BACKPACK`.
  - *Validation*: Vitest unit tests in `tests/fabricationAndInventory.test.ts`.
  - *Evidence*: `tests/fabricationAndInventory.test.ts` (6/6 passing)

- [x] **OBJ-005**: Dynamic Inventory Containers & Slots (`src/engine/inventory.ts`)
  - *Requirements*: AC-007
  - *Details*: Implement Bare Hands container (2 slots, max 6 kg per hand), Stationary Camp Cache (6 slots at coordinates 0,0), and unlockable Leather Backpack (24 slots, 40 kg cap, weather-protected). Include mass checks and slot transfer operations.
  - *Validation*: Vitest unit tests in `tests/fabricationAndInventory.test.ts`.
  - *Evidence*: `tests/fabricationAndInventory.test.ts` (6/6 passing)

- [x] **OBJ-006**: Animal Domestication & Husbandry Engine (`src/engine/husbandry.ts`)
  - *Requirements*: AC-008
  - *Details*: Implement paddock structures, live animal capture transport cost (+20%), daily feed/water inputs, and renewable yields (milk butterfat, egg calories, manure for niter beds).
  - *Validation*: Vitest unit tests in `tests/husbandry.test.ts`.
  - *Evidence*: `tests/husbandry.test.ts` (3/3 passing)

- [x] **OBJ-007**: Asynchronous Persistence & Compression (`src/engine/persistence.ts`)
  - *Requirements*: AC-009
  - *Details*: IndexedDB wrapper for `chem_world_v1` saving binary snapshots and JSON world state; Gzip compression using `CompressionStream('gzip')` with Base64 encoding for export and import with SHA-256 integrity prefix.
  - *Validation*: Vitest tests in `tests/persistence.test.ts`.
  - *Evidence*: `tests/persistence.test.ts` (2/2 passing)

- [x] **OBJ-008**: Simulation Worker Integration (`src/engine/sim.worker.ts`)
  - *Requirements*: AC-003, AC-004, AC-006
  - *Details*: Connect metabolism, fabrication actions, biome harvesting, and inventory updates into the 10 Hz Web Worker simulation loop alongside existing chemistry.
  - *Validation*: Worker command suite testing in `tests/soapWalkthrough.test.ts`, `tests/memoryLayout.test.ts`.
  - *Evidence*: Worker running clean with `SharedWorldView` SeqLock.

- [x] **OBJ-009**: Interactive 4-Panel UI Viewport Components (`src/ui/`)
  - *Requirements*: AC-010
  - *Details*: Modularize UI:
    - `src/ui/BiomeTreePanel.ts`: collapsible DAG explorer with harvest action buttons
    - `src/ui/ToolAndInventoryPanel.ts`: 6 tool slots, bare hands, backpack lock state
    - `src/ui/MenuController.ts`: settings and save hooks
    - 4-panel layout integrated in `src/main.ts` and `src/styles.css`.
  - *Validation*: Production Webpack build compiles clean.
  - *Evidence*: `dist/` bundle verified.

- [x] **OBJ-010**: End-to-End Soap & Survival Verification & Webpack Budget Audit
  - *Requirements*: AC-011, Master Spec Section 6 & 7
  - *Details*: Complete walkthrough verification from tree harvest -> ash/fat -> lye -> soap, backpack unlock, test suite 100% green, and webpack production bundle check maintaining strict < 200 KB budget.
  - *Validation*: Full Vitest run (37/37 passing) + `npm run build` (Entrypoint: 39.1 KB).
  - *Evidence*: `tests/soapWalkthrough.test.ts`, `dist/` bundle.
