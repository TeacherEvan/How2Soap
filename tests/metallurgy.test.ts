import { describe, it, expect } from 'vitest';
import { SPECIES, getSpecies } from '../src/data/speciesRegistry';
import { REACTIONS } from '../src/data/reactionRules';
import { BIOME_DAG } from '../src/data/biomeNodes';
import { FABRICATION_RECIPES, METALLURGY_TOOLS, getEatingUtensilBonus } from '../src/engine/fabrication';
import { createPlayerMetabolism, consumeFood } from '../src/engine/metabolism';

describe('Phase 3 Metallurgy & Tier 3 Tech Tests', () => {
  it('registers Malachite, Cassiterite, Copper, Tin, and Bronze species', () => {
    expect(SPECIES.MALACHITE).toBe(19);
    expect(SPECIES.CASSITERITE).toBe(20);
    expect(SPECIES.COPPER).toBe(21);
    expect(SPECIES.TIN).toBe(22);
    expect(SPECIES.BRONZE).toBe(23);

    const malachite = getSpecies(SPECIES.MALACHITE);
    expect(malachite.name).toContain('Malachite');
    expect(malachite.standardPhase).toBe('SOLID');

    const bronze = getSpecies(SPECIES.BRONZE);
    expect(bronze.name).toContain('Bronze');
    expect(bronze.standardPhase).toBe('SOLID');
  });

  it('defines carbothermic reduction and bronze alloying reaction rules', () => {
    const malachiteReduction = REACTIONS.find((r) => r.id === 'malachite_reduction');
    expect(malachiteReduction).toBeDefined();
    expect(malachiteReduction?.minTempK).toBeGreaterThanOrEqual(1200);

    const bronzeAlloying = REACTIONS.find((r) => r.id === 'bronze_alloying');
    expect(bronzeAlloying).toBeDefined();
    expect(bronzeAlloying?.minTempK).toBeGreaterThanOrEqual(1200);
  });

  it('includes mineral deposits in the Biome DAG', () => {
    const rockCategory = BIOME_DAG.find((c) => c.key === 'ROCKS_MINERALS');
    expect(rockCategory).toBeDefined();

    const speciesIds = rockCategory?.species.map((s) => s.id) ?? [];
    expect(speciesIds).toContain('ROCK_MALACHITE');
    expect(speciesIds).toContain('ROCK_CASSITERITE');
    expect(speciesIds).toContain('ROCK_SOAPSTONE');
  });

  it('provides fabrication recipes for smelting and bronze tools', () => {
    const recipeIds = FABRICATION_RECIPES.map((r) => r.id);
    expect(recipeIds).toContain('CARVE_SOAPSTONE_MOLD');
    expect(recipeIds).toContain('SMELT_COPPER_INGOT');
    expect(recipeIds).toContain('SMELT_TIN_INGOT');
    expect(recipeIds).toContain('CAST_BRONZE_FORK');
    expect(recipeIds).toContain('CAST_BRONZE_SPEARHEAD');
    expect(recipeIds).toContain('CAST_BRONZE_AXE');

    expect(METALLURGY_TOOLS.BRONZE_FORK.slot).toBe('EATING_UTENSIL');
    expect(METALLURGY_TOOLS.BRONZE_SPEAR.slot).toBe('CUTTING_SKINNING');
    expect(METALLURGY_TOOLS.BRONZE_AXE.slot).toBe('CHOPPING_CARVING');
  });

  it('eating utensil grant +15% net caloric digestion efficiency and eliminates pathogen risk', () => {
    const defaultBonus = getEatingUtensilBonus(null);
    expect(defaultBonus.netCaloricBonusPct).toBe(0);
    expect(defaultBonus.pathogenRiskEliminated).toBe(false);

    const forkBonus = getEatingUtensilBonus(METALLURGY_TOOLS.BRONZE_FORK);
    expect(forkBonus.netCaloricBonusPct).toBe(0.15);
    expect(forkBonus.pathogenRiskEliminated).toBe(true);

    const player = createPlayerMetabolism();
    const initialGlucose = player.glucoseKcal;
    const rawCalories = 200;

    // Without utensil: 200 kcal added
    consumeFood(player, rawCalories, { hasCleanUtensil: false });
    const netGainedWithoutFork = player.glucoseKcal - initialGlucose;
    expect(netGainedWithoutFork).toBe(200);

    // Reset glucose
    player.glucoseKcal = initialGlucose;
    // With utensil: 200 * 1.15 = 230 kcal added
    consumeFood(player, rawCalories, { hasCleanUtensil: true });
    const netGainedWithFork = player.glucoseKcal - initialGlucose;
    expect(netGainedWithFork).toBe(230);
  });
});
