# Blender Workbench Resources — Implementation Plan

**Date:** 2026-11-09
**Mode:** Project-Manager Plan-First (draft only — no build until you approve)
**Target:** Current workspace (How to make soap)
**Mission (user's words):** draft an implementation plan on blender resources that need to be created to replace elements in the current codebase to make it more appealing and easier to work on the workbenches

## Current state summary

The game is a chemistry-first survival engine (25,100 TS lines in src, 88 vitest files, SAB 67648B immutable in src/engine/memoryLayout.ts:14) whose workbenches are today DOM + inline SVG + procedural WebGL2, not Blender assets: src/ui/WorkbenchCanvas.ts renders 5 emoji tabs + recipe cards, src/ui/windows/FabricationWindow.ts is a searchable master/detail browser with text pack-chips, src/ui/windows/ReactionsWindow.ts:60 hosts a 180px bench-3d-host driven by src/ui/gl/LabBench3DCanvas.ts:62 (miniGl uColor-only shader, uPoseWeight/uTime loops, DPR clamped [1,2], reduced-motion freeze) over 5 Blender-generated Float32Array meshes in src/ui/gl/lowPolyMeshes.ts (WOOD_BUCKET/CERAMIC_CRUCIBLE/HEARTH_BRAZIER/COLONIST_PAWN/BIOME_CRYSTAL from scripts/make-3d-assets/generate_diorama_meshes.py on Blender 5.2.2 LTS); production entry is about 48KB + 42KB (budget under 200,000B, webpack.config.js:118, assetFilter excludes mp4/webm/map) with lazy chunks at dist/static/js/*.chunk.js; Blender already exports 8 workbench GLBs to public/assets/workbench/ (14-30KB each, about 188KB total: hearth_flame/bellows_pump/pour_stream/stir_vortex/boil_shake/liquid_fill/crystal_shimmer/colonist_walk_idle via blender/scripts/build_workbench.py, 30fps baked Actions) plus 6 static GLBs (terrain/buildings/characters/props) and 4 tutorial PNGs (124-167KB each) plus sprite PNGs (flame 160KB/fume 127KB/bubbles 82KB/ember 72KB) that miniGl explicitly does NOT import (sprite-free drive in LabBench3DCanvas.ts:15), and three@0.160.0 is declared but has zero imports in src — the 3D path is miniGl, not three.

## Target state

Blender-built workbench dressing that makes Reaction Workbench, Fabrication Bench, Soap Kettle station, and Paddocks more appealing and easier to work on — without breaking the AGENTS.md invariants (SAB 67648, entrypoint under 200KB, tsc clean, WCAG 2.2).

Concretely: hero stations + vessel/tool props with real silhouettes and PBR-ish vertex/baked color, 30fps loops that read game state (heater to glow, pour to stream, stir to vortex, boil to shake, fill to morph), and sprite/emissive treatments that stay inside the bundle and frame budgets — so players see what it is doing, not just a text table.

This plan names what to create in Blender, what to bake, and what to wire in TypeScript. It does NOT replace simulation logic (worker stays authority), does NOT import GLBs into the JS entry, and does NOT replace the a11y-critical SVG icon system.

## Gap analysis

### What exists (do not rebuild)

| Area | File / asset | Status |
|---|---|---|
| Bench 3D runtime | src/ui/gl/LabBench3DCanvas.ts, miniGl.ts, kinetic.ts | Done (expDecay/spring, uTime/uPoseWeight, DPR/freeze) |
| Static meshes | lowPolyMeshes.ts (5 meshes) | Done, quantized 3-decimals |
| Workbench GLBs | public/assets/workbench/*.glb (8) | Exported, never loaded — no GLTFLoader/bake |
| Static GLBs | public/assets terrain/buildings/characters/props (6) | Exported, manifest only |
| Sprite bake spec | blender/scripts/bake_sprites.py, blender/templates/README.md flame 128px cells | Spec done; JS sampler missing |
| Fabrication brain | src/ui/fabricationModel.ts (pure feasibility) | Done — worker is authority |
| Icons | src/ui/icons.ts (24x24 stroke, currentColor) | Done — tree-shakeable, a11y-safe |

### What is missing (the actual work)

1. No downstream bake. workbench_actions.json contract says: Downstream Float32Array bake MUST combine exported_channels (from GLB) with blender_only_channels (manifest). There is no JS bake script, no clip Float32Array outputs, and LabBench3DCanvas hard-codes pour/bubble quads. Two channels are Blender-only and will be silently lost if we bake GLB-only: pour_stream curve.offset UV flow and crystal_shimmer material emission-strength curve (verified in blender/templates/workbench_actions.json).
2. Mesh coverage is thin. Only bucket/crucible/brazier/pawn/crystal. Missing: kettle cauldron, trough, electrolysis cell, voltaic pile, bellows hero, charcoal clamp, fermentation pot, mortar/pestle, bench table itself, paddock fence/feed/water props, tool-prop set (adze/awl/knife/tongs/fork). The plan must create these.
3. No sprite sampler in miniGl. miniGl.ts is uColor-only with no texture path by design (entry headroom about 9KB). The 4 sprite sheets exist on disk but are unreachable from WebGL2. Either add a minimal sampler (budget cost) or keep procedural quads and use sprites only on Canvas2D (StrategyMap) — decision needed (see Open Questions).
4. Fabrication UI is text-only. FabricationWindow.ts:40 pack strip renders itemId x N text, recipe list is text buttons, detail is dossier-kv. No thumbnails, no tool-slot props, no empty-state art. This is the easier-to-work-on gap.
5. Path drift + untracked output. public/workbench/ (legacy) vs public/assets/workbench/ (current) both exist; git status shows ?? public/assets/workbench/ untracked, and tests/glTF.test.ts:15 expects public/assets/ subdirs + under 500 KiB per GLB — fine today (14-30KB) but the test suite does not cover workbench GLBs.
6. three is dead weight. three@0.160.0 [Tier 1: OSV API — 0 vulns at pinned version] is in package.json:28 as ^0.160.0 (floating, violates AGENTS pinned wording) with zero imports. Either keep it lazy-only or remove it from the workbench path entirely — do not pull it into the bench.

### Constraints that force tradeoffs

- Bundle budget vs textures. Entries hit hints error at 200KB. A 1024x1024 flame sheet would be about 568KB (2.8x budget) — hence 128px cells (512x512). Any texture path must be lazy, quantized, and excluded from entrypoint. This is why GLB never enters entrypoint is a rule, not a preference.
- Zero-dep vs GLTFLoader/Draco. Three GLTFLoader + Draco decoder would add about 200KB+ decode CPU, exceeding benefit for under 2k-tri heroes. Blender template policy: Draco OFF for small assets, ON only for terrain. Bake to Float32Array instead.
- Sprite-free vs sprite-rich. miniGl has no sampler for the about 9KB headroom reason. Adding one helps boil bubbles / hearth flame / crystal shimmer fidelity but costs shader + upload + atlas code in the lazy chunk. Canvas2D (StrategyMap) already pools sprites capped at 200 draws — sprites belong there first.
- Appeal vs a11y. WCAG 2.2 SC 2.5.8 target size (24x24, windows.css:203 uses 34px), 2.4.11 focus visibility, reduced-motion freeze — Blender art must never sit on top of interactive controls or replace text labels.
- Frame budget. Up to 150-300k tris / up to 200 draw calls, render under 6.67ms at 60Hz. Workbench heroes are 1,500-4,000 tris each; scene target must hold after adding props.

## Phased plan

### Phase 0 — Budget and path gate (0.5 day)

**Goal:** Prove we stay under budget before modeling anything, and fix path drift.

**Files to touch:**
- blender/scripts/build_workbench.py (add --dry-run plan log + tri-count report)
- blender/templates/README.md (confirm tri/Draco table)
- tests/glTF.test.ts (extend to cover workbench/*.glb magic + under 500KB)
- public/workbench/ (delete legacy dir or symlink)

**Acceptance criteria:**
- Tri counts reported per GLB; all heroes under 4000 tris, colonist under 3000.
- All workbench GLBs under 500KB, magic glTF.
- One canonical GLB dir: public/assets/workbench/.

**Verification:**
- python3 -m py_compile blender/scripts/*.py
- blender --background --python blender/scripts/build_workbench.py -- --dry-run
- npx vitest run tests/glTF.test.ts
- npm run build (entrypoint under 200KB)

### Phase 1 — Blender hero mesh completion (2-3 days)

**Goal:** Create the missing workbench heroes in Blender (headless + manual viewport pass).

**Create in Blender (new or extend build_workbench.py):**
1. kettle_cauldron (brazier + lid + legs, 2500t) — Soap Kettle hero, currently a CSS gauge.
2. wood_trough, wood_bucket_detail (staves + hoops, 1200t) — dehair/tanning.
3. electrolysis_cell, voltaic_pile (cells + wires, 2000t) — Reactions window voltaic control.
4. bench_table (benchtop + shelf + hanging hooks, 800t) — shared stage for LabBench.
5. paddock_set (split-rail fence, trough, feeder, 1500t) — Paddocks tab.
6. tool_props (adze/awl/knife/tongs/fork as 150-400t props, vertex-color) — Fabrication detail thumbnails, NOT icon replacements.
7. fermentation_pot, mortar_pestle, charcoal_clamp (800-1200t) — filler for Reaction quick reagents.

**Blender settings (Tier 1):** +Y Up, Apply Modifiers ON, UVs/Normals ON, SRGB, AgX (per blender/templates/README.md), Decimate collapse where over budget [Tier 1: Blender Manual — Decimate](https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/decimate.html), Draco OFF (under 2k tris) [Tier 1: Khronos glTF 2.0 spec](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) — keep in-memory only; output is Float32Array bake, never shipped GLB.

**Files to touch:**
- blender/scripts/build_workbench.py (new builders)
- blender/templates/workbench_actions.json (regenerated)
- src/ui/gl/lowPolyMeshes.ts (bake outputs — Phase 2)

**Acceptance criteria:**
- Each new hero under 4k tris, under 12kB Float32Array (positions+normals+indices, 3-decimal quantized).
- Vertex colors or baked AO only where it replaces uColor — no textures in this phase.
- All 8 existing Actions still export; new meshes have neutral pose (scale 1, no channels) until Phase 2 animates them.

**Verification:**
- python3 -m py_compile blender/scripts/build_workbench.py
- blender --background --python blender/scripts/build_workbench.py -- --dry-run
- python3 -c json load check on workbench_actions.json
- npx vitest run tests/webglAndMeshes.test.ts

### Phase 2 — Animation + sprite bake toolchain (2 days)

**Goal:** Turn Blender Actions into runtime clips/sheets without ever loading GLBs in the entry.

**Create / edit:**
1. scripts/bake-workbench.mjs (new, Node — reads GLBs + manifest, writes src/ui/gl/bakedClips.ts): combines exported_channels + blender_only_channels (pour UV flow, crystal emission) into AnimationClip fps/loop/frames matching lowPolyMeshes.ts:15.
2. src/ui/gl/bakedClips.ts (new) + src/ui/gl/lowPolyMeshes.ts (extend with new heroes).
3. blender/scripts/bake_sprites.py (extend Eevee sheets): flame 4x4 at 128px, ember/fume/bubbles 4x1 at 256px to src/assets/sprites/*.png + atlas.json (already specced in template README).
4. Extend miniGl.ts with optional uEmission + uUvFlow uniforms (default 0 = bit-identical to today, like uPoseWeight precedent).

**Files to touch:**
- scripts/bake-workbench.mjs
- src/ui/gl/bakedClips.ts, src/ui/gl/miniGl.ts, src/ui/gl/lowPolyMeshes.ts
- blender/scripts/bake_sprites.py, src/assets/sprites/atlas.json

**Acceptance criteria:**
- Bake is deterministic: same GLB+manifest to same bakedClips.ts bytes (content-hash check in test).
- Pour stream and crystal shimmer both carry their Blender-only channels (test asserts non-zero flow/emission frames).
- Sprite PNGs each under 200KB (webpack maxAssetSize); flame 512x512 confirmed.
- npx tsc clean; miniGl unchanged when new uniforms unused.

**Verification:**
- python3 -m py_compile blender/scripts/bake_sprites.py
- blender --background --python blender/scripts/bake_sprites.py -- --dry-run
- node scripts/bake-workbench.mjs --check
- npx vitest run tests/kinetic.test.ts tests/webglAndMeshes.test.ts

### Phase 3 — Runtime wiring: LabBench + kettle + reactions (2-3 days)

**Goal:** Drive the new clips from game state (the M1 Task 9 precedent, now with real baked clips).

**Files to touch:**
- src/ui/gl/LabBench3DCanvas.ts (bind liquid_fill morph to liquidVolumeL/capacityL, hearth_flame squash to heater, bellows_pump to bellows pump, boil_shake to over 105C spring, stir_vortex to tracePct, pour_stream + UV flow to POURING, crystal_shimmer + emission to crystal) — all via kinetic.expDecay/stepSpringSubstepped, dt seconds, freeze at FROZEN_TIME under reduced-motion.
- src/ui/windows/ReactionsWindow.ts (bigger bench-3d-host, bench-quick stays DOM buttons; readout tabular-nums; contents table untouched).
- src/ui/SoapKettleModal.ts + SoapKettleMiniGame.ts (visual hook only — phase thresholds 45-55 percent / 80-95C unchanged).
- src/ui/StrategyMapCanvas.ts + mapMath.ts (sprite-sheet path only for map feedback — smoke/fog/rings; no miniGl change).

**Acceptance criteria:**
- Each state change visibly moves its clip within 1 frame (manual QA checklist + data-testid hooks preserved).
- Reduced-motion freezes at midpoint; no CLS (180px reserved, minHeight preserved).
- No change to VesselState / KettleDriveState contracts.
- Entry under 200KB, lazy chunk only.

**Verification:**
- npx tsc --noEmit
- npx vitest run tests/soapKettleMiniGame.test.ts tests/kinetic.test.ts
- npm run build

### Phase 4 — Fabrication and paddock usability (2 days)

**Goal:** Make the two text-heavy benches easier to scan — without replacing a11y text.

**Files to touch:**
- src/ui/windows/FabricationWindow.ts (pack strip: render Blender-prop thumbnails as 24x24 inline canvas snapshots or 64px lazy baked sprites — NOT PNG icons; keep itemId x N text for SR; recipe list adds tool-slot glyph from tool_props; detail adds vessel-prop preview using bench_table + liquid_fill state).
- src/ui/WorkbenchCanvas.ts (tabs keep text labels; add 20px Blender prop thumbs next to emoji — emoji stays for familiarity, thumbs carry hero identity).
- src/ui/windows/windows.css (thumb slot, focus ring, prefers-reduced-motion/forced-colors blocks — render thumbs as solid silhouettes in forced-colors).
- src/ui/fabricationModel.ts (no change — worker authority).

**Acceptance criteria:**
- Thumb render under 8KB (lazy) and degrades to text when WebGL unavailable.
- All buttons 24x24 minimum, focus-visible dual-ring #5aa5ff preserved (SC 2.5.8/2.4.13).
- Empty/loading states text-first; Blender art is progressive enhancement only.

**Verification:**
- npx tsc --noEmit
- npx vitest run tests/fabricationModel.test.ts tests/icons.test.ts tests/audioAndAccessibility.test.ts
- npm run build

### Phase 5 — Hardening and release gate (1 day)

**Goal:** Prove perf, a11y, and budget before shipping.

**Files to touch:**
- tests/glTF.test.ts (add workbench bake determinism + emission/flow channel assertions)
- docs/plans/ (this plan + ADR stub for bake-over-GLBLoader decision)
- blender/templates/README.md (final tri/bake table)

**Acceptance criteria:**
- npx vitest run green (88 suites + new), npx tsc --noEmit 0 errors, npm run build entry under 200KB.
- Manual 60Hz check (frame timing), Lighthouse a11y spot-check (targets/focus/contrast), reduced-motion + forced-colors pass.
- three still lazy-only (no new import three in workbench chunks).

**Verification:**
- npx vitest run
- npx tsc --noEmit
- npm run build

## Risks and alternatives

| Risk | Impact | Mitigation |
|---|---|---|
| Bake loses Blender-only channels (pour flow / crystal emission) | Silent missing motion | Manifest contract test; bake must fail if channels empty |
| Texture sampler bloat in miniGl | +200KB, budget breach | Keep procedural quads; sampler only in lazy chunk; measure first |
| Draco/GLTFLoader temptation | Decode CPU over benefit on under 2k tris | Policy: Draco OFF small assets; bake to Float32Array |
| Thumbs break a11y in forced-colors | Icons invisible | Text-first, thumbs aria-hidden, solid fallbacks |
| Untracked GLB drift (public/workbench vs public/assets) | Tests pass locally, fail CI | Phase 0 canonical dir; CI checks git-clean |
| Dual-agent branch drift (2x opencode, feat/civ7-* x10) | Overwritten Blender outputs | Work in blender-workbench branch; commit bake + manifest together |

**Alternative A — Load GLBs directly with three GLTFLoader (rejected).** It would import three into Reactions/Fabrication chunks, break the three lazy-only for 3D strategy view invariant, add Draco decoder (about 200KB), and decode CPU outweighs fidelity gain on heroes this small. The M1 decision (bake to Float32Array, GLB never in entry) is correct — this plan keeps it.

**Alternative B — Replace SVG icons with Blender-rendered PNG icons (rejected).** src/ui/icons.ts is zero-byte, tree-shakeable, currentColor, forced-colors and high-contrast safe. PNGs would bloat bundle, break currentColor theming, and fail WCAG contrast on composited backgrounds. Blender thumbnails are for props/heroes only; icons stay vector.

**Alternative C — Full Cycles hero renders for tutorial PNGs (rejected).** The 4 tutorial Blender PNGs are already 124-167KB. Cycles output at hero resolution would exceed asset budget and add nothing to workbench usability. Eevee 128px sprite cells are the right fidelity/cost point.

## Open questions

1. Which bench first — Reaction Workbench (3D diorama) or Fabrication Bench (usability)? Plan assumes Reaction first (clips exist), Fabrication second.
2. Sprite sampler in miniGl: add it (fidelity) or keep sprite-free (budget)? Needs a measured spike — do not decide by opinion.
3. three at ^0.160.0 vs pinned 0.160.0: pin it (per AGENTS) or remove it from the workbench path? OSV shows 0 vulns either way.
4. Color management: AgX (template default) vs Filmic — AgX changes all hero reads; confirm before Phase 1 modeling.
5. Tool-prop thumbnails: canvas snapshots vs baked sprites vs img from Eevee thumbs? Affects Phase 4 footprint.

## Evidence trail (for reviewer)

- Codebase-first: AGENTS.md invariants; src/engine/memoryLayout.ts SAB 67648; src/ui/gl/LabBench3DCanvas.ts sprite-free drive; src/ui/gl/lowPolyMeshes.ts Blender 5.2.2 gen; src/ui/gl/miniGl.ts uColor-only; src/ui/windows/FabricationWindow.ts text chips; src/ui/windows/ReactionsWindow.ts bench host; src/ui/WorkbenchCanvas.ts emoji tabs; src/data/items.ts icon keys; webpack.config.js budget; public/assets/workbench/ 8 GLBs (14-30KB); blender/scripts/build_workbench.py + workbench_actions.json bake contract; tests/glTF.test.ts + tests/webglAndMeshes.test.ts; dist entry about 42-48KB; 88 test files; 25,100 TS LOC; git status untracked GLBs; dual-agent ps aux (2x opencode).
- Targeted-docs + pattern-driven: [Tier 1: Blender Manual — Decimate](https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/decimate.html); [Tier 1: Khronos glTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html); [Tier 1: OSV API — three 0.160.0](https://api.osv.dev) 0 vulns (queried 2026-11-09); [Tier 1: blender/templates/README.md] Draco/sprite/budget tables.

---

**Status:** Draft for approval — no code changed. Reply go to start Phase 0.
