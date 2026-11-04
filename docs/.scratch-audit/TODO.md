# TODO — How2Soap → FF-Style Top-Down Mining Strategy

## Objectives (≥10 tickable)

- [ ] **OBJ-001** — Blender MCP audit + AGENTS.md §1 amendment
  - **Requirement:** FR-002, NFR-003
  - **Areas:** Blender MCP (`survey_skills`), `AGENTS.md`, `package.json`
  - **Acceptance:** `blender --version` + `survey_skills` confirm Blender 3.6/4.2 LTS; AGENTS.md §1 changed to "Zero runtime deps for core sim; `three` isolated in lazy chunk"; package.json + `three@0.160.0` + `@types/three`
  - **Validation:** `npx tsc --noEmit` passes; `npm run build` entrypoint <200 KiB
  - **Evidence:** <!-- fill after implement -->

- [ ] **OBJ-002** — CI: Khronos glTF Validator step for `.glb` assets
  - **Requirement:** NFR-005
  - **Areas:** `.github/workflows/ci.yml`
  - **Acceptance:** CI job runs Khronos Validator over `public/assets/**/*.glb`; fails build on errors
  - **Validation:** CI passes on current assets; fails on intentionally broken glTF
  - **Evidence:**

- [ ] **OBJ-003** — `public/assets/` directory tree + Blender template
  - **Requirement:** FR-002
  - **Areas:** `public/assets/terrain/`, `public/assets/buildings/`, `public/assets/characters/`, `public/assets/props/`, `blender/templates/how2soap-terrain.blend`
  - **Acceptance:** Directory tree exists; `.blend` template opens in Blender with 1 unit = 1m, +Y Up, SRGB, AgX/Bloom
  - **Validation:** Blender MCP `get_scene_info` confirms template
  - **Evidence:**

- [ ] **OBJ-004** — Author 6 initial glTF assets (terrain, props, buildings, colonist)
  - **Requirement:** FR-002, FR-004
  - **Areas:** Blender authoring → `public/assets/**/*.glb`
  - **Acceptance:** `grass-tile.glb` (100–500 tris), `tree.glb` (50–300 tris), `rock.glb`, `house.glb` (300–1,500 tris), `mine-shaft.glb`, `colonist.glb` (800–3,000 tris, 4 bones); Binary `.glb`, +Y Up, Apply Modifiers, JPEG 85, Draco off (props) / on (terrain)
  - **Validation:** All pass Khronos Validator; `renderer.info` tri counts match budgets
  - **Evidence:**

- [ ] **OBJ-005** — Three.js loader integration (GLTFLoader + DRACOLoader + KTX2Loader)
  - **Requirement:** FR-002
  - **Areas:** `src/ui/StrategyMap3D.ts` (new), `public/draco/` (decoders)
  - **Acceptance:** `GLTFLoader` loads `.glb` via `/assets/...`; DRACOLoader decoder self-hosted in `public/draco/`; KTX2Loader stub; `renderer.outputColorSpace = SRGBColorSpace`
  - **Validation:** `npx tsc --noEmit` passes; 6 assets render in scene; 60 fps for 100-instance scene
  - **Evidence:**

- [ ] **OBJ-006** — 3D viewport: Replace StrategyMapCanvas with Three.js isometric view
  - **Requirement:** FR-001, FR-008
  - **Areas:** `src/ui/StrategyMap3D.ts`, camera/lighting
  - **Acceptance:** 50–60° pitch, 35–50mm FOV OrbitControls (no 90° top-down); 1× warm Sun + Sky Texture ambient + emissive torch points; UnrealBloomPass + BokehPass (DoF) gated by prefers-reduced-motion; diurnal Sun/Sky interpolation from sim time-of-day
  - **Validation:** 60 fps @ ≤150k tris / ≤200 draw calls; reduced-motion disables DoF/bloom; keyboard nav (WASD/arrows/Space/+/-) preserved
  - **Evidence:**

- [ ] **OBJ-007** — 3D colony labor: InstancedMesh + desire-path wear + Boids
  - **Requirement:** FR-004
  - **Areas:** `src/ui/StrategyMap3D.ts`, `src/engine/colony.ts` (no sim change)
  - **Acceptance:** InstancedMesh for colonists (1 draw call/100 workers); 4-bone rigs (root/spine/head/arm-stub); 32×32 wear grid → darkened path decal overlay; speed bonus +20% on worn paths
  - **Validation:** 50 colonists pathing @ 60 fps; desire-path wear renders; wage/strike via COLONY_SYNC still triggers
  - **Evidence:**

- [ ] **OBJ-008** — Mining designator: drag rectangle → workers path → harvest → haul
  - **Requirement:** FR-005
  - **Areas:** `src/ui/StrategyMap3D.ts`, `sim.worker.ts` (WorkerCommand DESIGNATE_MINE)
  - **Acceptance:** Mouse drag on 3D terrain → `WorkerCommand: { type: 'DESIGNATE_MINE', rect: {x0,y0,x1,y1} }` → workers path to nodes, harvest, haul to hearth
  - **Validation:** Designator works; workers arrive; resources harvested; haul to hearth
  - **Evidence:**

- [ ] **OBJ-009** — Civ VII-style construction UI: District/Quarter + Wonder + adjacency
  - **Requirement:** FR-003, FR-006, FR-007
  - **Areas:** `src/app/panels.ts`, `src/ui/` (new panels), `sim.worker.ts` (PLACE_DISTRICT, SLOT_BUILDING, BUILD_WONDER, RESEARCH)
  - **Acceptance:** Left build panel shows District icon + 2 build slots + adjacency arrows + overbuilding penalty (red); Wonder = 1 tile adjacent to District; placement mode shows predicted yields (before/after, green up/red down); tech trees (Technology + Civics, Age-locked mastery); yield overlay toggle (`#btn-yield-overlay`); Leader banners (top-right)
  - **Validation:** Build District→Quarter end-to-end (place Mine → slot Smelter+Hauler → yields recalc); adjacency arrows correct; tech tree unlocks gate recipes
  - **Evidence:**

- [ ] **OBJ-010** — Colonist cards + Work tab + Bills tab + Orders menu
  - **Requirement:** FR-004
  - **Areas:** `src/app/panels.ts` (tabs), `src/ui/` (cards)
  - **Acceptance:** Bottom HUD: colonist cards (portrait, job, wage status; click select, right-click manual order); F1 Work tab: grid colonists×work-types (1–4 priorities, outline=skill level); Orders menu: Mine/Haul/Cut/Hunt designators (drag rect); Bills tab: `SET_BILL` (recipe, threshold, autoCraft)
  - **Validation:** Priorities persist to COLONY_SYNC; strike if morale <20; Bills auto-crafts
  - **Evidence:**

- [ ] **OBJ-011** — LOD chains for buildings (THREE.LOD at 40m)
  - **Requirement:** FR-010
  - **Areas:** Blender Decimate → `*_lod0.glb` / `*_lod1.glb` / `*_lod2.glb`; `StrategyMap3D.ts` (LOD swap)
  - **Acceptance:** Each building has LOD0 (full) / LOD1 (50% Decimate) / LOD2 (25%); THREE.LOD at 40 m distance (`lod.addLevel(high, 0); lod.addLevel(low, 40)`)
  - **Validation:** Framerate holds when zoomed out; LOD swaps occur at correct distances
  - **Evidence:**

- [ ] **OBJ-012** — Blender asset expansion: 30+ glTF assets + texture atlas
  - **Requirement:** FR-002
  - **Areas:** Blender authoring; `public/assets/buildings/building-atlas.png` (512²–1024² JPEG/WebP/KTX2)
  - **Acceptance:** ≥30 distinct glTF assets (all biome-themed: copper-mushroom, soap-crystal cave, etc.); all pass Khronos Validator; 1 material per building type (atlas)
  - **Validation:** Scene stays ≤300k tris; `renderer.info` within budget
  - **Evidence:**

- [ ] **OBJ-013** — WCAG 2.2 audit + regression tests + PWA offline
  - **Requirement:** NFR-004, NFR-006
  - **Areas:** `tests/glTF.test.ts`, `tests/civ-ui.test.ts`, `src/styles.css`, `public/sw.js`, `.github/workflows/ci.yml`
  - **Acceptance:** 2.5.8 (24px targets on new UI), 2.3.1 (bloom flash guard), prefers-reduced-motion (disable tilt-shift/bloom), contrast on composited bg; 194 existing + new glTF.test.ts (schema for asset manifest) + civ-ui.test.ts (district/quarter adjacency); PWA sw.js caches `public/assets/**/*.glb` offline-first; manifest.webmanifest valid
  - **Validation:** `npm run build` entrypoint <200 KiB (main chunk); `npx vitest run` passes; 60 fps (100 colonists + 30 buildings + 500 props); PWA installable offline
  - **Evidence:**

## Definition of Done
- [ ] All 13 objectives ticked with evidence blocks
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx vitest run` → all passing (230 + new tests)
- [ ] `npm run build` → entrypoint <200 KiB (main chunk); Three.js in lazy chunk
- [ ] CI green (tsc + vitest + build + glTF Validator)
- [ ] 60 fps @ ≤150k tris / ≤200 draw calls for 100-colonist scene
- [ ] All `.glb` pass Khronos Validator
- [ ] PWA installable offline with `public/assets/**/*.glb` cached
- [ ] WCAG 2.2: 2.5.8, 2.3.1, prefers-reduced-motion, contrast — all checked
