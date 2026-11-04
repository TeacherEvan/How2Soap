# TRACEABILITY — How2Soap FF-Mining

## Objective → Requirement → Test → Evidence

| Objective | Requirement | Test | Evidence |
|-----------|-------------|------|----------|
| OBJ-001 (AGENTS.md + three) | FR-002, NFR-003 | tsc --noEmit | AGENTS.md §1 changed; three@0.160.0 installed; Blender 5.2.2 LTS confirmed |
| OBJ-002 (CI Validator) | NFR-005 | ci.yml | `.github/workflows/ci.yml` + Khronos magic check (`glTF` bytes) |
| OBJ-003 (assets + template) | FR-002 | ls public/assets/ | 4 subdirs + blender/templates/README.md with export settings |
| OBJ-004 (6 glTF assets) | FR-002, FR-004 | `tests/glTF.test.ts` | 6 `.glb` exported via Blender 5.2.2; sizes 1.3K–14K |
| OBJ-005 (GLTFLoader) | FR-002 | tsc --noEmit | `src/ui/GLTFLoader.ts` (GLTFLoader + DRACOLoader, self-hosted) |
| OBJ-006 (3D viewport) | FR-001, FR-008 | tsc --noEmit | `src/ui/StrategyMap3D.ts` (50° pitch, diurnal, lazy Three.js) |
| OBJ-007 (InstancedMesh + wear) | FR-004 | manual (3D verify pending) | InstancedMesh colonists + desire-path decal (32×32 wear grid) |
| OBJ-008 (Mine designator) | FR-005 | manual (drag-rect) | `DESIGNATE_MINE` WorkerCommand + Plan §5 |
| OBJ-009 (Civ UI) | FR-003, FR-006, FR-007 | `tests/civ-ui.test.ts` (10 tests) | `src/ui/CivBuildPanel.ts` (yields, districts, adjacency, placement, overlay) |
| OBJ-010 (Cards + Work + Bills) | FR-004 | manual (HUD) | CivBuildPanel + bottom tabs (Build/Work/Research/Bills) |
| OBJ-011 (LOD) | FR-010 | manual (THREE.LOD) | `GLTFLoader.loadLOD()` at 40 m |
| OBJ-012 (30+ assets + atlas) | FR-002 | `tests/glTF.test.ts` (size <500 KiB) | Building atlas 512²–1024² (JPEG/WebP/KTX2) — PENDING Phase 5 |
| OBJ-013 (WCAG + tests + PWA) | NFR-004, NFR-006 | vitest, tsc, build, CI | 243 tests passing (230 + 13 new); entrypoint 186 KiB < 200 KiB |

## Verification Gate Results (2026-11-04 23:47)
- `npx tsc --noEmit` → 0 errors ✓
- `npx vitest run` → 243 passed (50 files), 0 failed ✓
- `npm run build` → entrypoint 186 KiB ✓ (splash PNG 679 KiB warning pre-existing, unrelated)

## Files Changed
| File | Change |
|------|--------|
| `AGENTS.md` | §1 amended: three in lazy chunk |
| `package.json` | + three@0.160.0, + @types/three@0.160.0 |
| `package-lock.json` | (auto) |
| `.github/workflows/ci.yml` | + Khronos glTF magic check |
| `src/ui/GLTFLoader.ts` | NEW (Three.js glTF 2.0 + Draco, self-hosted) |
| `src/ui/StrategyMap3D.ts` | NEW (50° pitch, diurnal, lazy Three.js, drag-rect) |
| `src/ui/CivBuildPanel.ts` | NEW (Civ VII HUD: yields, districts, quarters, adjacency) |
| `public/assets/terrain/grass-tile.glb` | NEW (1.3K, 2 tris, vertex-colour) |
| `public/assets/props/tree.glb` | NEW (14K, ~80 tris) |
| `public/assets/props/rock.glb` | NEW (3.2K, ~80 tris) |
| `public/assets/buildings/house.glb` | NEW (3.5K, ~50 tris) |
| `public/assets/buildings/mine-shaft.glb` | NEW (7.9K, ~120 tris) |
| `public/assets/characters/colonist.glb` | NEW (11K, 4-bone rig, ~200 tris) |
| `blender/scripts/build_assets.py` | NEW (headless Blender 5.2.2 asset builder) |
| `blender/scripts/export_glb.py` | NEW (glTF export helper: Draco/LOD) |
| `blender/templates/README.md` | NEW (Blender template docs) |
| `tests/civ-ui.test.ts` | NEW (10 tests: adjacency, WorkerCommands) |
| `tests/glTF.test.ts` | NEW (3 tests: assets exist, magic bytes, sizes) |
| `docs/plans/blender-offensive/` | NEW (4 plan files: MD/HTML/JSON/SARIF) |
| `docs/.scratch-audit/` | NEW (run artifacts: REQUIREMENTS, CODEBASE-STATE, ARCHITECTURE, TODO, TRACEABILITY) |
