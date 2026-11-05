import { describe, it, expect } from 'vitest';
import {
  hexToPixel,
  pixelToHex,
  axialDistance,
  getHexNeighbors,
  getHexDisc,
  generateHexMap,
  HEX_RADIUS_METERS,
} from '../src/engine/campaign/hexMap';

describe('Axial Hex Map Math & Procedural Generation (§7.1, §7.2)', () => {
  it('roundtrips hexToPixel and pixelToHex with high precision', () => {
    const coords = [
      { q: 0, r: 0 },
      { q: 1, r: -1 },
      { q: 2, r: 3 },
      { q: -4, r: 2 },
      { q: 5, r: -5 },
    ];

    for (const c of coords) {
      const p = hexToPixel(c.q, c.r, HEX_RADIUS_METERS);
      const rev = pixelToHex(p.x, p.y, HEX_RADIUS_METERS);
      expect(rev.q).toBe(c.q);
      expect(rev.r).toBe(c.r);
    }
  });

  it('computes correct axial distance between coordinates', () => {
    expect(axialDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    expect(axialDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
    expect(axialDistance({ q: 0, r: 0 }, { q: 1, r: -1 })).toBe(1);
    expect(axialDistance({ q: 0, r: 0 }, { q: 3, r: 2 })).toBe(5);
  });

  it('generates 6 unique neighbors for any hex', () => {
    const neighbors = getHexNeighbors({ q: 0, r: 0 });
    expect(neighbors).toHaveLength(6);
    for (const n of neighbors) {
      expect(axialDistance({ q: 0, r: 0 }, n)).toBe(1);
    }
  });

  it('computes hex disc size according to 3*r*(r+1)+1 formula', () => {
    const disc0 = getHexDisc({ q: 0, r: 0 }, 0);
    expect(disc0).toHaveLength(1);

    const disc1 = getHexDisc({ q: 0, r: 0 }, 1);
    expect(disc1).toHaveLength(7); // 3*1*2 + 1

    const disc3 = getHexDisc({ q: 0, r: 0 }, 3);
    expect(disc3).toHaveLength(37); // 3*3*4 + 1
  });

  it('generates deterministic hex map with biomes and hearth center', () => {
    const map1 = generateHexMap(42, 6);
    const map2 = generateHexMap(42, 6);

    expect(map1.tiles.size).toBe(map2.tiles.size);
    expect(map1.tiles.get('0,0')?.biome).toBe('HEARTH');
    expect(map1.tiles.get('0,0')?.revealed).toBe(true);

    // Verify determinism across all tiles
    for (const [key, t1] of map1.tiles.entries()) {
      const t2 = map2.tiles.get(key);
      expect(t2).toBeDefined();
      expect(t1.biome).toBe(t2!.biome);
      expect(t1.elevation).toBe(t2!.elevation);
    }
  });
});
