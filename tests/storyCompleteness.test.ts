import { describe, expect, it } from 'vitest';
import { CHAPTERS, LETTERS, AFFINITIES, RENOWN_THRESHOLDS, LEVEL_TITLES } from '../src/data/story';
import { FABRICATION_RECIPES } from '../src/engine/fabrication';
import { MAX_DEFINED_SPECIES, SPECIES } from '../src/data/speciesRegistry';
import { ITEM_BY_ID } from '../src/data/items';

describe('story data completeness', () => {
  it('six chapters with monotonic renown and dated epigraphs', () => {
    expect(CHAPTERS).toHaveLength(6);
    let prev = -1;
    for (const ch of CHAPTERS) { expect(ch.renown).toBeGreaterThan(prev); prev = ch.renown; expect(ch.epigraph.length).toBeGreaterThan(10); expect(ch.body.length).toBeGreaterThan(40); }
  });
  it('every chapter objective resolves to a known recipe/species/item/flag-target', () => {
    const recipeIds = new Set(FABRICATION_RECIPES.map(r => r.id));
    for (const ch of CHAPTERS) for (const o of ch.objectives) {
      if (o.kind === 'recipe') expect(recipeIds.has(o.target), `${ch.id} recipe ${o.target}`).toBe(true);
      if (o.kind === 'species') { const idx = SPECIES[o.target as keyof typeof SPECIES] as unknown as number; expect(typeof idx).toBe('number'); expect(idx).toBeLessThan(MAX_DEFINED_SPECIES); }
      if (o.kind === 'item') expect(ITEM_BY_ID[o.target], `${o.target}`).toBeDefined();
      if (o.kind === 'flag') expect(typeof o.target).toBe('string');
    }
  });
  it('18 letters, era-gated, six per affinity family by chapter affinity weights', () => {
    expect(LETTERS).toHaveLength(18);
    for (const l of LETTERS) { expect(l.chapter).toBeGreaterThanOrEqual(1); expect(l.chapter).toBeLessThanOrEqual(6); expect(l.rewardRenown).toBeGreaterThan(0); }
    const chapters = LETTERS.map(l => l.chapter);
    expect(Math.max(...chapters)).toBe(6);
    for (const aff of AFFINITIES) expect(aff.thresholds).toEqual([30, 80, 150]);
  });
  it('level curve is non-decreasing with 10 titles', () => {
    expect(RENOWN_THRESHOLDS).toHaveLength(10);
    expect(LEVEL_TITLES).toHaveLength(10);
    for (let i = 1; i < RENOWN_THRESHOLDS.length; i += 1) {
      expect(RENOWN_THRESHOLDS[i]).toBeGreaterThan(RENOWN_THRESHOLDS[i - 1]);
    }
  });
});
