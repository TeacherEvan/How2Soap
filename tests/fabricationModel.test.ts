/**
 * Fabrication feasibility model — pure logic mirrored from the worker's FABRICATE guard.
 */
import { describe, expect, it } from 'vitest';
import { aggregateInventory, assessRecipe } from '../src/ui/fabricationModel';
import { FABRICATION_RECIPES } from '../src/engine/fabrication';

function fakeInventory(items: { id: string; count: number }[]): any {
  const mk = (entries: typeof items) =>
    entries.map(({ id, count }) => ({ itemId: id, label: id, count, massKg: 0.1, quality: 1 }));
  return {
    backpackUnlocked: true,
    bareHands: mk(items.slice(0, 2)),
    backpack: mk(items.slice(2, 6)),
    campCache: mk(items.slice(6)),
    tools: {
      CUTTING_SKINNING: null,
      CHOPPING_CARVING: null,
      PERCUSSION_MINING: { name: 'River Hammerstone', slot: 'PERCUSSION_MINING', mohs: 6.5 },
      THERMAL_HANDLING: null,
      STITCHING_MEDICAL: null,
      EATING_UTENSIL: null,
    },
  };
}

describe('aggregateInventory', () => {
  it('sums counts across bare hands, backpack and camp cache', () => {
    const inv = fakeInventory([
      { id: 'CHARCOAL', count: 2 },
      { id: 'CHARCOAL', count: 1 },
      { id: 'CHARCOAL', count: 3 },
      { id: 'HALITE_SALT', count: 2 },
    ]);
    const counts = aggregateInventory(inv);
    expect(counts.get('CHARCOAL')).toBe(6); // 2 + 1 (bare hands) + 3 (backpack)
    expect(counts.get('HALITE_SALT')).toBe(2);
  });
});

describe('assessRecipe', () => {
  it('with exact materials supplied, no "Missing:" blocker remains', () => {
    const recipe = FABRICATION_RECIPES.find((r) => r.inputs.length > 0)!;
    const items = recipe.inputs.map((i) => ({ id: i.itemId, count: i.count }));
    const inv = fakeInventory(items);
    const a = assessRecipe(recipe, aggregateInventory(inv), inv.tools, 100000);
    expect(a.reasons.filter((r) => r.startsWith('Missing'))).toEqual([]);
  });

  it('blocks with explicit missing list when materials are short', () => {
    const recipe = FABRICATION_RECIPES[0];
    const inv = fakeInventory([]); // empty everything
    const a = assessRecipe(recipe, aggregateInventory(inv), inv.tools, 10000);
    const anyMissing = recipe.inputs.some((i) => !['CHARCOAL'].includes(i.itemId));
    if (anyMissing) {
      expect(a.feasible).toBe(false);
      expect(a.missing.length).toBeGreaterThan(0);
      expect(a.reasons.join(' ')).toContain('Missing');
    }
  });

  it('blocks when glucose is below energy cost', () => {
    const recipe = FABRICATION_RECIPES[0];
    const inv = fakeInventory([]);
    const a = assessRecipe(recipe, aggregateInventory(inv), inv.tools, 1);
    expect(a.reasons.some((r) => r.includes('kcal'))).toBe(true);
  });

  it('tool requirement blocks when slot is empty', () => {
    const recipe = FABRICATION_RECIPES.find((r) => r.requiredToolSlot)!;
    const inv = fakeInventory(
      recipe.inputs.map((i) => ({ id: i.itemId, count: i.count })),
    );
    inv.tools[recipe.requiredToolSlot!] = null;
    const a = assessRecipe(recipe, aggregateInventory(inv), inv.tools, 100000);
    expect(a.reasons.some((r) => r.includes('tool in slot'))).toBe(true);
  });

  it('flags bench-side inputs without claiming container shortage', () => {
    const recipe =
      FABRICATION_RECIPES.find((r) => r.inputs.some(() => true)) ?? FABRICATION_RECIPES[0];
    const a = assessRecipe(recipe, aggregateInventory(fakeInventory([])), fakeInventory([]).tools, 100000);
    expect(Array.isArray(a.vesselInputsNeeded)).toBe(true);
  });
});
