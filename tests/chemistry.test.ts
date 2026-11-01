import { describe, expect, it } from 'vitest';
import {
  addSpecies,
  addWaterLiters,
  computePH,
  createVessel,
  decant,
  dissolvedMoles,
  liquidVolumeL,
  stepVessel,
} from '../src/engine/chemistry';
import { SPECIES } from '../src/data/speciesRegistry';

function waterVessel(litres = 1) {
  const vessel = createVessel(1, 'FIRED_CERAMIC', 2);
  addWaterLiters(vessel, litres);
  return vessel;
}

describe('pH solver', () => {
  it('returns neutral pH for pure water', () => {
    expect(computePH(waterVessel())).toBeCloseTo(7, 2);
  });

  it('matches the spec walkthrough for 0.52 mol KOH in ~1 L', () => {
    const vessel = waterVessel();
    addSpecies(vessel, SPECIES.KOH, 0.52);
    const ph = computePH(vessel);
    expect(ph).toBeGreaterThan(13.6);
    expect(ph).toBeLessThan(13.8);
  });

  it('rises monotonically with strong base concentration', () => {
    const weak = waterVessel();
    const strong = waterVessel();
    addSpecies(weak, SPECIES.KOH, 0.01);
    addSpecies(strong, SPECIES.KOH, 0.5);
    expect(computePH(strong)).toBeGreaterThan(computePH(weak));
    expect(computePH(weak)).toBeGreaterThan(11);
    expect(computePH(strong)).toBeLessThan(14);
  });
});

describe('precipitation', () => {
  it('settles calcium carbonate out of solution', () => {
    const vessel = waterVessel();
    addSpecies(vessel, SPECIES.CACO3, 0.26);
    stepVessel(vessel, { dtSeconds: 60, ambientTempK: 293.15 });
    expect(vessel.precipitated[SPECIES.CACO3]).toBeGreaterThan(0.259);
    expect(dissolvedMoles(vessel, SPECIES.CACO3)).toBeLessThan(0.001);
  });

  it('leaves settled solids behind when decanting', () => {
    const source = waterVessel();
    addSpecies(source, SPECIES.CACO3, 0.26);
    stepVessel(source, { dtSeconds: 60, ambientTempK: 293.15 });

    const target = createVessel(2, 'FIRED_CERAMIC', 2);
    decant(source, target, 1);

    expect(source.precipitated[SPECIES.CACO3]).toBeGreaterThan(0.259);
    expect(target.moles[SPECIES.CACO3]).toBeLessThan(0.001);
  });
});

describe('latent heat and boiling', () => {
  it('clamps at 373.15 K and vaporizes water instead of overheating', () => {
    const vessel = waterVessel();
    vessel.heaterWatts = 350;
    const before = vessel.moles[SPECIES.H2O];
    for (let i = 0; i < 10; i += 1) {
      stepVessel(vessel, { dtSeconds: 360, ambientTempK: 293.15 });
    }
    expect(vessel.temperatureK).toBeCloseTo(373.15, 1);
    expect(vessel.moles[SPECIES.H2O]).toBeLessThan(before);
    expect(liquidVolumeL(vessel)).toBeLessThan(1.2);
  });

  it('condenses distilled vapour into a receiving vessel', () => {
    const still = waterVessel(0.5);
    const receiver = createVessel(2, 'BOROSILICATE', 1);
    still.headspaceClosed = true;
    still.heaterWatts = 800;
    for (let i = 0; i < 30; i += 1) {
      stepVessel(still, { dtSeconds: 360, ambientTempK: 293.15, condenser: receiver });
    }
    expect(receiver.moles[SPECIES.H2O]).toBeGreaterThan(0.01);
  });
});

describe('Faraday electrolysis', () => {
  it('splits brine into chlorine, hydrogen and caustic soda (water also electrolyzes)', () => {
    const vessel = waterVessel();
    addSpecies(vessel, SPECIES.NACL, 2.5);
    vessel.appliedVolts = 5;
    vessel.cellResistanceOhm = 2;
    stepVessel(vessel, { dtSeconds: 3600, ambientTempK: 293.15 });

    const currentBrine = (5 - 2.19) / 2;
    const extentBrine = (currentBrine * 3600) / (96485.33212 * 2);
    const currentWater = (5 - 1.73) / 2;
    const extentWater = (currentWater * 3600) / (96485.33212 * 2);

    // Brine electrolysis: Cl2 + H2 + 2 NaOH per 2 e-
    expect(vessel.moles[SPECIES.CL2]).toBeCloseTo(extentBrine, 4);
    // H2 from brine (1:1) + water (2:1 per reaction)
    expect(vessel.moles[SPECIES.H2]).toBeCloseTo(extentBrine + extentWater * 2, 4);
    expect(vessel.moles[SPECIES.NAOH]).toBeCloseTo(extentBrine * 2, 4);
    expect(vessel.moles[SPECIES.NACL]).toBeCloseTo(2.5 - extentBrine * 2, 3);
    // Water electrolysis also produces O2
    expect(vessel.moles[SPECIES.O2]).toBeCloseTo(extentWater, 4);
  });
});
