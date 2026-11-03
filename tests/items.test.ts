import { describe, expect, it } from 'vitest';
import { ITEMS, ITEM_BY_ID, FOOD_ITEM_IDS } from '../src/data/items';
import { FABRICATION_RECIPES } from '../src/engine/fabrication';
import { BIOME_DAG } from '../src/data/biomeNodes';

// Vessel-only chemistry: molten salts, aqueous liquors and fermentation broths
// that exist solely inside reaction vessels (world.vessels / SAB moles), never as
// carryable inventory objects. The game models water/acid/lye/broth in vessels,
// not as catalog items (see docs/plans 2026-11-03 story-and-progression, Task 5
// "Water-as-item note"). These ids are deliberately NOT required in ITEM_BY_ID.
const VESSEL_ONLY_IDS: ReadonlySet<string> = new Set([
  'ETHANOL_BROTH',
  'HARDWOOD_ASH_WATER',
  'MOLTEN_KOH',
  'MOLTEN_NAOH',
  'PENICILLIN_BROTH',
  'SALICYLIC_ACID',
  'SULFURIC_ACID',
  'WATER_VESSEL',
]);

const requiredIds = (): Set<string> => {
  const ids = new Set<string>();
  for (const r of FABRICATION_RECIPES) {
    r.inputs.forEach(i => ids.add(i.itemId));
    r.outputs.forEach(o => ids.add(o.itemId));
  }
  for (const cat of BIOME_DAG) for (const sp of cat.species) for (const p of sp.parts) for (const y of p.yields) ids.add(y.itemId);
  for (const vesselOnly of VESSEL_ONLY_IDS) ids.delete(vesselOnly);
  ['RIVER_HAMMERSTONE','FLINT_FLAKE_BLADE','FLINT_ADZE_HEAD','BRONZE_SPEAR','BRONZE_AXE','BRONZE_FORK','LEATHER_BACKPACK','SALINE_RINSE'].forEach(id => ids.add(id));
  return ids;
};

describe('item catalog integrity', () => {
  it('covers every recipe input/output id and every biome yield id', () => {
    for (const id of requiredIds()) {
      expect(ITEM_BY_ID[id], `missing catalog entry: ${id}`).toBeDefined();
    }
  });
  it('has unique ids', () => {
    const seen = new Set<string>();
    for (const item of ITEMS) {
      expect(seen.has(item.id), `duplicate id: ${item.id}`).toBe(false);
      seen.add(item.id);
    }
  });
  it('food items always declare foodKcal and category food', () => {
    for (const id of FOOD_ITEM_IDS) {
      expect(ITEM_BY_ID[id].foodKcal, `${id} foodKcal`).toBeGreaterThan(0);
      expect(ITEM_BY_ID[id].category).toBe('food');
    }
  });
  it('every icon key is non-empty', () => {
    for (const item of ITEMS) expect(item.icon.length).toBeGreaterThan(1);
  });
  it('tier is 1..5 and desc is a real sentence', () => {
    for (const item of ITEMS) {
      expect(item.tier).toBeGreaterThanOrEqual(1);
      expect(item.tier).toBeLessThanOrEqual(5);
      expect(item.desc.length).toBeGreaterThanOrEqual(12);
    }
  });
});
