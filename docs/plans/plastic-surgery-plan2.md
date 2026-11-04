# Master-Tier Plastic Surgery Blueprint: "The Alchemical Crucible"

> **Execution Directive**: Push the visual, auditory, and kinetic envelope of the game to maximum aesthetic depth without adding a single byte of external dependencies, keeping Webpack entrypoint strictly under the `< 200,000` byte budget, with 100% zero functional regression.

---

## 1. System Architecture & Aesthetic Direction

### A. The "Dark Gritty Industrial Alchemy" Identity
- **Palette**: Obsidian & lead slate (`#090c10` / `#12161f`), tarnished forged brass (`#c89228` / `#dfa83b`), corroded copper verdigris (`#2c6e64`), caustic vitriol emerald (`#38b764`), and smoldering hearth embers (`#d9572b`).
- **Surface Depth Hierarchy**:
  - `Base Floor`: Matte basalt grid with 1.5% sub-perceptual dithering to eliminate 8-bit gradient banding.
  - `Chassis Plates`: Cold-rolled steel plates with $1\text{px}$ brass specular edge highlights (`inset 0 1px 0 rgba(223, 168, 59, 0.22)`).
  - `Floating Instruments`: High-relief drop shadows with dual-source occlusion: `0 8px 32px -4px rgba(0,0,0,0.85), 0 2px 4px 0 rgba(0,0,0,0.6)`.

---

## 2. Deep Component-by-Component Upgrade Specifications

### I. Cinema-Grade Intro Splash Screen (`src/app/splash.ts` & `src/styles.css`)
**Current**: A bare HTML `<video>` element with a plain text hint that suddenly fades out.

**Master-Tier Overhaul**:
1. **Dynamic Industrial CRT / Astrolabe HUD Overlay**:
   - High-precision CSS radial vignetting (`radial-gradient(circle at 50% 50%, transparent 45%, rgba(6, 9, 13, 0.88) 100%)`).
   - Micro-line scanline raster mesh (`repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, transparent 1px, transparent 2px)`) creating a retro-mechanical viewfinder depth without canvas overhead.
   - Astrolabe optical reticle pips at the four corners ($12\text{px}$ machined bracket marks in `#c89228`).
2. **Tactile Mechanical Skip Badge**:
   - Stamped brass keycap pill (`<kbd class="splash-key">ESC</kbd> <span>or Click anywhere to skip</span>`).
   - Radial amber breathing pulse (`box-shadow: 0 0 20px -2px rgba(223, 168, 59, 0.35)`).
   - Hover magnification with instant tactile depression on click.
3. **Multi-Stage Aperture Dissolve (Exit Animation)**:
   - When skipped or finished, the splash doesn't just fade opacity; it executes a **camera push & iris dissolve**:
     - Video scales smoothly to `scale(1.04)` over $550\text{ ms}$.
     - Background layer dissolves with cubic ease `cubic-bezier(0.16, 1, 0.3, 1)`.
     - Synthesized mechanical shutter/steam hiss SFX triggers via Web Audio (`audio.ts`).

---

### II. High-Precision Vector Icon Matrix (`src/ui/icons.ts`)
**Current**: Single-path icons with flat opacity fills (`fill-opacity="0.15"`).

**Master-Tier Overhaul**:
Every icon in the 64-item registry gets an alchemical facelift:
1. **Multi-Tone Visual Depth**:
   - Secondary interior hatching and graduation pips (e.g. volumetric lines on `flask`, `pot`, `vial`, `cell`, and `trough`).
   - Dimensional bevel shadows on hard tools (`hammerstone`, `adze`, `blade`, `axe`, `spear`, `mold`).
2. **Dynamic Reactive Glowing Variants**:
   - Reusable SVG gradient & filter definitions embedded once:
     - `#brass-foil`: Multi-stop metallic brass gradient.
     - `#vitriol-glow`: Subtle radial luminescent drop-shadow for active acids/reagents (`salicylic_acid`, `penicillin`, `nitrous`).
     - `#ember-burn`: Smoldering highlight for `charcoal`, `pyrite`, and crucible heat.
3. **Zero Layout Thrashing & Vector Sharpness**:
   - Perfect alignment to standard $24\times 24$ sub-pixel raster grid with crisp vector stroke endings (`stroke-linecap="round"` & `stroke-linejoin="round"`).

---

### III. Heavy Industrial Window Chassis & Kinetic Springs (`src/ui/windows/`)
**Current**: Standard CSS translate/scale popup with simple backdrop blur.

**Master-Tier Overhaul**:
1. **Dual-Plate Machined Bezel Architecture**:
   - Windows feature a dark graphite outer casing (`#0f131a`) surrounded by an embossed brass bevel rim with simulated corner hex bolts (`::before`/`::after` micro-rivets).
   - Titlebars evoke an engraved brass nameplate with embossed tracking (`letter-spacing: 0.08em; text-transform: uppercase; font-family: monospace;`).
2. **Double-Phase Kinetic Spring Deployment**:
   - Modal backdrop utilizes a rapid $120\text{ ms}$ shutter tint.
   - The window chassis springs into view using critically-damped spring timing:
     ```css
     transform: translate(-50%, -48%) scale(0.95);
     /* Unlatches with physical inertia into rest */
     animation: window-unlatch 260ms cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
     ```
3. **Tactile Header Controls**:
   - Close button styled as a recessed steel latch button that physically depresses $1.5\text{px}$ into the chassis with an audible procedural brass clink.
   - Launcher tab bar transformed into a heavy mechanical rotary selector dock with active notch indicators.

---

### IV. Synthesized Mechanical Soundscape (`src/ui/audio.ts`)
**Current**: Good procedural sound, but missing UI tactile cues (window clicks, button snaps, shutter releases).

**Master-Tier Overhaul**:
Add 3 zero-asset procedural Web Audio instruments:
1. `uiLatchClick(pitch = 1.0)`: Micro metallic solenoid click using dual high-Q bandpass noise bursts ($2.4\text{kHz}$ & $4.8\text{kHz}$, $12\text{ms}$ duration).
2. `uiHeavyVent()`: Low-frequency pneumatic hiss for window open/close ($180\text{Hz}$ downsweep with filtered white noise).
3. `uiMetalPing()`: Resonant bell ping for successful crafts and mandate completions.

---

### V. Six-State Tactile Button Physics Engine (`src/styles.css`)
**Current**: Standard CSS hover states with varying padding.

**Master-Tier Overhaul**:
- Standardize all interactive buttons (`.btn-harvest`, `.btn-slot-action`, `.recruit-btn`, `.btn-dock`, `.launcher-btn`):
  1. **Resting**: High-density bevel, inset specular highlight, 0 resting 3D transforms.
  2. **Hover**: Smooth $120\text{ms}$ magnetic lift (`translate3d(0, -1.5px, 0)`), amber brass corona glow via `::after`.
  3. **Active/Pressed**: $\le 16\text{ms}$ instantaneous depression (`translate3d(0, 1.5px, 0) scale(0.98)`), inner shadow pocketing, tactile Web Audio latch click.
  4. **Focus-Visible**: High-contrast astrolabe dual-ring targeting reticle.
  5. **Loading**: Pulse shimmer lock, preserving fixed button dimensions.
  6. **Disabled**: Oxidized slate patina, pointer locked, reduced opacity.
- **Zero Numeric Jitter**:
  - Enforce `font-variant-numeric: tabular-nums` globally across all telemetry readouts, clocks, worker wages, and vessel fill counters.

---

## 3. Strict Verification & Integrity Protocol

Every change must pass our verification gates:
1. `npx tsc --noEmit` — 0 TypeScript errors.
2. `npx vitest run` — 100% test suite passing.
3. `python3 preflight_visual_lint.py . --fail-on high` — Clean visual linting.
4. `npm run build` — Entrypoint strictly `< 200 KiB` (Current baseline: `194 KiB`).
5. Accessibility: SC 2.5.8 (touch targets $\ge 24\text{px}$), SC 2.4.13 (focus visibility), and `@media (prefers-reduced-motion: reduce)`.
