# M0 Visual Foundation Plan — Plastic Surgery for Strategy Map & World

**Source Plan:** `docs/plans/2026-11-05-civ7-4x-conversion-plan.md` (M0 section + D1–D4 defects)
**Global Constraints (from AGENTS.md + Conversion Plan):**
- SAB_BYTE_LENGTH = 67648 (immutable)
- three@0.160.0 lazy-loaded only; entrypoint < 200,000 bytes
- npx tsc --noEmit = 0 errors
- npx vitest run = green
- npm run build = under budget
- WCAG 2.2: ≥24px targets (≥44px coarse), :focus-visible dual ring #5aa5ff, prefers-reduced-motion + prefers-contrast + forced-colors blocks
- Compositor-only animations (transform/opacity only — no width/height/top/left/margin/padding)
- font-variant-numeric: tabular-nums on all live numbers
- oklch() perceptual color system, +3–4% lightness per z-layer, specular top edges
- Six-state tactile buttons (rest→hover→active→focus→loading→disabled)
- DPR clamp [1, 2], ≤2 blur layers ≤16px radius

---

## Task 1: Fix HIGH-severity layout thrashing (D4)
**File:** `src/ui/timedRequests.css:89`
**Defect:** `.req-progress-fill { transition: width }` triggers layout reflow
**Fix:** Replace with `transform: scaleX()` on fixed-width wrapper (compositor-only)
**Preserve:** All existing selectors, data attributes, ARIA, test IDs
**Acceptance:** Preflight linter passes with `--fail-on high`

---

## Task 2: Import orphaned stylesheets (D1, D2)
**Files:** `src/ui/windows/windows.css` (209 LOC), `src/ui/soapKettle.css` (123 LOC)
**Defect:** Imported nowhere — windowed UI ships unstyled in prod
**Fix:** Import from `src/main.ts` (eager, ~4 KB total) or merge into chunk CSS
**Preserve:** All existing rules; no behavioral changes
**Acceptance:** Both stylesheets loaded in production build; no console 404s

---

## Task 3: Strategy Map CSS contract fix (D3)
**Files:** `src/ui/StrategyMapCanvas.ts` (emits `.strategy-layout`, `.strategy-viewport-container`, `.strategy-map-canvas`, `.map-controls`) vs `src/styles.css:1444-1529` (defines `.strategy-canvas`, `.map-controls-overlay`)
**Fix:** Unify on ONE contract — update CSS to match JS emit (or vice versa) so map renders correctly
**Preserve:** All data-action, data-* attributes, callbacks, test selectors
**Acceptance:** Strategy Map tab renders canvas + dock side-by-side correctly; no blank columns

---

## Task 4: Map control buttons → 44px tactile six-state buttons
**Files:** `src/styles.css:1483-1495` (`.map-btn`), `src/ui/StrategyMapCanvas.ts:119-123` (buttons)
**Current:** 28×28px, basic hover only
**Target:** 44×44px min (coarse pointer), six-state (rest/hover/active/focus/loading/disabled), oklch colors, specular top-edge, compositor-only transforms
**Preserve:** `data-action="zoom-in|zoom-out|center|toggle-relief"`, click handlers
**Acceptance:** Buttons meet 44px touch target; linter shows zero LAYOUT_THRASHING

---

## Task 5: Perceptual biome color system (oklch tokens)
**Files:** `src/styles.css` (new `:root` tokens), `src/ui/StrategyMapCanvas.ts:547-555` (biome fills), `src/ui/mapMath.ts:109-122` (archetype colors)
**Current:** Flat hex fills (`#4caf50`, `#e0a458`, etc.) — poor luminance separation
**Target:** oklch biome tokens with perceptual luminance steps; anti-banding 1.5% SVG dither on relief underlay
**Preserve:** Biome category logic, hex grid rendering, desire path wear rendering
**Acceptance:** Each biome visually distinct at zoom 0.08; no posterization on relief underlay

---

## Task 6: Verify & gate
**Commands:** 
- `python3 ~/.hermes/skills/plastic-surgery/scripts/preflight_visual_lint.py src --fail-on high`
- `npx vitest run tests/strategyMapCanvas.test.ts tests/strategyMapTiming.test.ts tests/hexMap.test.ts`
- `npx tsc --noEmit`
- `npm run build`
**Acceptance:** All gates pass; linter score ≥ 90; bundle < 200 KB
