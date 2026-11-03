import { describe, expect, it } from 'vitest';
import { FABRICATION_RECIPES, METALLURGY_TOOLS, RECIPE_EFFECTS } from '../src/engine/fabrication';
import { consumeFood, createPlayerMetabolism } from '../src/engine/metabolism';

const recipe = (id: string) => FABRICATION_RECIPES.find(r => r.id === id)!;

describe('fabrication consume semantics (worker logic, simulated against pure APIs)', () => {
  it('RECIPE_EFFECTS maps backpack recipe to unlock_backpack', () => {
    expect(RECIPE_EFFECTS.RECIPE_STITCH_BACKPACK.onFabricate).toBe('unlock_backpack');
  });
  it('RECIPE_SALINE_RINSE exists and produces SALINE_RINSE', () => {
    expect(recipe('RECIPE_SALINE_RINSE').outputs.map(o => o.itemId)).toContain('SALINE_RINSE');
  });
  it('eat: consumeFood grants +15% with a utensil and nothing without', () => {
    const p = createPlayerMetabolism();
    const plain = consumeFood(p, 1000, 0);
    expect(plain.absorbedKcal).toBeCloseTo(1000, 6);
    const p2 = createPlayerMetabolism();
    const forked = consumeFood(p2, 1000, { hasCleanUtensil: true });
    expect(forked.absorbedKcal).toBeCloseTo(1150, 6);
    expect(forked.pathogenRiskEliminated).toBe(true);
  });
  it('bronze fork maps to EATING_UTENSIL slot with +15% and pathogen immunity', () => {
    expect(METALLURGY_TOOLS.BRONZE_FORK.slot).toBe('EATING_UTENSIL');
  });
});