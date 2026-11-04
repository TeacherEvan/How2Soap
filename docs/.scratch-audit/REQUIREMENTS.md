# REQUIREMENTS — How2Soap → FF-Style Top-Down Mining Strategy

## Request (restatement)
Convert existing 2D-canvas chemistry survival game into top-down Final Fantasy-style mining/building strategy game, Civ VII-themed, using Blender as 3D asset pipeline (Blender → glTF → Three.js). Plan-first per user directive 2026-11-04.

## Functional Requirements
| ID | Requirement | Source |
|----|-------------|--------|
| FR-001 | 3D rendering at 50–60° pitch, 35–50mm FOV (FF diorama, not 90° top-down) | Plan §5, Tier 2 (Square Enix) |
| FR-002 | Blender-authored PBR assets (terrain, buildings, characters, props) | Plan §4, Tier 1 (docs.blender.org) |
| FR-003 | Civ VII district/quarter construction UI with adjacency/delta arrows | Plan §5, Tier 2 (Firaxis) |
| FR-004 | Colony labor in 3D: InstancedMesh colonists, desire-path wear, Boids | Plan §5, existing colony.ts |
| FR-005 | Mining designator: drag rectangle → workers path → harvest → haul | Plan §5, Tier 2 (RimWorld) |
| FR-006 | Tech/Civics trees with Age-locked mastery nodes | Plan §5, Tier 2 (Firaxis) |
| FR-007 | Yield overlay toggle (green high-yield tiles) | Plan §5, Tier 2 (Civ VII) |
| FR-008 | Diurnal lighting (existing time-of-day → 3D Sun/Sky) | Plan Phase 2 |
| FR-009 | WorkerCommands: PLACE_DISTRICT, SLOT_BUILDING, BUILD_WONDER, RESEARCH, DESIGNATE_MINE, SET_BILL | Plan §9 (10 endpoints) |
| FR-010 | LOD chain for buildings via THREE.LOD at 40 m | Plan Phase 5, Tier 1 |

## Non-Functional Requirements
| ID | Requirement | Constraint |
|----|-------------|------------|
| NFR-001 | 60 fps @ ≤150k tris / ≤200 draw calls | Plan §4 budget |
| NFR-002 | Entrypoint <200 KiB (main chunk); Three.js lazy-loaded | AGENTS.md §1 (amended) |
| NFR-003 | Zero runtime deps for core sim; `three` only in lazy chunk | AGENTS.md §1 amendment |
| NFR-004 | WCAG 2.2: 2.5.8 (24px), 2.3.1 (photosensitivity), prefers-reduced-motion | Plan §5 |
| NFR-005 | All `.glb` pass Khronos glTF Validator | Tier 1 (Khronos) |
| NFR-006 | PWA offline: SW caches `public/assets/**/*.glb` | Existing sw.js |

## Constraints
- Sim engine (chemistry, colony, metabolism) **must not be rewritten** — rendering layer only
- SAB 67,648 bytes unchanged; colony via COLONY_SYNC postMessage (existing pattern)
- Blender 3.6/4.2 LTS required; glTF 2.0 Binary `.glb` format
- Draco on for terrain/buildings (static, large); off for small props (<2k tris)

## Assumptions
- Blender installed locally (to verify in Phase 0 via `survey_skills`)
- Three.js `^0.160.0` acceptable as new runtime dep (user approved plan)
- Draco/KTX2 decoders self-hosted in `public/draco/` (not CDN in prod)

## Acceptance Criteria
| AC | Criterion | Test |
|----|-----------|------|
| AC-001 | Blender audit + AGENTS.md update + three install + CI Validator | `npx tsc --noEmit` passes; entrypoint <200 KiB; CI green |
| AC-002 | 6 initial glTF assets authored, exported, validated | All `.glb` pass Khronos Validator; `renderer.info` tri counts match budget |
| AC-003 | 3D viewport @ 50–60° pitch, 60 fps | ≤150k tris / ≤200 draw calls; reduced-motion disables DoF/bloom |
| AC-004 | 3D colony: 50 colonists @ 60 fps, desire-path wear, mine-drag | Workers path; wear renders; wage/strike via COLONY_SYNC |
| AC-005 | District→Quarter end-to-end (place Mine → slot Smelter+Hauler → yields recalc) | Adjacency arrows correct; tech tree gates recipes |
| AC-006 | 30+ glTF assets; scene ≤300k tris | All pass Validator; PWA offline works |
