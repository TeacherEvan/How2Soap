# Blender Template — How2Soap FF-Mining

## how2soap-terrain.blend
- Scene units: metres (scale 1.0)
- Transform: +Y Up (glTF exporter default)
- Color space: SRGB (display), Filmic/AgX (color management)
- World: warm Sun + Sky Texture (golden key), cool ambient fill
- Render: Cycles (for baking), Eevee (for preview)
- Collections: Terrain, Buildings, Characters, Props (each exported separately)

## Export Settings (glTF 2.0)
File → Export → glTF 2.0 (.glb)
- Format: Binary (.glb)
- Include: Selected Objects, Cameras/Lights OFF
- Transform: +Y Up
- Data-Mesh: Apply Modifiers ON, UVs ON, Normals ON, Tangents OFF (unless normal maps), Vertex Colors ON if used
- Data-Material: Export (full), Images JPEG (quality 85) or PNG for alpha
- Compression: Draco ON for terrain/buildings (static, large) — Level 6-7 (terrain 7, other assets 6), Position 14, Normal 10, TexCoord 12, Color 8
  Draco OFF automatically for small assets (<2k tris) — decode CPU > benefit; `--draco on|off` still honoured under this rule
- Animation: Sampling ON (`export_animation_sampling=True`) for all exports; mode `ACTIONS` under Blender 5.2 (also carries armature skinning; `SKINNING` where the exporter still offers it for characters, `ACTIONS` for props/hero stations); `--animation-mode auto|actions|skinning` to override

## Workbench Pipeline (`blender/scripts/build_workbench.py`)
Headless: `blender --background --python blender/scripts/build_workbench.py -- --help`
Hero stations + baked 30fps Actions (GLB under `public/assets/workbench/`, baked downstream to `Float32Array`/sprite PNG — never imported by the JS entrypoint):

| Action | Loop | Description |
|---|---|---|
| `hearth_flame` | 30f loop | brazier cone squash + flicker |
| `bellows_pump` | 30f loop | bellows-body pump |
| `pour_stream` | 30f loop | bezier ribbon flow (GLB: object transforms; Blender-side curve-offset UV in manifest) |
| `stir_vortex` | 30f loop | spoon orbit + vortex cone pulse |
| `boil_shake` | 30f loop | cauldron shake + liquid surface pulse |
| `liquid_fill` | 90f one-shot | vessel liquid 0% → 100% morph |
| `crystal_shimmer` | 60f loop | crystal rotate + scale breathing (emission-strength curve lives Blender-side, see manifest) |
| `colonist_walk_idle` | 60f loop | walk-in-place bob + idle sway (4-bone rig, skinning baked) |

## Sprite Atlas (`blender/scripts/bake_sprites.py`)
Headless: `blender --background --python blender/scripts/bake_sprites.py -- --dry-run` / full render
Eevee, transparent film, PNG RGBA; per-frame poses duplicated into a grid and rendered once. Grid + manifest in `src/assets/sprites/atlas.json`. Per-sheet cell sizes keep every PNG under webpack `maxAssetSize` (200000B): flame renders at 128px cells (512×512 sheet — a 1024×1024 sheet would be ~568KB, 2.8× budget), ember/fume/bubbles at 256px cells. 4×4/4×1 layouts and fps are unchanged.

**GLB channel contract:** `build_workbench.py` regenerates `blender/templates/workbench_actions.json` on every bake. The downstream Float32Array bake MUST combine `exported_channels` (read back from each GLB) with `blender_only_channels` from that manifest (curve-data `offset` UV flow for `pour_stream`; material `emission_strength` curve for `crystal_shimmer`). The GLB alone does NOT carry those channels, so a bake that reads GLB only silently loses the pour flow and the crystal shimmer glow.

| Sheet | File | Grid | Frames | FPS |
|---|---|---|---|---|
| flame | `flame.png` (512×512) | 4×4 @128px cells | 16 | 30 (loop) |
| ember | `ember.png` | 4×1 | 4 | 12 |
| fume | `fume.png` | 4×1 | 4 | 12 |
| bubbles | `bubbles.png` | 4×1 | 4 | 12 |


## Polygon Budgets
| Asset | Tris |
|-------|------|
| Terrain tile (16×16m chunk) | 100–500 |
| Terrain props (tree, rock, bush) | 50–300 |
| Building (house, mine, tower) | 300–1,500 |
| Hero building (keep/castle) | 1,500–4,000 |
| Workbench hero station (hearth, vessels, bellows) | 1,500–4,000 |
| Workbench character (colonist rig) | 800–3,000 (15–25 bones max) |
| Character (unit, top-down) | 800–3,000 (15–25 bones max) |
| Character (hero/leader) | 3,000–6,000 |
| **Whole scene target** | **≤150k–300k tris, ≤200 draw calls** |

## Blender Add-ons (bundled, free)
Enable in Preferences → Add-ons:
- Node Wrangler (Principled Texture Setup from filenames)
- glTF 2.0 (the exporter)
- LoopTools, Bool Tool, Magic UV

## Third-party (recommended, paid)
- HardOps + BoxCutter (Superhive/Blender Market, GPL, Blender 3.5–5.2)
- Texel Density Checker (Blender Extensions, free)
