/**
 * Pure Axial Hex Math & Map Generation Engine
 *
 * Implements §7.1 & §7.2 of Civ VII 4X Conversion Plan (v8):
 * - Axial coordinates (q, r) with cube coordinate derivation.
 * - Distance, hex neighbors, hex ring, and disc calculations.
 * - World <-> Hex coordinate conversions.
 * - Procedural terrain generation mapped to biomes, wonder ruins, water, salt flats.
 */

export interface AxialCoord {
  readonly q: number;
  readonly r: number;
}

export type HexBiome =
  | 'HEARTH'
  | 'TREES'
  | 'ROCKS_MINERALS'
  | 'MUSHROOMS_FLORA'
  | 'ANIMALS'
  | 'WATER'
  | 'SALT_FLAT'
  | 'BRINE_POND'
  | 'ANCIENT_RUIN'
  | 'RUINED_CAMP';

export interface HexTile {
  readonly q: number;
  readonly r: number;
  readonly biome: HexBiome;
  readonly elevation: number; // 0..1
  readonly moisture: number;  // 0..1
  readonly resourceNodeId?: string;
  roadWear: number; // 0..255 (promoted to road above 96)
  revealed: boolean;
}

export const HEX_RADIUS_METERS = 60; // 60 meters per hex flat-to-flat spacing

export function hexToPixel(q: number, r: number, size = HEX_RADIUS_METERS): { x: number; y: number } {
  const x = size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const y = size * ((3 / 2) * r);
  return { x, y };
}

export function pixelToHex(x: number, y: number, size = HEX_RADIUS_METERS): AxialCoord {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;
  return roundAxial(q, r);
}

export function roundAxial(fracQ: number, fracR: number): AxialCoord {
  const fracS = -fracQ - fracR;
  let q = Math.round(fracQ);
  let r = Math.round(fracR);
  let s = Math.round(fracS);

  const qDiff = Math.abs(q - fracQ);
  const rDiff = Math.abs(r - fracR);
  const sDiff = Math.abs(s - fracS);

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  }
  return { q, r };
}

export function axialDistance(a: AxialCoord, b: AxialCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

export const AXIAL_DIRECTIONS: readonly AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function getHexNeighbors(coord: AxialCoord): AxialCoord[] {
  return AXIAL_DIRECTIONS.map((dir) => ({ q: coord.q + dir.q, r: coord.r + dir.r }));
}

export function getHexDisc(center: AxialCoord, radius: number): AxialCoord[] {
  const results: AxialCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  return results;
}

/**
 * Deterministic pseudo-noise for seeded hex generation.
 */
function pseudoNoise(seed: number, x: number, y: number): number {
  let h = (seed ^ (x * 374761393) ^ (y * 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export interface HexMapGrid {
  readonly radius: number;
  readonly tiles: Map<string, HexTile>;
}

export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function generateHexMap(seed: number, radius = 10): HexMapGrid {
  const tiles = new Map<string, HexTile>();
  const coords = getHexDisc({ q: 0, r: 0 }, radius);

  for (const { q, r } of coords) {
    if (q === 0 && r === 0) {
      tiles.set(hexKey(0, 0), {
        q: 0,
        r: 0,
        biome: 'HEARTH',
        elevation: 0.5,
        moisture: 0.5,
        roadWear: 255,
        revealed: true,
      });
      continue;
    }

    const elev = pseudoNoise(seed, q, r);
    const moist = pseudoNoise(seed + 101, q, r);
    const dist = axialDistance({ q: 0, r: 0 }, { q, r });

    let biome: HexBiome = 'TREES';
    let resourceNodeId: string | undefined;

    if (dist === radius && elev > 0.75) {
      biome = 'WATER';
    } else if (dist === radius - 1 && moist > 0.8) {
      biome = 'BRINE_POND';
      resourceNodeId = 'BRINE_POND';
    } else if (elev < 0.25) {
      biome = 'SALT_FLAT';
      resourceNodeId = 'SALT_FLAT';
    } else if (elev > 0.85 && moist < 0.4) {
      biome = 'ANCIENT_RUIN';
      resourceNodeId = 'RUIN_ARTEFACT';
    } else if (elev > 0.6) {
      biome = 'ROCKS_MINERALS';
      resourceNodeId = 'CHALCOPYRITE_VEIN';
    } else if (moist > 0.6) {
      biome = 'MUSHROOMS_FLORA';
      resourceNodeId = 'WILLOW_STAND';
    } else if (moist < 0.35) {
      biome = 'ANIMALS';
      resourceNodeId = 'AUROCHS_HERD';
    }

    tiles.set(hexKey(q, r), {
      q,
      r,
      biome,
      elevation: elev,
      moisture: moist,
      resourceNodeId,
      roadWear: 0,
      revealed: dist <= 4, // Initial starting fog reveal
    });
  }

  return { radius, tiles };
}
