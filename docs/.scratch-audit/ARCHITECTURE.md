# ARCHITECTURE — How2Soap FF-Mining

## Current → Target

**Current:** 2D Canvas (StrategyMapCanvas astrolabe) + small WebGL preview (LabBench3DCanvas).
**Target:** Three.js 3D isometric/top-down (50–60° pitch) with Blender-authored PBR assets; 2D canvas retained as fallback/minimap.

### Areas Being Edited

| Area | Current | Target | File(s) |
|------|---------|--------|---------|
| 3D Viewport | 2D canvas (astrolabe) | Three.js WebGL, 50° pitch, diurnal Sun/Sky, bloom/DoF | `src/ui/StrategyMapCanvas.ts` → `src/ui/StrategyMap3D.ts` (new) |
| Asset Pipeline | Hand-built low-poly (lowPolyMeshes) | Blender → glTF 2.0 → GLTFLoader | `public/assets/` (new), `blender/` (new) |
| Colony Rendering | 2D canvas dots | InstancedMesh colonists (1 draw call/100), 4-bone rigs | `src/ui/StrategyMap3D.ts`, `src/engine/colony.ts` (no sim change) |
| Construction UI | Workbench tabs | Civ district/quarter + tech trees + yield overlay | `src/app/panels.ts`, `src/ui/` (new panels) |
| Build Config | webpack <200 KiB | Same + Three.js lazy chunk | `webpack.config.js`, `package.json` |

### Interfaces / Dependencies
- **Worker → UI:** `COLONY_SYNC` postMessage (existing) + snapshot (existing SAB) — no new worker→UI protocol for 3D view
- **UI → Worker:** New `WorkerCommand` types (PLACE_DISTRICT, SLOT_BUILDING, BUILD_WONDER, RESEARCH, DESIGNATE_MINE, SET_BILL) added to `sim.worker.ts` (compile-time exhaustive dispatch — add to type union)
- **Three.js → Worker:** Renderer reads `state.snapshot` (existing) — no direct worker coupling
- **Blender → Three.js:** `.glb` files in `public/assets/` via `asset/resource`; Draco/KTX2 decoders self-hosted

### Data / Control Flow
```
Blender (.blend) → export_glb.py → .glb (validated) → public/assets/
  → Three.js GLTFLoader → scene objects
  → renderer reads state.snapshot (SAB, 10 Hz) for positions/yields
  → User click/modify → WorkerCommand → sim.worker.ts → COLONY_SYNC → snapshot update → renderer re-renders
```

### Security Boundaries
- **glTF parser (Three.js GLTFLoader):** Pin `three@0.160.0`; validate all `.glb` with Khronos Validator in CI; Draco WASM SRI-pinned; decoders self-hosted (not CDN)
- **Worker commands:** Compile-time exhaustive; unknown commands surfaced as in-game events (never silent — existing pattern)
- **SAB:** 67,648 bytes unchanged; colony via postMessage (existing)

### AC Mapping
| AC | Architecture element |
|----|---------------------|
| AC-001 | AGENTS.md amendment; package.json + three; CI Validator step; dynamic import |
| AC-002 | Blender template; 6 glTF assets; GLTFLoader + DRACOLoader; renderer.info budget |
| AC-003 | StrategyMap3D.ts: 50° pitch, OrbitControls, diurnal Sun/Sky, bloom/DoF (gated) |
| AC-004 | InstancedMesh colonists; desire-path decal (32×32 wear grid → canvas texture); DESIGNATE_MINE |
| AC-005 | Civ UI panels; WorkerCommands; adjacency/delta arrows; tech tree modal |
| AC-006 | 30+ glTF assets; LOD chains; building atlas; PWA sw.js glob |
