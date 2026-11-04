# AGENTS.md — Top-Down Strategy & Colony Labor System

This document outlines the architectural boundaries, contracts, invariants, and testing standards for human and autonomous AI agents working in this repository.

---

## 1. System Invariants & Non-Negotiable Budgets

1. **Low-Context Runtime Dependencies**:
   - `package.json` must have only `three` in `"dependencies"` (lazy-loaded via dynamic import). All other code runs on pure browser APIs (HTML5 Canvas, Web Audio API, Web Workers, `SharedArrayBuffer`).
   - Core simulation (<200 KiB entrypoint) has zero runtime deps — Three.js is isolated in a lazy view chunk.
   - The single allowed runtime dep is `three@0.160.0` (pinned), loaded only when the 3D strategy view opens.
2. **`SharedArrayBuffer` Memory Layout**:
   - `SAB_BYTE_LENGTH` is strictly **`67648`** bytes ([src/engine/memoryLayout.ts](file:///home/leandi-duplessis/github/workspaces/How%20to%20make%20soap/src/engine/memoryLayout.ts)).
   - Enforced by `tests/memoryLayout.test.ts`. Do not expand or alter this constant. High-level simulation entities (colonists, candidates, desire-path wear grids) are communicated via structured `postMessage` (`COLONY_SYNC`), not inside the raw SAB.
3. **Webpack Production Bundle Size**:
   - Entrypoint budget is `< 200,000` bytes (`webpack.config.js` `performance.maxEntrypointSize`).
   - Verified via `npm run build`.
4. **Clean TypeScript Compilation**:
   - `npx tsc --noEmit` must always pass with 0 errors.

---

## 2. Colony Engine Architecture (`src/engine/colony.ts`)

- **Colonist Archetypes**:
  - `FORAGER`: Rapid harvesting of flora, berries, and timber.
  - `MINER`: High mechanical advantage for hard ores (halite, copper, tin, zinc).
  - `HERBALIST`: Efficient apothecary harvesting (willow bark, mint, herbs).
  - `APPRENTICE_CHEMIST`: Camp workbench labor, vessel tending, and potion synthesis.
- **Desire Paths**:
  - `32×32` `Uint8Array(1024)` wear grid mapping `[-1600m, +1600m]`.
  - Traversing cells increments wear; natural overgrowth slowly decays unused trails.
  - Movement speed scales up to `+20%` along worn paths ($M_{\text{trail}} = 1.0 + 0.20 \times (\text{wear} / 255)$).
- **Craig Reynolds Boids Steering**:
  - Colonists navigate between camp hearth `(0, 0)` and assigned biome nodes.
  - Separation steering maintains minimum pairwise distances ($d \ge 3.5\text{ m}$) so workers fan out realistically rather than stacking on identical coordinates.
- **Multi-Commodity Wage Ledger & Morale**:
  - Commodities: `Food` (Cooked/Dried Meat, Berries), `Metals` (Copper, Tin, Bronze), `Medicines & Soap` (`BAR_SOAP`, Antiseptics), and `Chemical Stimulants` (`WILLOW_TEA`, `MINT_TONIC`, `NITROUS_TONIC`).
  - Daily payroll processed at tick rollover.
  - Morale $< 20$ triggers strike state (`STRIKE`), halting work until bonus or back-pay is provided.
- **Stimulant Pharmacokinetics**:
  - Two-phase pharmacokinetic model:
    1. **Boost Phase**: Work & travel speed increased (+20% to +55%), fatigue dampened.
    2. **Crash Phase**: Speed penalty (-5% to -25%) and morale dip upon timer expiration.

---

## 3. Top-Down Strategy Canvas & UI (`src/ui/StrategyMapCanvas.ts`)

- **Alchemical Cartography**:
  - Styled as a dark slate and brass astrolabe survey map (`#12151c`). Concentric range rings at 100m, 300m, 600m, 1200m, 1600m.
  - Concentric hearth glow at `(0, 0)` and dynamic diurnal lighting based on time of day (daylight at noon, amber twilight at dusk/dawn, slate-blue darkness at midnight).
- **Command Dock**:
  - Tavern recruitment drawer, active colonist roster cards, stimulant administration buttons, and wage contract policy selectors.
  - Canvas viewport supports pan, zoom, keyboard navigation (`+`/`-`, `WASD`/arrows, `Space` to center hearth).

---

## 4. Web Audio & Spatial Stereo Synthesis (`src/ui/audio.ts`)

- Procedural Web Audio engine with 0 sound asset files.
- **Spatial Panning**:
  - `worldXToPan(worldX: number, maxDistanceMeters = 1600): number`
  - Clamps world coordinates to stereo panning `[-1.0, 1.0]`.
  - Connects sound sources through `StereoPannerNode` where available with graceful fallback.
- **Procedural Sound Cues**:
  - `recruitHorn(worldX?)`: Brassy fifth chord fanfare (220Hz / 330Hz / 440Hz).
  - `wageClink(worldX?)`: Metallic coin resonance (1760Hz / 2637Hz / 3520Hz).
  - `stimulantShimmer()`: High rising arpeggio (587Hz to 1480Hz).
  - `strikeBell(worldX?)`: Dissonant tolling bell with low-frequency beating (130Hz & 138.59Hz).

---

## 5. Accessibility & WCAG 2.2 Compliance (`src/styles.css`)

- **Target Size (SC 2.5.8)**:
  - All interactive buttons (`.btn-harvest`, `.btn-slot-action`, `.recruit-btn`, `.btn-dock`, `.recruitment-card`, modal checkboxes) enforce a minimum bounding box of **`24×24 CSS px`**.
- **Story & Dialogue Overlays (SC 2.4.11)**:
  - `.story-overlay` has fixed positioning (`position: fixed; inset: 0; z-index: 1000;`) with full backdrop blur.
- **Focus Appearance (SC 2.4.13)**:
  - High-contrast dual-ring `:focus-visible` with `outline: 2px solid #5aa5ff; outline-offset: 2px;`.
- **Contrast & Reduced Motion**:
  - High contrast mode support (`body.high-contrast`, `@media (prefers-contrast: more)`, `@media (forced-colors: active)`).
  - `@media (prefers-reduced-motion: reduce)` disables animations and particle transitions.
- **ARIA Progress Bar**:
  - `#hud-renown` dynamically reflects progress via `aria-valuenow="0..100"`.

---

## 6. Verification Commands

Before submitting any code changes, ensure all verification gates succeed:

```bash
# Run unit test suite
npx vitest run

# Run TypeScript compilation check
npx tsc --noEmit

# Production build and asset bundle budget check (< 200 KiB)
npm run build
```
