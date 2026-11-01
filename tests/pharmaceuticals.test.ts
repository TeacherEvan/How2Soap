import { describe, it, expect } from 'vitest';
import { SPECIES, getSpecies } from '../src/data/speciesRegistry';
import { REACTIONS } from '../src/data/reactionRules';
import { BIOME_DAG } from '../src/data/biomeNodes';
import {
  FABRICATION_RECIPES,
  MEDICAL_CONSUMABLES,
} from '../src/engine/fabrication';
import {
  createPlayerMetabolism,
  stepPlayerMetabolism,
  applySalicylicAcid,
  applyPenicillin,
  applyEthanolDisinfectant,
} from '../src/engine/metabolism';

describe('Phase 4 Pharmaceuticals & Tier 4 Tech Tests', () => {
  it('registers glucose, ethanol, salicin, salicylic acid, and penicillin species', () => {
    expect(SPECIES.GLUCOSE).toBe(24);
    expect(SPECIES.ETHANOL).toBe(25);
    expect(SPECIES.SALICIN).toBe(26);
    expect(SPECIES.SALICYLIC_ACID).toBe(27);
    expect(SPECIES.PENICILLIN).toBe(28);

    const ethanol = getSpecies(SPECIES.ETHANOL);
    expect(ethanol.name).toContain('Ethanol');
    expect(ethanol.boilingPointK).toBeCloseTo(351.5, 1);

    const salicylicAcid = getSpecies(SPECIES.SALICYLIC_ACID);
    expect(salicylicAcid.name).toContain('Salicylic acid');

    const penicillin = getSpecies(SPECIES.PENICILLIN);
    expect(penicillin.name).toContain('Penicillin');
  });

  it('defines fermentation and salicin oxidation reaction rules', () => {
    const fermentation = REACTIONS.find((r) => r.id === 'ethanol_fermentation');
    expect(fermentation).toBeDefined();

    const salicinHydrolysis = REACTIONS.find((r) => r.id === 'salicin_hydrolysis_oxidation');
    expect(salicinHydrolysis).toBeDefined();
  });

  it('includes Penicillium mold culture in Biome DAG', () => {
    const fungiCategory = BIOME_DAG.find((c) => c.key === 'MUSHROOMS_FLORA');
    expect(fungiCategory).toBeDefined();

    const penicillium = fungiCategory?.species.find((s) => s.id === 'FLORA_PENICILLIUM');
    expect(penicillium).toBeDefined();
    expect(penicillium?.parts.some((p) => p.id === 'PENICILLIUM_HARVEST')).toBe(true);
  });

  it('defines medical fabrication recipes and consumable items', () => {
    const recipeIds = FABRICATION_RECIPES.map((r) => r.id);
    expect(recipeIds).toContain('FERMENT_GRAIN_MASH');
    expect(recipeIds).toContain('EXTRACT_SALICYLIC_ACID');
    expect(recipeIds).toContain('CULTIVATE_PENICILLIN');
    expect(recipeIds).toContain('DISTILL_ANTISEPTIC_ETHANOL');

    expect(MEDICAL_CONSUMABLES.SALICYLIC_ACID_TINCTURE).toBeDefined();
    expect(MEDICAL_CONSUMABLES.PENICILLIN_DOSE).toBeDefined();
    expect(MEDICAL_CONSUMABLES.ETHANOL_DISINFECTANT).toBeDefined();
  });

  it('applies medical treatments to player metabolic conditions', () => {
    const player = createPlayerMetabolism();
    player.conditions.fever = true;
    player.coreTempK = 312.15; // 39.0 °C hyperthermia
    player.conditions.systemicInfection = true;
    player.conditions.woundContamination = true;

    // Test salicylic acid antipyretic drop
    applySalicylicAcid(player);
    expect(player.conditions.fever).toBe(false);
    expect(player.coreTempK).toBeCloseTo(310.35, 1); // -1.8 °C drop -> 37.2 °C

    // Test penicillin curing sepsis
    applyPenicillin(player);
    expect(player.conditions.systemicInfection).toBe(false);

    // Test ethanol eliminating wound contamination
    applyEthanolDisinfectant(player);
    expect(player.conditions.woundContamination).toBe(false);
  });

  it('increases metabolic burn during systemic infection', () => {
    const p1 = createPlayerMetabolism();
    const p2 = createPlayerMetabolism();
    p2.conditions.systemicInfection = true;

    // Advance 1 game hour (3600s)
    stepPlayerMetabolism(p1, { dtSeconds: 3600, ambientTempK: 293.15 });
    stepPlayerMetabolism(p2, { dtSeconds: 3600, ambientTempK: 293.15 });

    // Infection drains additional ~60 kcal/hr
    const burn1 = 2000 - p1.glucoseKcal;
    const burn2 = 2000 - p2.glucoseKcal;
    expect(burn2).toBeGreaterThan(burn1 + 50);
  });
});
