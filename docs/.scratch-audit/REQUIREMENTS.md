# REQUIREMENTS.md — Master Specification Acceptance Criteria

## 1. Overview
The target system is an Emergent Chemistry & Survival Engine running in the web browser with Web Worker simulation, SharedArrayBuffer zero-copy telemetry, and realistic bio-thermodynamics.

## 2. Acceptance Criteria Table

| AC ID | Category | Requirement Description | Verification Method |
| :--- | :--- | :--- | :--- |
| **AC-001** | Chemistry | 256-index species registry with physical constants (Molar Mass, Specific Heat, Phase, Boiling Point, dHvap, Solubility, Ion Charge). | Unit test in `tests/species.test.ts` |
| **AC-002** | Chemistry | Arrhenius reaction kinetics, dynamic SID pH calculation, Ksp precipitation, and Latent Heat boiling temperature clamping. | Existing tests in `tests/chemistry.test.ts` pass |
| **AC-003** | Concurrency | SharedArrayBuffer 67,584B layout with atomic SeqLock (`syncFlags[0]`) preventing torn reads between Worker and 60 FPS UI. | Unit tests in `tests/memoryLayout.test.ts` pass |
| **AC-004** | Metabolism | Two-compartment metabolic model: Blood Glucose (0-2000 kcal), Adipose Reserve (15,000 kcal starting), BMR (70 kcal/h), and $I_{\text{clo}}$ clothing insulation thermogenesis equation. | Unit test in `tests/metabolism.test.ts` |
| **AC-005** | Biome DAG | 3-level hierarchical resource explorer: Category -> Species/Deposit -> Harvestable Part, with radial haul cost $E_{\text{haul}}(d)$ and Mohs tool advantage. | Unit test in `tests/biomeNodes.test.ts` |
| **AC-006** | Fabrication | Mechanical fabrication engine handling tool knapping, wood carving, dehairing, oak bark vegetable tanning, and Leather Backpack crafting. | Unit test in `tests/fabrication.test.ts` |
| **AC-007** | Inventory | Dedicated 6-slot Tool Menu (`CUTTING_SKINNING`, `CHOPPING_CARVING`, `PERCUSSION_MINING`, `THERMAL_HANDLING`, `STITCHING_MEDICAL`, `EATING_UTENSIL`) and container system (2 Bare Hand slots default; Leather Backpack 24-slot unlock; Camp Cache 6-slot). | Unit test in `tests/inventory.test.ts` |
| **AC-008** | Husbandry | Animal capture, Split-Rail Paddock maintenance, feed input, milk/manure/guano yields. | Unit test in `tests/husbandry.test.ts` |
| **AC-009** | Persistence | IndexedDB asynchronous save store (`chem_world_v1`) + Base64 `CompressionStream('gzip')` export/import. | Unit/Integration test in `tests/persistence.test.ts` |
| **AC-010** | UI Viewport | 4-panel responsive viewport: Top Telemetry Bar, Left Biome Explorer, Center Workbench / Fabrication Tabs, Right Tool Menu & Inventory Containers. | Webpack production build check & DOM integration test |
| **AC-011** | Bundle Budget | Strict webpack entrypoint budget <= 200,000 bytes with zero type errors. | `npm run build` succeeds without budget warnings |
