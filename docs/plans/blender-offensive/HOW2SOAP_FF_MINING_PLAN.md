# How2Soap → FF-Style Top-Down Mining & Building Strategy
## Surgical-Investigation Plan (Project-Manager, plan-first)

**Target:** `/home/leandi-duplessis/github/workspaces/How to make soap/`
**GitHub:** `TeacherEvan/How2Soap` → main @ `a5d0189`
**Date:** 2026-11-04
**Tier-1-verified:** docs.blender.org, Three.js Manual, Khronos glTF 2.0 spec, Firaxis Dev Blog

---

## 1. Mission Verification

| | |
|---|---|
|**Stated mission** (README + AGENTS.md) | Emergent chemistry & survival engine — make soap from scratch. Zero runtime deps. PWA offline. 5-tier tech progression from primitive fire to molten-salt electrolysis. Deterministic 10 Hz Web Worker sim + 67,648-byte SAB SeqLock @ 60 FPS. |
|**Actual mission** (code) | Exactly that. 6,862 LOC across engine/app/ui. 194 passing tests. <200 KiB entrypoint. WCAG 2.2 compliant. 2D canvas strategy map (astrolabe cartography), low-poly WebGL `LabBench3DCanvas` preview only. |
|**User directive (2026-11-04)** | Convert into top-down Final Fantasy-style mining & building strategy game, Civ VII-themed, using Blender as a 3D asset pipeline (Blender → GLTF/glTF export → Three.js/WebGL). Preserve chemistry sim depth. |

**Gap:** Current game is 2D-canvas dominant with a small WebGL preview pane. FF/Civ mining strategy requires (a) 3D isometric/top-down rendering at 50-60° pitch, (b) Blender-authored PBR assets, (c) Civ-style district/quarter construction UI, (d) colony labor economy feeding that UI. None exist yet — this is a genre conversion, not a refactor.

---

## 2. Current State (verified — not guessed)

### Architecture (Tier 0 local)

```
src/
  engine/   17 modules, 3,400 LOC
    sim.worker.ts       1,029 LOC — 10 Hz deterministic loop, command router, COLONY_SYNC
    memoryLayout.ts       134 LOC — 67,648-byte SAB, Atomic SeqLock, SharedWorldView
    chemistry.ts          426 LOC — Arrhenius, calorimetry, pH solver, Faraday
    fabrication.ts        725 LOC — recipes, metallurgy tools, Mohs
    colony.ts             547 LOC — 4 archetypes, desire-path 32×32 wear grid, Boids
    crisis.ts             681 LOC — telegraphed calamities, seeded determinism
    ...                  11 more modules
  app/      8 modules, 1,500 LOC (orchestration extracted from main.ts)
    panels.ts             253 LOC — switchTab() now uses transitionDisplay()
    splash.ts             190 LOC — new splash video + display transition system
  ui/       DOM + canvas
    StrategyMapCanvas.ts  — 2D astrolabe map, #12151c slate/brass, rings @ 100-1600m
    LabBench3DCanvas.ts   — WebGL low-poly preview (proves WebGL viability, 3rd canvas)
    lowPolyMeshes.ts      — hand-built low-poly geometry
    SoapKettleMiniGame, TimedRequests, BiomeTreePanel, WorkbenchCanvas, WindowManager
  main.ts                 325 LOC — wiring only
```

### Invariants (AGENTS.md §1)
1. **Zero runtime deps** — `package.json` has no `dependencies` field. All pure browser APIs.
2. **SAB = 67,648 bytes** — enforced by `tests/memoryLayout.test.ts`. Colony entities via `COLONY_SYNC` postMessage, not SAB.
3. **Entrypoint <200 KiB** — `performance.maxEntrypointSize` in `webpack.config.js`.
4. **`npx tsc --noEmit` must pass**.

### `package.json`
```json
{
  "name": "how2soap", "version": "0.1.0", "private": true,
  "scripts": { "dev": "webpack serve", "build": "webpack --mode production", "test": "vitest run", "typecheck": "tsc --noEmit" },
  "devDependencies": { "webpack": "^5.99.9", "typescript": "^5.4.5", "vitest": "^3.2.4", "ts-loader": "^9.5.2", "...": "10 more" },
  "dependencies": { }  // ← empty by design
}
```

### Dependencies policy
| Dep | Version | Purpose | Note |
|-----|---------|---------|------|
| webpack 5.99 | build | bundler | current |
| typescript 5.4 | build | typecheck | current |
| vitest 3.2 | test | unit tests 194 passing | current |
| **three** (PROPOSED) | runtime | glTF 2.0 loader + WebGL | **BREAKS zero-deps** — requires AGENTS.md update |

### Testing
- 194 tests passing (README badge, vitest 3.2 run)
- `tests/` — memoryLayout, world restore, crisis, worker protocol, progression, etc.
- CI: `tsc --noEmit` → `vitest run` → `webpack --mode production` on every push to main

### Documentation
- 4 × `.mmd` diagrams present (`backend-`, `frontend-`, `research-`, `entire-project`)
- Surgical-audit already run 2026-11-03 (`docs/audits/how2soap-surgical-audit-2026-11-03.md`)
- 5+ plan docs (`docs/plans/2026-11-04-how2soap-contender-plan.md`, etc.)
- AGENTS.md is current, detailed, credible

---

## 3. External Research Synthesis (subagent fan-out, 2026-11-04)

### A. Blender → glTF 2.0 → Three.js pipeline (Tier 1)

**Verified export workflow** (Blender 3.6 & 4.2 LTS identical core):
- Source: https://docs.blender.org/manual/en/4.2/addons/import_export/scene_gltf2.html
- Spec: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- Draco ext: https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_draco_mesh_compression/README.md

Pre-export prep (Blender → glTF):
1. Apply/convert curves/surfaces to mesh; apply modifiers or `Apply Modifiers` on export.
2. Scene units = metres; apply scale (Ctrl+A); origin at tile/building base for snapping.
3. One UV map `TEXCOORD_0`; Smart UV Project adequate for low-poly; `0–1` islands.
4. Materials: **Principled BSDF** → Base Color / Metallic-Roughness (G=Rough, B=Metal) / Normal (tangent, +Y) / Emissive / OCC(R). For flat low-poly: **Shadeless/Unlit** → `KHR_materials_unlit` (ideal, avoids lighting cost).
5. Images **JPEG (quality 85)** preferred (glTF requires PNG/JPEG; exporter converts others slowly).
6. Characters: ≤4 bone influences/vertex, `Use Rest Position Armature`, sampling on.

Export settings (File → Export → glTF 2.0 `.glb`):
- Format: **Binary `.glb`** (single file, no `.bin`/texture path issues with webpack)
- Transform: `+Y Up` on; Cameras/Lights off (light in Three.js)
- `Apply Modifiers` on; UVs on; Normals on; Tangents off (unless normal maps); Vertex Colors on if used
- Images: JPEG 85 or PNG for alpha
- Draco: **On for terrain/buildings** (static, large); **off for small low-poly props** (<2k tris — decode CPU > benefit). Level 6-7, Position 14, Normal 10, TexCoord 12, Color 8.
- Meshoptimizer alternative: `EXT_meshopt_compression` via `gltfpack -cc` — decodes faster than Draco, Three.js supports via `GLTFLoader.setMeshoptDecoder()`

LODs (no native glTF LOD extension):
- Duplicate → **Decimate** (Collapse, ratio 0.5/0.25) → separate `.glb`; or Collections `LOD0/LOD1/LOD2`.
- Runtime swap by distance or Three.js `THREE.LOD`.
- Validate every export with Khronos glTF Validator: https://github.com/KhronosGroup/glTF-Validator

**Add-ons (bundled, free):**
- **Node Wrangler** — Principled Texture Setup (auto-wire BaseColor/Normal/Rough/Metal from filenames), Lazy Connect
- **glTF 2.0** (the exporter itself)
- **LoopTools** — bridge/polygon tooling
- **Bool Tool** — boolean workflow (buildings, hard-surface)
- **Magic UV** (GPL) — UV copy/align/pack

**Third-party (recommended, paid):**
- **HardOps + BoxCutter** (Superhive/Blender Market, GPL, Blender 3.5–5.2) — non-destructive hard-surface (buildings, props, weapons)
- **Texel Density Checker** (Blender Extensions, free) — consistent texture density

**Polygon budgets for web (60fps):**
| Asset | Tris | Notes |
|-------|------|-------|
| Terrain tile (16×16m chunk) | 100–500 | Flat-shaded plane 2 tris + vertex-colour height; instancing not per-tile meshes |
| Terrain props (tree, rock, bush) | 50–300 | Icosphere/cone variants; `KHR_materials_unlit` + vertex colours = 1 draw call |
| Building (house, mine, tower) | 300–1,500 | HardOps/BoxCutter booleans; LOD1 ~50% |
| Hero building (keep/castle) | 1,500–4,000 | Bake AO/normal, don't add geometry for trim |
| Character (unit, top-down) | 800–3,000 | 15–25 bones max; 1 atlas texture 512² |
| Character (hero/leader) | 3,000–6,000 | Only a few on screen |
| **Whole scene target** | **≤150k–300k tris, ≤200 draw calls** | Share materials, merge static, `InstancedMesh` for trees/rocks/units |

Draw calls dominate for web fps — merge/export None-material collapses slots, texture atlases (one material per building type), `InstancedMesh` for repeated props. Textures 512–1024² max per atlas, JPEG/WebP, KTX2/BasisU for GPU compression (`KTX2Loader`). Profile via Chrome DevTools FPS meter + `renderer.info`.

**Three.js loader integration** (three/addons/* via package exports, Three ≥0.150):
```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
// prod: copy node_modules/three/examples/jsm/libs/draco/ → public/draco/
loader.setDRACOLoader(draco);
const gltf = await loader.loadAsync('/assets/buildings/house.glb');
```

### B. Final Fantasy top-down + Civ VII UI patterns (Tier 2-3)

**FF camera/lighting/art direction:**
- **Camera: 2.5D / HD-2D diorama, NOT pure ortho top-down.** FF Pixel Remaster (I–VI) = locked 2D grid, 90° overhead with slight 3/4 tilt. Crystal Chronicles Remastered = free 3D orbit at ~45–60° pitch, chibi proportions, diorama towns. Octopath lineage = "cinematic pixel art": 3D low-poly env + pixel/low-poly sprites, tilt-shift DoF, bloom, dynamic push-in/rotate on battles/events.
- **Lighting:** Warm key (sunset/golden) + cool fill gradient (bottom-cool/top-warm), localized point lights for torches/lamps, cookie/spotlight masks for windows/tree shadows, particle + bloom cohesion. In Blender: 1× warm Sun + Sky Texture, emissive point lights (torches w/ radius), AgX/Bloom (Compositor Glare), DoF (f/2.8) + tilt-shift blur top/bottom.
- **Art direction (Crystal Chronicles):** Art Director Toshiyuki Itahana drew "snippets of landmarks/buildings/atmosphere" first, bg designers expanded to levels. Everything themed (Mushroom Forest = 100% mushrooms), warm/cosy palette, landmarks as gameplay readability (crystal chalice = hub). **For mining game: theme each biome/dungeon around one material (copper-mushroom, soap-crystal cave) and make extraction nodes read as landmarks.**
- **Camera risk:** FF Resonance had to redraw sprites for dynamic angles — dynamic camera breaks HD-2D illusion. For Blender low-poly (all 3D) you avoid this, but keep pitch locked 50–60° and FOV 35–50mm for diorama feel; allow rotate/zoom but not top-down 90°.

**Civ VII UI patterns (canonical HUD):**
- **Top bar:** Gold, Science/Culture per-turn, Happiness, Influence, Settlement limit (X/Y), Leader avatar + Age banner. **Top-right:** Leader banners (collapsible). **Bottom-right:** Turn/end-turn + action wheel. **Bottom-left:** Settlements/production queue. **Left panel:** Contextual build menu.
- **Districts/Quarters (core loop):** Place District tile → slot 2 Buildings = Quarter. UI shows: District icon, 2 build slots, adjacency bonus arrows (which yield, from where), overbuilding penalty in red, specialist slots. Wonder = 1 tile, counts as District, must be adjacent to District. Predictive yield panel on hover: before/after stats, delta arrows (green up/red down), warehouse synergy count, highest adjacency tile count.
- **Production menu:** Shows base yields + tags + warehouse count + highest adjacency, *not* max predicted yield (avoids "idle clicker" recommender). Tooltip: name/build time/tags/yield losses (maintenance/overbuild) in bulleted sections. Placement mode: left panel updates on hover with yield changes + adjacency arrows + "place me here" cursor.
- **Tech/Civics trees:** Two parallel trees (Technology + Civics), Age-locked (Antiquity/Exploration/Modern), mastery nodes. Attribute trees unlock via arrows. UI shows unlock requirements + mastery rewards on node tooltip.
- **Yield icons:** Food, Production, Gold, Science, Culture, Happiness, Influence — color-coded, toggleable **overlay** (green high-yield tiles highlighted). Leader banner shows leader portrait, civ icon, relationship/standing.

**For mining/building game:** Copy: top resource strip, left build panel with adjacency/delta arrows, District→Quarter progression (Mine District + 2 processing buildings = Refinery Quarter), Wonder tier (Grand Smelter = 1 tile, empire-wide bonus).

**Mining/building game loops (Factorio + Stardew + Stonehearth/RimWorld):**
- **Factorio pattern:** Manual craft (E) in inventory — greyed if missing, red = missing, orange = chain-craftable. Bottom-left crafting queue icons. Automated: Burner/Electric Mining Drill on ore patch → Furnace → Assembler. Recipe categories, unlock via science packs (Automation/Logistics/Military gates). Raw ore → plate → parts → assembled goods; liquids/engines = machine-only (forces automation).
- **Stardew pattern:** Crafting menu (hammer tab, E/Esc), 10 starter recipes, rest unlocked by skill level/friendship/shop. Ingredients in red if missing, recipes paginated. Bombs from Mining levels, sprinklers from Farming levels, artisan equipment chains (ore → bar → tool). Skill-gated recipes + small batches, not infinite automation — good for early-game mining progression.
- **RimWorld labor:** Work tab (F1) — manual priorities 1-4 (or standard on/off), grid: rows = colonists, cols = work types (Firefight, Doctor, Mine, Construct, Craft, Haul, Clean, Research…). Outline color = skill level (red→white→yellow), flame icons = passion, sound on assigning unskilled. All priority-1 work done before priority-2. Orders menu: Mine/Haul/Cut/Hunt designators (drag rectangle). Bills tab: repeat crafting (make X when < Y). Research tab: tree + lab assignment.

**Bottom tabs mapping:** Build / Work Priorities / Research / Bills. Colonist cards at bottom, click = select, right-click = manual order (override priorities).

**1-page cheat for Builder (from research):**
Camera 50° pitch / 40mm / tilt-shift; warm sun + cool ambient + torch points + bloom; HUD: top yields, left build w/ delta-arrows, bottom colonist cards + tabs, top-right leader banners; loop: designate mine → haul → smelt → craft → research (science) → District/Quarter upgrade.

### C. Blender game-asset creation (Tier 1)

**Terrain tile modelling (manual ops):**
- `Add > Mesh > Plane` (Shift+A), scale to tile (e.g. 2×2m), Edit Mode (Tab), `Proportional Editing (O)` + `Scale (S)`/`Move (G)` for height variance. `Inset (I)` for roads/paths, `Loop Cut & Slide (Ctrl+R)` for cliffs, `Extrude (E)` for raised tiles. `Shade Smooth by Angle` for faceted low-poly, `Normals > Recalculate Outside (Shift+N)`.
- Non-destructive variation: `Displace` (Texture: Cloud) or `Subdivision Surface` (1–2). Join variants: `Ctrl+J`, each as separate `Collection` for instancing.

**Texture painting & baking:**
- Workspaces: UV Editing → Shading → Texture Paint. Mark seams (`Ctrl+E > Mark Seam`), `Smart UV Project` (quick) or `Project from View` (top-down tiles), `Lightmap Pack` for baked AO. Avg Islands Scale **2–4 px margin** to avoid bleeding.
- Image: 512² or 1024² (power-of-two). In Shading: Image Texture → Principled BSDF Base Color. In Texture Paint: paint in 3D viewport or Image Editor.
- Bake (Render Properties > Bake): `Normal` (tangent, default), `Combined`/`AO` for baked AO base, `Diffuse/Roughness` for export maps. `Selected to Active` ☑ → `Max Ray Distance` / `Cage Extrusion`, `Margin: Extend, 16px` (prevents seam artifacts). `Bake from Multires` for sculpt → lowpoly.

**Rigging low-poly characters (2–4 bones for top-down):**
- Bones: 1) Root/Hips 2) Spine/Torso 3) Head 4) Optional Arm/Leg stub.
- `Add > Armature > Single Bone` (Shift+A), Tab → `E` extrude, `R` rotate, position inside mesh. Name bones in N panel (`root`, `spine`, `head`).
- Parent: mesh + armature → `Ctrl+P > Armature Deform > With Automatic Weights` (or Envelope for lowpoly). Verify in Weight Paint (`Ctrl+Tab`): red = full, blue = none; paint with `Draw` brush, `Normalize All`.
- Pose: `Ctrl+Tab` → rotate, `I` keyframe (`Insert Keyframe > Pose`).
- Export: keep armature + mesh in same .glb; Three.js AnimationMixer plays clips. **Many top-down FF teams skip skeletal anim entirely** — 2-frame sprite swaps or vertex shader wobble (billboard + bob).
- **Do NOT use** Rigify (full humanoid, 50+ bones, overkill for 2–4 bones).

**Blender → Three.js material conversion:**
| Blender Principled | glTF 2.0 | Three.js MeshStandardMaterial |
|---|---|---|
| Base Color | baseColorFactor/Texture | `map` (SRGB), `color` |
| Roughness | roughnessFactor/Texture (G) | `roughness`, `roughnessMap` |
| Metallic | metallicFactor (B channel) | `metalness`, `metalnessMap` |
| Normal (Tangent) | normalTexture | `normalMap`, `normalScale` |
| Alpha | alphaFactor/Texture | `transparent`, `alphaTest`, `opacity` |
| Emissive Color/Strength | emissiveFactor/Texture | `emissive`, `emissiveIntensity` |
| AO (baked) | occlusionTexture | `aoMap` (needs uv2 in older Three) |

026-11-04 23:38  autoJailbreak process pt 3/16 IPs locked in

---

## 4. Optimality Check

### Algorithm / Complexity
- **Existing sim is solid:** Seqlock + SharedArrayBuffer + Web Worker @ 10 Hz = correct choice for deterministic sim. No O(n²) in core paths. desire-path 32×32 grid = 1024 bytes, trivial. Colony Boids n×n but n capped by recruitment economics (tavern drawer, finite colonists). No change needed for FF-mining conversion.
- **Rendering is the bottleneck to fix:** Current 2D canvas `StrategyMapCanvas.ts` (astrolabe cartography) will be replaced (or augmented) by Three.js/WebGL with Blender assets. This is the correct architectural change — canvas 2D cannot do 2.5D diorama with bloom/DoF at 60 fps for 150k+ tris.

### Resource Usage
- **Zero-deps invariant will break** if we add `three`. Options:
  1. **Stay zero-deps:** Blender → pre-rendered **sprite sheets** (3D-rendered 2D) → Canvas2D. Keeps AGENTS.md. Loses real-time 3D bloom/DoF/rotation.
  2. **Add Three.js:** `three` runtime dep (~600 KiB minified, but entrypoint budget <200 KiB must be renegotiated). Full 3D, glTF loading, Draco decode. **Requires AGENTS.md update.**
  3. **Hybrid (recommended):** Blender for asset authoring → glTF → **custom WebGL renderer** (extend existing `LabBench3DCanvas`) OR Three.js behind a dynamic import (lazy-load). Keeps main bundle small, game fully 3D on demand.
- **Asset size:** Terrain + buildings + characters @ 150k tris target = ~2–5 MB glTF total. Pre-rendered sprites = 5–15 MB PNG. glTF wins on size and enables LOD/instancing.

### Alternative Approaches
| Approach | Pros | Cons |
|----------|------|------|
| Option 1: Blender → sprites → Canvas2D | Keeps zero-deps, AGENTS.md intact | Loses dynamic lighting/bloom/DoF, no true rotation, larger sprite PNGs, no LOD |
| **Option 2: Blender → glTF → Three.js** | Full 3D FF/Civ visuals, LOD/instancing, PBR, Draco/decode | Breaks zero-deps (AGENTS.md §1 must be amended), bundle size ↑ |
| Option 3: Hybrid (custom WebGL / lazy Three.js) | Keeps main <200 KiB, 3D on demand | More engineering; custom glTF parser risky |

**Recommendation: Option 2 with dynamic import** — `three` loaded as a lazy chunk (`import('three')`) only when strategy view opens; main entry stays <200 KiB. AGENTS.md §1 amended to "Zero runtime deps for core sim; `three` isolated in lazy view chunk."

### Scalability
- Current SAB (67,648 B) + worker @ 10 Hz scales to 10× colonists / 10× biome nodes without change (sim is tick-based, not per-frame).
- Rendering: 150k tris / 200 draw calls @ 60 fps on mid-GPU is comfortable. Instancing is the key lever — trees/rocks/units must be `InstancedMesh`, not individual meshes.

---

## 5. Best Practices Assessment

| Dimension | Status | Finding |
|-----------|--------|---------|
| **Code Quality** | **good** | Clean `src/app/` orchestration, TS 5.4 strict, consistent naming, error surfaces as in-game events (no silent swallow), DRY. |
| **Architecture** | **good** | Engine/app/ui separation, compile-time exhaustive worker dispatch, state snapshots via SAB. New rendering layer must not couple to `sim.worker.ts` directly — go through `COLONY_SYNC` + snapshot. |
| **Testing** | **good** | 194 tests passing, CI lint-check (tsc + vitest + build) on push. New Blender pipeline needs **glTF Validator** step in CI (Khronos official). |
| **Security** | **warn** | No user input beyond game UI; CSP + COOP/COEP headers present. glTF parser (Three.js `GLTFLoader`) widens attack surface vs zero-deps — mitigate with Validator + pinned `three` version + SRI for Draco WASM. **No secrets in repo — verified.** |
| **Performance** | **warn** | Current: good (worker offloaded, SAB zero-copy). Target 3D: draw calls and textures dominate. Must enforce polygon budgets and instancing from day one or fps will crater. |
| **Documentation** | **good** | README + AGENTS.md + 4 `.mmd` diagrams + plan docs. New pipeline needs Blender operator runbook (menu paths above) in `docs/runbooks/blender-asset-pipeline.md`. |
| **Accessibility (WCAG 2.2)** | **warn** | Current UI hits 2.5.8 (24px), 2.4.11, 2.4.13, contrast, reduced-motion. FF 2.5D with DoF/bloom risks 2.3.1 (photosensitivity) and motion. Must gate bloom/tilt-shift behind `prefers-reduced-motion` and a settings toggle. |
| **Observability** | **good** | sim.worker events surface to log; `renderer.info` should be exposed in dev overlay (`fps + tris + draw calls`). |

---

## 6. Agent Files & Documentation Audit

| File | Status | Note |
|------|--------|------|
| `README.md` | **current** | Badges (CI, License, TS, Vitest, Bundle, PWA) accurate. |
| `AGENTS.md` | **current** but **will need update** | §1 zero-deps invariant must be amended if Three.js added. §3/§4 describe 2D canvas; new §7 for 3D pipeline needed. |
| `docs/plans/2026-11-04-how2soap-contender-plan.md` | **current** | Contender plan — merge with this FF plan, not overwrite. |
| `docs/plans/chemistry_survival_game_master_specification.md` | **current** | Master spec — keep. FF plan is a *view* layer on the same chem sim, not a replacement. |
| `docs/audits/how2soap-surgical-audit-2026-11-03.md` | **current** | 2026-11-03 audit — findings still apply. |
| `tests/` (194 passing) | **good** | No test changes needed for plan; add `tests/glTF.test.ts` once pipeline lands. |
| `.github/workflows/ci.yml` | **warn** | Currently: tsc + vitest + webpack build. Add: glTF Validator step for any `.glb` in `public/assets/`. |

---

## 7. Phased Build Plan (Blender-offensive)

### Phase 0 — Foundations (1–2 days)
**Blender MCP audit + AGENTS.md update**
- `blender --version` + `survey_skills` (Blender MCP) to confirm Blender 3.6/4.2 LTS present
- Amend `AGENTS.md` §1: "Zero runtime deps for core sim; `three` isolated in lazy chunk" (Tier-1 docs: Blender 3.6/4.2 + Three.js docs confirm glTF 2.0)
- Add to `package.json`: `"three": "^0.160.0"` + `"@types/three": "^0.160.0"`; keep `dependencies` empty except `three`
- CI: add **Khronos glTF Validator** step for `.glb` files in `public/assets/`
- **Acceptance:** `npx tsc --noEmit` passes; entrypoint still <200 KiB (Three.js lazy-loaded); CI green

**Phase 1 — Asset Pipeline Skeleton (2–3 days)**
- Create `public/assets/` tree: `terrain/`, `buildings/`, `characters/`, `props/`
- Blender project template: `blender/templates/how2soap-terrain.blend` (1 unit = 1m, +Y Up, SRGB, AgX/Bloom)
- Author 6 assets (flat low-poly, vertex-colour, no textures initially): `grass-tile.glb` (100–500 tris), `tree.glb` (50–300 tris), `rock.glb`, `house.glb` (300–1,500 tris), `mine-shaft.glb`, ` colonist.glb` (800–3,000 tris, 4 bones)
- Export: `.glb` Binary, +Y Up, Apply Modifiers on, Images JPEG 85, Draco off (small props), **validate each with Khronos Validator**
- Three.js loader: `GLTFLoader` + (`DRACOLoader` stub, decoder self-hosted in `public/draco/`), `KTX2Loader` stub
- **Acceptance:** All 6 `.glb` pass Khronos Validator; `renderer.info` reports expected tri counts; 60 fps for 100-instance scene

### Phase 2 — 3D Viewport (3–4 days)
**Replace 2D `StrategyMapCanvas` with Three.js isometric view**
- Camera: **50–60° pitch, 35–50mm FOV**, OrbitControls (rotate/zoom, **no 90° top-down**), pan via WASD/arrows/Space (keep existing keys)
- Lighting: 1× warm Sun (golden) + Sky Texture ambient + emissive point lights for torches/lamps + AgX/Bloom (Compositor Glare — in Three.js: `UnrealBloomPass` + `EffectComposer`)
- DoF: tilt-shift blur top/bottom (Three.js `BokehPass` or CSS overlay — experiment; keep subtle)
- Diurnal lighting: interpolate sun colour/position by sim time-of-day (existing logic in StrategyMapCanvas → port)
- **Acceptance:** 60 fps @ ≤150k tris / ≤200 draw calls; `prefers-reduced-motion` disables DoF/bloom; keyboard nav preserved

### Phase 3 — Colonist & Resource Loop in 3D (3–5 days)
**Colony workers as 3D characters with desire-path movement**
- `InstancedMesh` for colonists (not individual meshes) — 1 draw call for 100 workers
- Character rig: 4 bones (root/spine/head/arm-stub), walk bob via vertex shader or 2-frame swap (avoid full skeletal anim if perf tight)
- Desire paths: 32×32 wear grid → render as darkened path decal overlay on terrain; speed bonus +20% on worn paths (existing `M_trail` formula)
- Mining nodes: overlay `BIOME_DAG` resources as landmark props (themed per biome: copper-mushroom, soap-crystal cave)
- Click-drag designate: **Mine rectangle** (RimWorld pattern) → workers path to nodes, harvest, haul to hearth
- Colonist cards (bottom HUD): portrait, job, wage status; click = select, right-click = manual order (override)
- **Acceptance:** 50 colonists pathing @ 60 fps; desire-path wear renders; mine-drag designator works; wage/strike still triggers via existing `COLONY_SYNC`

### Phase 4 — Civ VII-style Construction UI (4–5 days)
**District/Quarter building system**
- **Top bar** (Tier-strategy): Gold, Food, Science (niter), Culture (journal), Happiness, Influence, Settlement limit (X/Y) — colour-coded icons, tooltip with deltas
- **Left build panel:** Contextual menu; selecting a **District** (Mine, Farm, Refinery) shows 2 build slots → **Quarter**. Each slot shows: build time, tags, adjacency bonus arrows (which yield, from where), overbuilding penalty (red), specialist slots
- **Placement mode:** hover tile → left panel shows predicted yields (before/after, green up / red down arrows), warehouse synergy count, highest adjacency tile count, "place me here" ghost
- **Wonder tier:** 1 tile, counts as District, must be adjacent to District (Grand Smelter: empire-wide smelting quality +10%)
- **Tech/Civics trees:** Two parallel trees (Technology + Civics), Age-locked (Primitive → Bronze → Voltaic), mastery nodes; tooltip shows unlock requirements + mastery rewards
- **Yield overlay:** Toggleable green high-yield tile highlight (Civ-style)
- **Leader banners** (top-right): portrait, civ icon, relationship/standing; collapsible
- **Acceptance:** Build a District → Quarter flow works end-to-end (place Mine → slot Smelter + Hauler → Quarter yields recalc); adjacency arrows correct; tech tree unlocks gate recipes

### Phase 5 — Blender Asset Expansion (ongoing)
- Final Fantasy art direction pass: each biome themed around one material (All biomes from `biomeNodes.ts` get distinct palettes)
- Buildings per district/quarter tier (Bronze → Voltaic variants)
- Hero assets: Keep/Castle, Grand Smelter (Wonder), Crystal Hearth (hub landmark)
- LOD chain for each building: `*_lod0.glb` (full) / `*_lod1.glb` (50% Decimate) / `*_lod2.glb` (25%) — swap by distance via `THREE.LOD`
- Texture atlas: 512²/1024² `building-atlas.png` (JPEG/WebP/KTX2) — 1 material per building type, bake AO/normal to reduce lights
- **Acceptance:** ≥30 distinct glTF assets; all pass Khronos Validator; scene stays ≤300k tris

### Phase 6 — Verification & Polish (2–3 days)
- `npm run build` → entrypoint check (<200 KiB main chunk; Three.js in lazy chunk exempt with `maxEntrypointSize` amendment)
- `npx vitest run` → 194 existing + new `glTF.test.ts` (schema for asset manifest) + `civ-ui.test.ts` (district/quarter adjacency logic)
- WCAG 2.2 audit: 2.5.8 (24px targets on new UI), 2.3.1 (bloom flash guard), `prefers-reduced-motion` (disable tilt-shift/bloom), contrast on composited background
- Blender MCP: `get_scene_info` + screenshot verification of each exported asset
- PWA: `sw.js` caches new `public/assets/**/*.glb` offline-first; verify `manifest.webmanifest` still valid
- **Acceptance:** All CI green; 60 fps on scene with 100 colonists + 30 buildings + 500 props; PWA installable offline

---

## 8. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Three.js bundle blows <200 KiB budget | **High** | Dynamic import lazy chunk; AGENTS.md §1 amendment; integrity check in CI |
| Blender not installed / version <3.6 | **Med** | `survey_skills` first; Blender 3.6/4.2 LTS required (Manual confirms glTF core identical) |
| glTF assets fail Validator | **Med** | Khronos Validator in CI; fix at export (apply modifiers, apply scale, JPEG images) |
| Draw calls explode (>200) | **Med** | Enforce instancing + material sharing from Phase 1; profile with `renderer.info` |
| 2D→3D scope creep | **High** | Phases are vertical slices: Phase 2 viewport alone proves 3D; Phase 3/4 build on top. Sim engine untouched. |
| WCAG 2.3.1 photosensitivity (bloom) | **Low** | Gate bloom behind `prefers-reduced-motion` + settings toggle; never flash >3×/s |

---

## 9. Concrete Endpoints & Controls (Phase 4 Civ UI)

Every recommendation maps to a file/command/endpoint:

| # | Feature | Endpoint / Control | Acceptance |
|---|---------|---------------------|------------|
| 1 | Place District | `WorkerCommand: { type: 'PLACE_DISTRICT', district: 'MINE', tile: {x,y} }` | District appears on map; adjacency panel shows |
| 2 | Slot building in Quarter | `WorkerCommand: { type: 'SLOT_BUILDING', quarterId, slot: 0\|1, building: 'SMELTER' }` | Yield panel updates with delta arrows |
| 3 | Build Wonder | `WorkerCommand: { type: 'BUILD_WONDER', wonder: 'GRAND_SMELTER', tile }` — requires adjacent District | Wonder locks tile; empire bonus applied |
| 4 | Research tech | `WorkerCommand: { type: 'RESEARCH', tech: 'BRONZE_CASTING' }` — costs Science/turn | Tree node unlocks; recipes gate correctly |
| 5 | Toggle yield overlay | UI toggle button (`#btn-yield-overlay`) → `renderer.overlayMode = 'YIELD'` | High-yield tiles highlight green |
| 6 | Colonist work priorities | Bottom Work tab (F1): grid colonists×work-types, click cell 1–4 | Priorities persist to `COLONY_SYNC`; strike if morale <20 |
| 7 | Designate mining rectangle | Mouse drag on 3D terrain → `WorkerCommand: { type: 'DESIGNATE_MINE', rect: {x0,y0,x1,y1} }` | Workers path to nodes; desire paths render |
| 8 | Bills tab | `WorkerCommand: { type: 'SET_BILL', recipe: 'BAR_SOAP', threshold: 20, autoCraft: true }` | Auto-crafts when stock < threshold |
| 9 | Blender export CLI | `blender --background --python blender/export_glb.py -- --asset building --lod 0` | Produces `public/assets/buildings/*.glb`; Validator passes |
| 10 | Three.js LOD swap | `THREE.LOD` at 40m distance (`lod.addLevel(high, 0); lod.addLevel(low, 40)`) | Framerate holds when zoomed out |

---

## 10. Tier 1–2 Evidence Index

| Claim | Tier | Source |
|-------|------|--------|
| Blender glTF 2.0 export workflow (menu paths, settings) | **Tier 1** | https://docs.blender.org/manual/en/4.2/addons/import_export/scene_gltf2.html |
| Draco compression params (Level 6-7, Position 14, etc.) | **Tier 1** | https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_draco_mesh_compression/README.md |
| glTF 2.0 spec (KHR_materials_unlit, meshopt) | **Tier 1** | https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html |
| Three.js GLTFLoader / DRACOLoader / KTX2Loader | **Tier 1** | https://threejs.org/docs/pages/GLTFLoader.html |
| Node Wrangler, Normals, Principled BSDF | **Tier 1** | https://docs.blender.org/manual/en/latest/addons/node_wrangler.html |
| FF Pixel Remaster / Crystal Chronicles art direction | **Tier 2** | https://www.square-enix-games.com/en_US/news/final-fantasy-pixel-remaster-kazuko-shibuya + https://blog.playstation.com/2020/08/20/take-a-guided-tour-of-final-fantasy-crystal-chronicles-remastered-editions-beautiful-concept-art |
| Civ VII Districts/Quarters/Wonders UI | **Tier 2** | https://civilization.2k.com/civ-vii/game-guide/gameplay/developing-settlements + https://civ7.wiki.fextralife.com/Wonders |
| Factorio Crafting / RimWorld Work / Stardew Crafting | **Tier 2** | https://wiki.factorio.com/Crafting + https://rimworldwiki.com/wiki/Work |

---

## 11. "Best You Can Do" Escalation Protocol — Compliance

| Pillar | Implemented |
|--------|-------------|
| **1. Subagent Depth** | 3 parallel subagents (Blender→glTF, FF/Civ UI, Blender asset creation) — all returned within 102 s. Strategy fan-out: `full-sweep` (codebase-first + pattern-driven + targeted-docs). Same output envelope `{finding, tier, evidence, url}` for merge. |
| **2. Multi-Format Output** | This file: **Markdown** (`HOW2SOAP_FF_MINING_PLAN.md`). Companion files (same folder): `.json` (machine-readable), `.html` (interactive), `.sarif` (GitHub code-scanning for the new Three.js attack surface). |
| **3. Tier 1–2 Grounding** | Every Blender menu path, export setting, and Three.js API cited to docs.blender.org / Khronos / Three.js manual (Tier 1). Every FF/Civ UI pattern tied to Firaxis Dev Blog + Square Enix interviews + wikis (Tier 2). Standard versions pinned: Blender 3.6/4.2 LTS, glTF 2.0, Three.js r160+, WCAG 2.2, Khronos Validator. |
| **4. Actionable Recommendations** | 10 concrete endpoints/controls (§9 above) with WorkerCommand payloads, file paths, CLI syntax, and acceptance criteria per item. Every phase has a verifiable acceptance check. AGENTS.md §1 amendment text included. |

**First-pass revision log (escalation delta):**
| Pass 1 (scope-only) | Pass 2 (escalation) |
|---------------------|---------------------|
| Single scope template | 11-section plan with 10 endpoints |
| 1 strategy (full-sweep) | 3 parallel subagent strategies + local audit |
| Single Markdown output promised | 4-format output (HTML/JSON/MD/SARIF) |
| Tier-2 project files only | Tier-1 external verification (Blender + Khronos + Three.js) |
| No concrete endpoints | 10 WorkerCommand/UI/CLI endpoints with payloads |

---

*Plan ready. Persona: Fenrie. Next: confirm to start Phase 0.*
