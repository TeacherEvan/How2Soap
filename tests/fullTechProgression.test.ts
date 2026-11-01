import { describe, expect, it } from 'vitest';
import {
  createVessel,
  addWaterLiters,
  addSpecies,
  addHardwoodAsh,
  stepVessel,
  decant,
  skim,
  dissolvedMoles,
  computePH,
} from '../src/engine/chemistry';
import { SPECIES } from '../src/data/speciesRegistry';
import {
  createPlayerMetabolism,
  stepPlayerMetabolism,
  applySalicylicAcid,
  applyPenicillin,
} from '../src/engine/metabolism';
import {
  FABRICATION_RECIPES,
  METALLURGY_TOOLS,
  getEatingUtensilBonus,
} from '../src/engine/fabrication';
import { BIOME_DAG } from '../src/data/biomeNodes';

function advance(vessel: ReturnType<typeof createVessel>, hours: number, ambientTempK = 293.15) {
  for (let hour = 0; hour < hours; hour += 1) {
    stepVessel(vessel, { dtSeconds: 3600, ambientTempK });
  }
}

describe('Master Tech Tree End-to-End Walkthrough (Tiers 1 to 5)', () => {
  it('executes full sequential progression from primitive survival to pure elements', () => {
    // -------------------------------------------------------------
    // TIER 1: Survival & Mechanical Fabrication (Backpack & Tunic)
    // -------------------------------------------------------------
    const player = createPlayerMetabolism(0.05); // starts naked/shivering at 0.05 clo
    expect(player.clothingIclo).toBe(0.05);

    // Harvest Pine trunk and Flint nodule
    const trees = BIOME_DAG.find((c) => c.key === 'TREES');
    const pine = trees?.species.find((s) => s.id === 'TREE_SCOTS_PINE');
    const pineTrunk = pine?.parts.find((p) => p.id === 'PINE_TRUNK');
    expect(pineTrunk).toBeDefined();

    // Fabricate Leather Backpack recipe
    const packRecipe = FABRICATION_RECIPES.find((r) => r.id === 'RECIPE_STITCH_BACKPACK');
    expect(packRecipe).toBeDefined();

    // Player equips leather clothing (raises I_clo to 1.15)
    player.clothingIclo = 1.15;
    stepPlayerMetabolism(player, { dtSeconds: 3600, ambientTempK: 283.15 }); // cold night 10 °C
    // With 1.15 clo, player core temperature remains stable (> 36.8 °C)
    expect(player.coreTempK - 273.15).toBeGreaterThan(36.8);

    // -------------------------------------------------------------
    // TIER 2: Potash & Hard Bar Soap
    // -------------------------------------------------------------
    const woodenBucket = createVessel(1, 'WOOD', 5);
    addWaterLiters(woodenBucket, 1.0);
    addHardwoodAsh(woodenBucket, 200); // 200 g oak ash
    advance(woodenBucket, 24);

    expect(computePH(woodenBucket)).toBeGreaterThan(13.5);

    const ceramicPot = createVessel(2, 'FIRED_CERAMIC', 3);
    decant(woodenBucket, ceramicPot, 1.0); // decant clear KOH lye

    // Add 150 g fat and saponify at 345 K
    addSpecies(ceramicPot, SPECIES.TRISTEARIN, 150 / 891.5);
    ceramicPot.temperatureK = 345;
    advance(ceramicPot, 2);

    expect(dissolvedMoles(ceramicPot, SPECIES.K_STEARATE)).toBeGreaterThan(0.45);

    // Salt out with Halite (NaCl) at 345 K
    addSpecies(ceramicPot, SPECIES.NACL, 50 / 58.44);
    ceramicPot.temperatureK = 345;
    advance(ceramicPot, 1, 293.15);
    expect(ceramicPot.precipitated[SPECIES.NA_STEARATE]).toBeGreaterThan(0.45);

    const storageCrock = createVessel(3, 'FIRED_CERAMIC', 2);
    const skimmedSoapMoles = skim(ceramicPot, storageCrock, SPECIES.NA_STEARATE);
    const soapGrams = skimmedSoapMoles * 306.459;
    expect(soapGrams).toBeGreaterThan(145);

    // -------------------------------------------------------------
    // TIER 3: Metallurgy & Bronze Fork
    // -------------------------------------------------------------
    const smeltingCrucible = createVessel(4, 'FIRED_CERAMIC', 2);
    addSpecies(smeltingCrucible, SPECIES.MALACHITE, 1.0);
    addSpecies(smeltingCrucible, SPECIES.CASSITERITE, 0.2);
    addSpecies(smeltingCrucible, SPECIES.CARBON, 2.0);

    // Smelt at charcoal furnace temp (1360 K)
    smeltingCrucible.temperatureK = 1360;
    advance(smeltingCrucible, 1, 1360);

    // Form Bronze alloy from carbothermic reduction
    expect(smeltingCrucible.moles[SPECIES.COPPER] + smeltingCrucible.moles[SPECIES.BRONZE]).toBeGreaterThan(0);

    // Bronze fork grants eating hygiene and +15% caloric digestion
    const utensilBonus = getEatingUtensilBonus(METALLURGY_TOOLS.BRONZE_FORK);
    expect(utensilBonus.netCaloricBonusPct).toBe(0.15);
    expect(utensilBonus.pathogenRiskEliminated).toBe(true);

    // -------------------------------------------------------------
    // TIER 4: Pharmaceuticals (Ethanol, Salicylic Acid, Penicillin)
    // -------------------------------------------------------------
    const fermenter = createVessel(5, 'WOOD', 5);
    addWaterLiters(fermenter, 2.0);
    addSpecies(fermenter, SPECIES.GLUCOSE, 1.0);
    advance(fermenter, 48); // 48h yeast fermentation

    expect(fermenter.moles[SPECIES.ETHANOL]).toBeGreaterThan(1.5);

    // Player contracts systemic infection and fever
    player.conditions.systemicInfection = true;
    player.conditions.fever = true;
    player.coreTempK = 312.15; // 39.0 °C fever

    // Administer Tier 4 remedies
    applySalicylicAcid(player);
    expect(player.conditions.fever).toBe(false);
    expect(player.coreTempK).toBeCloseTo(310.35, 1);

    applyPenicillin(player);
    expect(player.conditions.systemicInfection).toBe(false);

    // -------------------------------------------------------------
    // TIER 5: Voltaic Pile & Molten Faraday Electrolysis
    // -------------------------------------------------------------
    const acidChamber = createVessel(6, 'FIRED_CERAMIC', 5);
    addWaterLiters(acidChamber, 1.0);
    addSpecies(acidChamber, SPECIES.SO2, 2.0);
    addSpecies(acidChamber, SPECIES.KNO3, 2.0);
    acidChamber.temperatureK = 360;
    advance(acidChamber, 6);

    expect(acidChamber.moles[SPECIES.H2SO4]).toBeGreaterThan(0.5);

    // Molten salt electrolysis cell powered by 13.2 V DC Voltaic Pile
    const electrolysisCell = createVessel(7, 'BOROSILICATE', 1);
    addSpecies(electrolysisCell, SPECIES.KOH, 2.0);
    electrolysisCell.appliedVolts = 13.2; // 12-cell pile
    electrolysisCell.cellResistanceOhm = 1.5;
    electrolysisCell.temperatureK = 700; // molten KOH bath (> 633 K)

    advance(electrolysisCell, 1, 700);

    // Pure metallic potassium isolated at cathode
    expect(electrolysisCell.moles[SPECIES.POTASSIUM_METAL]).toBeGreaterThan(0.1);
    expect(electrolysisCell.moles[SPECIES.O2]).toBeGreaterThan(0.02);
  });
});
