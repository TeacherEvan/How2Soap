import { describe, it, expect } from 'vitest';
import { SPECIES, getSpecies } from '../src/data/speciesRegistry';
import { REACTIONS, ELECTROLYSIS_RULES } from '../src/data/reactionRules';
import { BIOME_DAG } from '../src/data/biomeNodes';
import { FABRICATION_RECIPES } from '../src/engine/fabrication';
import { createVessel, addSpecies, stepVessel } from '../src/engine/chemistry';

describe('Phase 5 Electricity, Voltaic Pile & Pure Elements', () => {
  it('registers all Tier 5 chemical species correctly', () => {
    expect(SPECIES.SPHALERITE).toBe(29);
    expect(SPECIES.PYRITE).toBe(30);
    expect(SPECIES.KNO3).toBe(31);
    expect(SPECIES.SO2).toBe(32);
    expect(SPECIES.ZNO).toBe(33);
    expect(SPECIES.ZINC).toBe(34);
    expect(SPECIES.H2SO4).toBe(35);
    expect(SPECIES.POTASSIUM_METAL).toBe(36);
    expect(SPECIES.SODIUM_METAL).toBe(37);

    const zinc = getSpecies(SPECIES.ZINC);
    expect(zinc.name).toContain('Zinc');

    const h2so4 = getSpecies(SPECIES.H2SO4);
    expect(h2so4.ionChargeZ).toBe(-2);

    const potMetal = getSpecies(SPECIES.POTASSIUM_METAL);
    expect(potMetal.standardPhase).toBe('SOLID');
  });

  it('defines thermal roasting, acid chamber, and molten electrolysis rules', () => {
    const roasting = REACTIONS.find((r) => r.id === 'sphalerite_roasting');
    expect(roasting).toBeDefined();
    expect(roasting?.minTempK).toBeGreaterThanOrEqual(1100);

    const acidChamber = REACTIONS.find((r) => r.id === 'sulfuric_acid_chamber');
    expect(acidChamber).toBeDefined();

    const moltenKoh = ELECTROLYSIS_RULES.find((r) => r.id === 'molten_koh_electrolysis');
    expect(moltenKoh).toBeDefined();
    expect(moltenKoh?.minTempK).toBe(633);

    const moltenNaoh = ELECTROLYSIS_RULES.find((r) => r.id === 'molten_naoh_electrolysis');
    expect(moltenNaoh).toBeDefined();
    expect(moltenNaoh?.minTempK).toBe(591);
  });

  it('includes Sphalerite, Pyrite, and Saltpeter in Biome DAG', () => {
    const rockCategory = BIOME_DAG.find((c) => c.key === 'ROCKS_MINERALS');
    expect(rockCategory).toBeDefined();

    const speciesIds = rockCategory?.species.map((s) => s.id) ?? [];
    expect(speciesIds).toContain('ROCK_SPHALERITE');
    expect(speciesIds).toContain('ROCK_PYRITE');
    expect(speciesIds).toContain('ROCK_SALTPETER');
  });

  it('includes Voltaic Pile, cell, and elemental isolation recipes', () => {
    const recipeIds = FABRICATION_RECIPES.map((r) => r.id);
    expect(recipeIds).toContain('SMELT_ZINC_DISCS');
    expect(recipeIds).toContain('STACK_VOLTAIC_PILE');
    expect(recipeIds).toContain('CRAFT_ELECTROLYSIS_CELL');
    expect(recipeIds).toContain('FABRICATE_ELEMENTAL_SODIUM');
    expect(recipeIds).toContain('FABRICATE_ELEMENTAL_POTASSIUM');
  });

  it('runs molten electrolysis to isolate pure potassium metal at high temperature', () => {
    const vessel = createVessel(1, 'BOROSILICATE', 1);
    addSpecies(vessel, SPECIES.KOH, 2.0);

    // Below melting temperature (300 K): reaction is frozen
    vessel.appliedVolts = 13.2; // Voltaic pile
    vessel.cellResistanceOhm = 2;
    vessel.temperatureK = 300;
    stepVessel(vessel, { dtSeconds: 60, ambientTempK: 300 });
    expect(vessel.moles[SPECIES.POTASSIUM_METAL]).toBe(0);

    // Above melting temperature (700 K > 633 K): molten electrolysis proceeds
    vessel.temperatureK = 700;
    stepVessel(vessel, { dtSeconds: 60, ambientTempK: 700 });
    expect(vessel.moles[SPECIES.POTASSIUM_METAL]).toBeGreaterThan(0);
    expect(vessel.moles[SPECIES.O2]).toBeGreaterThan(0);
  });
});
