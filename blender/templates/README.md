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
- Compression: Draco ON for terrain/buildings (static, large) — Level 6-7, Position 14, Normal 10, TexCoord 12, Color 8
  Draco OFF for small props (<2k tris) — decode CPU > benefit
- Animation: Sampling ON, Optimize Animation Size ON (characters only)

## Polygon Budgets
| Asset | Tris |
|-------|------|
| Terrain tile (16×16m chunk) | 100–500 |
| Terrain props (tree, rock, bush) | 50–300 |
| Building (house, mine, tower) | 300–1,500 |
| Hero building (keep/castle) | 1,500–4,000 |
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
