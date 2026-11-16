# AGENTS.md — How2Soap Runtime Invariants & Developer Commands

This file contains hard-earned context that agents typically miss. If it's obvious from filenames or standard tooling, it's not here.

---

## ⚡ Non-Negotiable Budgets (enforced in CI)

| Constraint | Value | Verified By |
|------------|-------|-------------|
| **Runtime deps** | `three@0.160.0` only (lazy-loaded) | `package.json` |
| **SAB byte length** | `67648` bytes exactly | `tests/memoryLayout.test.ts` |
| **Entrypoint bundle** | `< 200,000` bytes | `webpack.config.js` + `npm run build` |
| **TypeScript** | Strict, zero errors | `npx tsc --noEmit` |

> **Do not** add runtime deps. Do not change `SAB_BYTE_LENGTH`. The layout arithmetic in `src/engine/memoryLayout.ts` is the source of truth (64 + 2048 + 65536 = 67648).

---

## 🏃 Developer Commands (exact)

```bash
# Dev server (COOP/COEP headers enabled for SharedArrayBuffer)
npm start          # or: npm run dev

# Type-check (must pass before commit)
npx tsc --noEmit

# Unit tests (93 suites, 469 tests)
npm test           # or: npx vitest run

# Production build (bundle budget check)
npm run build
```

**Order matters**: `typecheck → test → build` — all three must pass.

---

## 🧠 Architecture Notes (not obvious from files)

### Entry & Threading
- **Entrypoint**: `src/main.ts` (~360 LOC) — only wiring, COOP/COEP detection, and boot.
- **Web Worker**: `src/engine/sim.worker.ts` runs at 10 Hz deterministic loop. Communicates via `postMessage` with `SharedArrayBuffer` (SeqLock at `syncFlags[0]`).
- **Main thread UI**: 60 FPS, reads snapshots via `SharedWorldView.readSnapshot()`.
- **Three.js** is lazy-loaded only when 3D views open (`src/ui/gl/Surgical3DView.ts`, `StrategyMapCanvas.ts` → `vendors` chunk).

### Memory Layout (zero-copy)
```
0–63        syncFlags: Int32Array(16)  [0]=SeqLock, [1]=world tick
64–2111     vesselTelemetry: 32×8 Float64 (temp, pH, pressure, volume, maxTemp, maxPressure, heaterW, flags)
2112–67647  vesselMoles: 32×256 Float64  (species amounts per vessel)
```
- **Never** put high-level entities (colonists, desire paths) in SAB. They use `COLONY_SYNC` postMessage.
- `MAX_VESSELS = 32`, `MAX_SPECIES = 256` are hard constants.

### Chem/Physics Engine (pure TS, zero deps)
- `src/engine/chemistry.ts` — calorimetry, phase-clamping boiling, electroneutrality pH, Faraday electrolysis.
- `src/engine/metabolism.ts` — dual-compartment human model (blood glucose + adipose), pathology (sepsis, hypothermia).
- `src/engine/fabrication.ts` — Mohs hardness, mechanical recipes, tool system.
- Species registry: `src/data/speciesRegistry.ts` (38 species with thermodynamic properties).
- Reaction rules: `src/data/reactionRules.ts` (Arrhenius kinetics, precipitation, electrolysis).

### Campaign Layer (hex map, settlements, politics)
- Hex axial coordinates in `src/engine/campaign/hexMap.ts`.
- Settlements, influence, patrons, built works, districts, missions — all under `src/engine/campaign/`.
- **Dormant systems** (not yet wired): `src/engine/campaign/dormant/` — incubations, harbours, deep mine, codex exchange, etc.

### UI & Accessibility
- **Canvas 2D**: `StrategyMapCanvas.ts` (top-down), `WorkbenchCanvas.ts` (multi-tab).
- **Web Audio**: `src/ui/audio.ts` — 100% synthesized, 0 asset files.
- **WCAG 2.2 AA**: Target size ≥ 24×24 CSS px (`.btn-harvest`, `.recruit-btn`, etc.), focus-visible rings, reduced-motion, high-contrast support in `src/styles.css`.

---

## 🔧 Common Gotchas

| Issue | Cause | Fix |
|-------|-------|-----|
| `SharedArrayBuffer` unavailable | Missing COOP/COEP headers | Dev server sets them via `webpack.config.js`; Vercel via `vercel.json` |
| Bundle exceeds 200 KiB | Accidental eager import of `three` | Keep Three.js in lazy chunks only (`import()` in view components) |
| TypeScript "noUnusedLocals" errors | Unused imports/variables | Delete or prefix with `_` |
| Worker silent failures | Unknown command not handled | `workerMessages.ts` dispatch is exhaustive; new commands must be added there |
| `readSnapshot` throws | SeqLock contention (odd counter) | Retry logic in `SharedWorldView.readSnapshot(maxAttempts=32)` |

---

## 📁 Key Files to Know

```
src/main.ts                    # Boot & wiring only
src/engine/memoryLayout.ts     # SAB layout + SeqLock (SOURCE OF TRUTH)
src/engine/sim.worker.ts       # 10 Hz simulation loop
src/engine/chemistry.ts        # Core physics/chem solvers
src/app/workerMessages.ts      # Worker→UI command dispatch (exhaustive)
src/ui/StrategyMapCanvas.ts    # Top-down canvas + command dock
src/ui/WorkbenchCanvas.ts      # Reaction/fabrication/journal tabs
src/styles.css                 # Dark theme, WCAG, responsive
webpack.config.js              # Chunk splitting, COOP/COEP, bundle budgets
vercel.json                    # Production isolation headers
```

---

## 🧪 Test Conventions

- **No integration test server** — all tests are pure Vitest unit tests.
- **Determinism**: `tests/rng.test.ts` verifies seeded RNG stream.
- **Worker protocol**: `tests/workerDispatch.test.ts` asserts exact message shapes.
- **Bundle lazy imports**: `tests/bundle-lazy-imports.test.ts` ensures Three.js stays out of entrypoint.
- **Memory layout**: `tests/memoryLayout.test.ts` is the contract for `SAB_BYTE_LENGTH`.

---

## 📌 If You Change These, Update The Other

| Change | Must Also Update |
|--------|------------------|
| `MAX_VESSELS` / `MAX_SPECIES` | `memoryLayout.ts`, `memoryLayout.test.ts`, `chemistry.ts` vessel loops |
| `WAGE_COMMODITIES` | `colony.ts`, `StrategyMapCanvas.ts` wage selectors |
| Worker command types | `workerMessages.ts` dispatch + `tests/workerDispatch.test.ts` |
| `SAB_BYTE_LENGTH` | **Never change** — arithmetic is the contract |
| Three.js version | `package.json`, `tsconfig.json` `@types/three`, `webpack.config.js` vendor chunk |

---

## 🚢 Deploy

- **Vercel**: Push to main → auto-deploy with `vercel.json` headers.
- **PWA**: `public/sw.js` (cache-first), `public/manifest.webmanifest`.
- **No server** — fully static, offline-capable.