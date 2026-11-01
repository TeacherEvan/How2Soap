# ARCHITECTURE.md — Target Architecture & System Design

## 1. System Topology & Data Flow

```
+--------------------------------------------------------------------------------+
| MAIN THREAD (60 FPS DOM / Canvas / UI Event Loop)                              |
|                                                                                |
|  +--------------------+     +-------------------+     +---------------------+  |
|  | Top Telemetry Bar  |     | BiomeTreePanel    |     | Tool & Inventory    |  |
|  | Glucose, Temp, Day |     | 3-Level DAG & Run |     | 6 Tools, Hands, Pack|  |
|  +--------------------+     +-------------------+     +---------------------+  |
|            |                          |                          |             |
|            +--------------------------+--------------------------+             |
|                                       |                                        |
|                          +------------------------+                            |
|                          | Center Workbench Panel |                            |
|                          | Reactions, Fabricate   |                            |
|                          +------------------------+                            |
|                                       |                                        |
|                     +-----------------+-----------------+                      |
|                     | Atomic SeqLock Poller (Float64)   |                      |
|                     | Reads snapshot at 60 FPS          |                      |
+---------------------+-----------------+-----------------+----------------------+
                                        |
                           SharedArrayBuffer (67,648 B)
                           [syncFlags, telemetry, moles]
                                        |
+---------------------+-----------------+-----------------+----------------------+
| WORKER THREAD (10 Hz Deterministic Simulation Loop)                            |
|                                                                                |
|  +-------------------+      +-------------------+      +--------------------+  |
|  | Physical Chemistry|      | Bio-Metabolism    |      | Fabrication &      |  |
|  | Arrhenius, pH,    |      | Glucose, Adipose, |      | Hardness Mechanics |  |
|  | Boiling, Ksp      |      | Thermogenesis     |      | Knap, Carve, Tan   |  |
|  +-------------------+      +-------------------+      +--------------------+  |
|                                       |                                        |
|                              Authoritative World                               |
|                          vessels[], player, inventory                          |
+--------------------------------------------------------------------------------+
```

## 2. Areas Being Created / Updated

| Module | Purpose | Interfacing APIs |
| :--- | :--- | :--- |
| `src/data/biomeNodes.ts` | Complete hierarchical resource definitions for Trees, Rocks, Flora, Animals | Consumed by `BiomeTreePanel.ts` and `fabrication.ts` |
| `src/engine/metabolism.ts` | Blood Glucose, Adipose Reserves, BMR, environmental heat transfer, shivering/sweating | Stepped in `sim.worker.ts` each tick |
| `src/engine/fabrication.ts` | Tool durability & Mohs rating, flint knapping, wood hollow carving, hide dehairing, tannin steeping, leather stitching | Dispatched via worker commands from UI |
| `src/engine/husbandry.ts` | Animal paddock management, feeding, milk/manure generation | Integrated into world simulation loop |
| `src/engine/persistence.ts` | IndexedDB `chem_world_v1` save/load with gzip compression | Invoked from Settings modal / Topbar controls |
| `src/ui/ViewportGrid.ts` | CSS Grid orchestrator integrating 4 panels | Bootstrapped in `src/main.ts` |
| `src/ui/BiomeTreePanel.ts` | Interactive collapsible tree rendering with tool-scaled kcal costs | Renders left panel |
| `src/ui/ToolAndInventoryPanel.ts` | 6 dedicated tool slots, 2 Bare Hands slots, locked/unlocked Backpack grid | Renders right panel |
| `src/ui/WorkbenchCanvas.ts` | Vessel monitoring, reaction progress, heating controls, decanting & skimming | Center panel tabs |
| `src/ui/MenuController.ts` | Main menu, settings modal, compendium view, export/import save data | UI overlay layer |

## 3. Concurrency & Security Boundaries
- **SeqLock Protocol**: UI thread NEVER writes to the SharedArrayBuffer. UI sends postMessage commands (`POST_ACTION`, `HARVEST`, `FABRICATE`, `TICK_SPEED`). Worker holds authoritative state, executes tick computations, updates internal models, and writes a zero-copy atomic frame to `SharedWorldView` with SeqLock odd/even guards.
- **COOP/COEP Headers**: Verified in `vercel.json` and checked gracefully on boot in `main.ts` with friendly fallback instructions if isolation is not supported.
