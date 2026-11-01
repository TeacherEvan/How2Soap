import { describe, it, expect } from 'vitest';
import {
  BIOME_DAG,
  calculateRadialHaulCostKcal,
  calculateHarvestTotalCostKcal,
} from '../src/data/biomeNodes';

describe('Hierarchical Biome Resource Registry (OBJ-002 / AC-005)', () => {
  it('contains the 4 primary categories per master spec', () => {
    const keys = BIOME_DAG.map((node) => node.key);
    expect(keys).toContain('TREES');
    expect(keys).toContain('ROCKS_MINERALS');
    expect(keys).toContain('MUSHROOMS_FLORA');
    expect(keys).toContain('ANIMALS');
  });

  it('defines White Oak with Outer Bark containing Tannin and Heartwood Log', () => {
    const treeCategory = BIOME_DAG.find((c) => c.key === 'TREES');
    const oak = treeCategory?.species.find((s) => s.id === 'TREE_WHITE_OAK');
    expect(oak).toBeDefined();
    expect(oak?.parts.some((p) => p.id === 'OAK_OUTER_BARK')).toBe(true);
    expect(oak?.parts.some((p) => p.id === 'OAK_HEARTWOOD_LOG')).toBe(true);
  });

  it('defines Scots Pine with softwood trunk carveable into wooden buckets', () => {
    const treeCategory = BIOME_DAG.find((c) => c.key === 'TREES');
    const pine = treeCategory?.species.find((s) => s.id === 'TREE_SCOTS_PINE');
    expect(pine).toBeDefined();
    const trunk = pine?.parts.find((p) => p.id === 'PINE_TRUNK');
    expect(trunk?.targetMohs).toBe(1.8);
  });

  it('defines Halite, Kaolin, Chert, and Limestone in ROCKS_MINERALS', () => {
    const rockCategory = BIOME_DAG.find((c) => c.key === 'ROCKS_MINERALS');
    const ids = rockCategory?.species.map((s) => s.id);
    expect(ids).toContain('ROCK_HALITE');
    expect(ids).toContain('ROCK_KAOLIN_CLAY');
    expect(ids).toContain('ROCK_CHERT_FLINT');
    expect(ids).toContain('ROCK_LIMESTONE');
  });

  it('calculates radial haul energy with player mass and carried weight', () => {
    // 50m distance, 5kg carried, 70kg player
    const costKcal = calculateRadialHaulCostKcal(50, 5, 70);
    // Work = (75) * 9.80665 * 1.2 * 100 = 88,260 J
    // Kcal = 88,260 / (0.22 * 4184) = ~95.88 kcal
    expect(costKcal).toBeGreaterThan(50);
    expect(costKcal).toBeLessThan(150);
  });

  it('scales fracture energy down with superior tool Mohs rating and mechanical advantage', () => {
    const poorToolCost = calculateHarvestTotalCostKcal(100000, 2.0, 3.0, 1.0, 0, 0);
    const goodToolCost = calculateHarvestTotalCostKcal(100000, 6.5, 3.0, 2.5, 0, 0);
    expect(goodToolCost).toBeLessThan(poorToolCost);
  });
});
