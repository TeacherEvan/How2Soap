# G&L Auditor V2: Codebase Baseline State

**Document:** `docs/.scratch-audit/CODEBASE-STATE.md`  
**Run:** `run-001`  
**Commit Baseline:** `c4c53ac521917629cd3367e6bfd6584052e4cea6`  
**Date:** 2026-11-04  

---

## 1. System Metadata & Health

- **Architecture:** TypeScript 5.6.3, Webpack 5.112.2, Web Worker (`src/engine/sim.worker.ts`), SharedArrayBuffer + SeqLock (`src/engine/memoryLayout.ts`), Canvas 2D & WebGL2 (`src/ui/gl/`).
- **Tests:** 44 test suites, 223 tests passing via Vitest.
- **Typecheck:** Clean compilation (`npx tsc --noEmit` exits 0).
- **Bundle Budget:** Production entrypoint size is `194 KiB` (Budget: `< 200,000` bytes).
- **Runtime Dependencies:** 0 in `"dependencies"`.

---

## 2. Directory Layout & Key Modules

- `src/main.ts`: Application bootstrap, orchestration, topbar controls, and canvas loop.
- `src/styles.css`: Core layout styles, topbar, HUD panels, and theme variables.
- `src/ui/WindowManager.ts`: Dialog & feature window management (`role="dialog"`, focus trap, ESC).
- `src/ui/windows/`: Feature window implementations (`BiomeWindow.ts`, `FabricationWindow.ts`, `PaddocksWindow.ts`, `ReactionsWindow.ts`, `windows.css`).
- `src/ui/TutorialController.ts` & `tutorialCurriculum.ts`: 3-Tier academy, coachmark banner, and lesson curricula.
- `src/data/items.ts`: 50+ item definitions (`ITEM_BY_ID`, `ITEMS`).
- `src/engine/sim.worker.ts`: Web Worker simulation tick loop, message handling, chemistry and colony updates.
- `src/engine/memoryLayout.ts`: `SAB_BYTE_LENGTH = 67648` invariant.

---

## 3. Identified Plan Gaps & Reconciliation Directives

1. **Item ID Discrepancies:** The overhaul plan references fictional item IDs (`timber_hardwood`, `raw_suet`, etc.). The actual codebase uses canonical IDs (`PINE_DEADFALL_WOOD`, `RAW_ADIPOSE_FAT`, `HALITE_SALT`, `BAR_SOAP`). Plan execution must map to canonical IDs to avoid breaking 44 test suites.
2. **SAB Invariant Protection:** The plan text suggests expanding SAB for timed requests with 24 floats. However, `AGENTS.md` strictly prohibits modifying `SAB_BYTE_LENGTH` (`67648`). Therefore, timed request state must be synchronized via structured `postMessage` (`REQUEST_SYNC` / `PLAYER_SYNC`), matching how `colony.ts` and `crisis.ts` operate.
