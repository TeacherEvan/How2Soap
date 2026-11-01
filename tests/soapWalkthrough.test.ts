import { describe, expect, it } from 'vitest';
import {
  addHardwoodAsh,
  addSpecies,
  addWaterLiters,
  computePH,
  createVessel,
  decant,
  dissolvedMoles,
  liquidVolumeL,
  skim,
  stepVessel,
} from '../src/engine/chemistry';
import { SPECIES } from '../src/data/speciesRegistry';

function advance(vessel: ReturnType<typeof createVessel>, hours: number, ambientTempK = 293.15) {
  for (let hour = 0; hour < hours; hour += 1) {
    stepVessel(vessel, { dtSeconds: 3600, ambientTempK });
  }
}

/**
 * The canonical gameplay trace from the master spec, section 6:
 * hardwood ash -> lye -> render fat -> saponify -> salt out bar soap.
 */
describe('canonical soap walkthrough', () => {
  it('leaches lye, decants it, saponifies tallow and salts out hard soap', () => {
    // 1-4. Seasoned oak ash (200 g) soaked in 1 L water for one day.
    const bucket = createVessel(1, 'WOOD', 5);
    addWaterLiters(bucket, 1);
    addHardwoodAsh(bucket, 200);
    advance(bucket, 24);

    // CaO -> Ca(OH)2, then K2CO3 + Ca(OH)2 -> 2 KOH + CaCO3.
    expect(bucket.moles[SPECIES.K2CO3]).toBeLessThan(1e-3);
    expect(bucket.moles[SPECIES.KOH]).toBeCloseTo(0.52, 2); // 0.26 mol K2CO3 -> 0.52 mol KOH
    expect(bucket.precipitated[SPECIES.CACO3]).toBeCloseTo(0.26, 2);

    const lyePH = computePH(bucket);
    expect(lyePH).toBeGreaterThan(13.5); // spec: pH 13.71
    expect(lyePH).toBeLessThan(14);

    // 5. Decant the clear lye off the chalk sludge.
    const pot = createVessel(2, 'FIRED_CERAMIC', 2);
    decant(bucket, pot, 1);

    expect(bucket.precipitated[SPECIES.CACO3]).toBeGreaterThan(0.25);
    expect(dissolvedMoles(pot, SPECIES.KOH)).toBeGreaterThan(0.49);
    expect(dissolvedMoles(pot, SPECIES.KOH)).toBeLessThan(0.525);
    expect(dissolvedMoles(pot, SPECIES.CACO3)).toBeLessThan(0.001);

    // 6. Render 150 g purified tristearin into the warm lye at 345 K.
    addSpecies(pot, SPECIES.TRISTEARIN, 150 / 891.5); // 0.1683 mol
    pot.temperatureK = 345;
    advance(pot, 2, 293.15);

    const expectedSoap = 3 * (150 / 891.5); // 0.5049 mol
    expect(dissolvedMoles(pot, SPECIES.K_STEARATE)).toBeCloseTo(expectedSoap, 2);
    expect(dissolvedMoles(pot, SPECIES.GLYCEROL)).toBeCloseTo(150 / 891.5, 3);
    expect(dissolvedMoles(pot, SPECIES.TRISTEARIN)).toBeLessThan(1e-3);

    // 7. Salt out: 50 g halite -> solid sodium stearate curds.
    addSpecies(pot, SPECIES.NACL, 50 / 58.44);
    pot.temperatureK = 345;
    advance(pot, 1, 293.15);

    expect(dissolvedMoles(pot, SPECIES.K_STEARATE)).toBeLessThan(0.01);
    expect(pot.precipitated[SPECIES.NA_STEARATE]).toBeGreaterThan(0.45);
    expect(pot.precipitated[SPECIES.NA_STEARATE]).toBeLessThan(0.52);

    const crock = createVessel(3, 'FIRED_CERAMIC', 1);
    const curds = skim(pot, crock, SPECIES.NA_STEARATE);
    const soapMassGrams = curds * 306.459;
    expect(soapMassGrams).toBeGreaterThan(145); // spec: 154.4 g
    expect(soapMassGrams).toBeLessThan(160);
    expect(liquidVolumeL(pot)).toBeGreaterThan(0.8);
  });
});
