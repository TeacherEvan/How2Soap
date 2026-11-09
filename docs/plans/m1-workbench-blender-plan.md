# M1 Workbench & Map Blender Animation Plan — Experiments + Visual Feedback

**Source Plan:** Plastic Surgery Blueprint (Mobile + Private + Adult, Dark-first obsidian, High-intensity particles) + M0 Visual Foundation (`docs/plans/M0-visual-foundation-plan.md`)
**Global Constraints (from AGENTS.md):**
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
- DPR clamp [1, 2], ≤2 blur layers ≤16px radius, ≤150-300k tris / ≤200 draw calls, frame budget 16.67ms (60Hz) / render ≤6.67ms / ≤2 blurs

---

## Task 7: Animation runtime core (miniGl + kinetic)
**Files:** `src/ui/gl/miniGl.ts`, `src/ui/gl/lowPolyMeshes.ts`, `src/ui/gl/kinetic.ts` (new)
**Defect:** miniGl is static-only (positions/normals/indices + uColor); LabBench shows no baked loops. No expDecay/spring utility in tree.
**Fix:** Add unconditional-bounded `expDecay(current,target,decay,dt)` via `Math.exp(-decay*dt)` and `stepSpringSubstepped(pos,vel,target,stiffness,damping,dt)` with dt clamp 0.1s + sub-step ≤8.33ms (never cap step count). Extend `GlMeshBuffers` with optional `animation?: Float32Array` keyframe offsets + `uTime/uPoseWeight` uniforms (default 0 = static, zero visual change when unused). Define `AnimationClip { fps, loop, frames: Float32Array[] }` type alongside `MeshGeometry`. Preserve existing exports, mat4 helpers, and all callsites.
**Preserve:** All existing uniforms (uProjection/uView/uModel/uColor/uLightDir), mesh keys (WOOD_BUCKET/CERAMIC_CRUCIBLE/HEARTH_BRAZIER/COLONIST_PAWN/BIOME_CRYSTAL), function signatures.
**Acceptance:** `npx tsc --noEmit` clean; `npx vitest run tests/kinetic.test` (create tiny unit test for expDecay convergence + spring stability, stable at 120Hz) green; no bundle regression.

---

## Task 8: Blender pipeline (workbench actions + sprite bake)
**Files:** `blender/scripts/build_workbench.py` (new), `blender/scripts/bake_sprites.py` (new), `blender/scripts/export_glb.py` (tweak animation sampling), `blender/templates/README.md` (budgets note)
**Defect:** build_assets.py exports 6 static assets only (grass/tile/tree/rock/house/mine/colonist-unanimated); no workbench hero rigs, no particle sheets, GLB loader unused at runtime.
**Fix:** Create build_workbench.py (headless `blender --background --python`) that builds Workbench hero meshes + baked Actions (30fps loops): `hearth_flame` (brazier cone squash + flicker), `bellows_pump`, `pour_stream` (bezier ribbon), `stir_vortex`, `boil_shake`, `liquid_fill` (0-100% morph), `crystal_shimmer`, `colonist_walk_idle`. Create bake_sprites.py that renders Eevee 256px sprite sheets (flame 4x4, ember, fume, bubbles) to `src/assets/sprites/*.png` (atlas grid documented). Update export_glb.py: `export_animations/sampling=True`, `export_animation_mode='SKINNING'` or `ACTIONS`, Draco OFF <2k tris / ON terrain. Update templates README polygon budgets for workbench (hero 1500-4000, char 800-3000). Python must `py_compile` clean.
**Preserve:** build_assets.py/export_glb.py existing asset names + budgets; no JS bundle imports of GLB (GLB stays out of entrypoint — baked to Float32Array/sprite PNG instead).
**Acceptance:** `python3 -m py_compile blender/scripts/*.py` exit 0; `blender --background --python blender/scripts/build_workbench.py -- --help` (or import check) dry-run clean; sprite PNGs if rendered exist with claimed sizes; script headers document usage.

---

## Task 9: LabBench experiment drive (kettle + vessel feedback)
**Files:** `src/ui/gl/LabBench3DCanvas.ts`, `src/ui/windows/ReactionsWindow.ts`, `src/ui/SoapKettleModal.ts`, `src/ui/SoapKettleMiniGame.ts` (visual hook only)
**Defect:** LabBench renders vessels with single sin pulse; SoapKettle phases (POURING/HEATING/STIRRING via lyeVolume/temperatureC/tracePct) have no mesh binding — experiments feel flat.
**Fix:** Drive LabBench3DCanvas from VesselState + KettleState: liquid-fill morph scales with moles, heating glow envelope = f(heaterWatts, temperatureK via expDecay), boilover shake >105°C triggers boil sprites, stir vortex weight = tracePct/100 on STIRRING, pour stream visible on POURING. Freeze loops at midpoint when prefers-reduced-motion (matchMedia check). Clamp DPR [1,2] in resizeCanvas precedent; reserve canvas bounds (no CLS). Use kinetic.expDecay/stepSpring for all blends (dt in seconds).
**Preserve:** All callbacks (onSelectVessel, onBatchComplete, couplingEffects), vessel ids, TELEMETRY/species moles wiring, ARIA/test IDs, phase logic numbers untouched.
**Acceptance:** `npx tsc --noEmit` clean; `npx vitest run tests/soapKettleMiniGame.test` (or full) green; linter HIGH = 0; bundle <200KB; no change to phase thresholds (45-55%, 80-95°C).

---

## Task 10: Map feedback drive (colonist + biome + hearth loops)
**Files:** `src/ui/StrategyMapCanvas.ts`, `src/ui/mapMath.ts` (helpers only), `src/ui/gl/lowPolyMeshes.ts` (new clip references only)
**Defect:** Map is static hex fills + one sin hearth pulse; colonists are tokens with no gait, biomes no sway, desire-path/road/hearth no loops.
**Fix:** Drive from ColonyState + minuteOfDay: colonist walk/idle/harvest per archetype tint (getArchetypeColor) with stimulant surge gait (+20-55%) / crash slump (-5-25%) via expDecay pose blend; biome sway amplitude 2-4px (tree/bush/water/crystal) as vertex-offset loops; hearth smoke/glow scaled by computeDiurnalLighting.hearthRadiusPx; desire-path fade by wear (alpha from computeDesirePathAlpha) + road >96; hotspot TimingRingStrike shrink + fog sweep as pooled sprites. All sprite draws capped (≤200 calls), reduced-motion freezes to posed frame, DPR clamped [1,2].
**Preserve:** Hex generation (seed 1337, radius 10), viewport pan/zoom (pointer events), onRecruit/onAssignJob/onAdministerStimulant/onSetWageContract/onHarvestBoost callbacks, biome/RoadWear logic, COLONY_SYNC postMessage (never SAB).
**Acceptance:** `npx tsc --noEmit` clean; map tests green; linter HIGH = 0; bundle <200KB; no logic change to colony/diurnal math.

---

## Task 11: Verify & gate (M1)
**Commands:** 
- `python3 ~/.hermes/skills/plastic-surgery/scripts/preflight_visual_lint.py src --fail-on high`
- `npx vitest run`
- `npx tsc --noEmit`
- `npm run build`
- `python3 -m py_compile blender/scripts/*.py`
**Acceptance:** All gates pass; linter score ≥ 90; bundle < 200 KB; measured report with exit codes, entrypoint bytes, and headroom.
