import { describe, it, expect } from 'vitest';
import { satisfyVesselInputs, applyVesselConsumption, VESSEL_INPUTS } from '../src/engine/vesselInputs';
import { createVessel, type VesselState } from '../src/engine/chemistry';
import { SPECIES } from '../src/data/speciesRegistry';

describe('vesselInputs (Task 5 pure unit coverage)', () => {
  it('covers all registered vessel-input species definitions', () => {
    expect(VESSEL_INPUTS.WATER_VESSEL).toBeDefined();
    expect(VESSEL_INPUTS.HARDWOOD_ASH_WATER).toBeDefined();
    expect(VESSEL_INPUTS.ETHANOL_BROTH).toBeDefined();
    expect(VESSEL_INPUTS.PENICILLIN_BROTH).toBeDefined();
    expect(VESSEL_INPUTS.SALICYLIC_ACID).toBeDefined();
    expect(VESSEL_INPUTS.SULFURIC_ACID).toBeDefined();
    expect(VESSEL_INPUTS.MOLTEN_KOH).toBeDefined();
    expect(VESSEL_INPUTS.MOLTEN_NAOH).toBeDefined();
  });

  it('fails with human-readable shortfall labels when vessel requirements are not satisfied', () => {
    const emptyVessels: VesselState[] = [createVessel(1)];
    const res = satisfyVesselInputs(emptyVessels, ['WATER_VESSEL', 'ETHANOL_BROTH']);
    expect(res.ok).toBe(false);
    expect(res.shortfall).toContain('Water (≥ 1 L)');
    expect(res.shortfall).toContain('Ethanol broth (≥ 0.5 mol)');
    expect(res.plan).toBeUndefined();
  });

  it('satisfies volume-based inputs (e.g. WATER_VESSEL) and respects consume=none', () => {
    const v = createVessel(1);
    v.moles[SPECIES.H2O] = 100; // ~1.8 L
    const res = satisfyVesselInputs([v], ['WATER_VESSEL']);
    expect(res.ok).toBe(true);
    expect(res.plan).toHaveLength(1);
    expect(res.plan![0]).toEqual({
      vesselId: 1,
      speciesIdx: null,
      consume: 'none',
    });

    applyVesselConsumption([v], res.plan!);
    expect(v.moles[SPECIES.H2O]).toBe(100); // untouched because consume: 'none'
  });

  it('satisfies species-based inputs and zeroes species when consume=all', () => {
    const v = createVessel(2);
    v.moles[SPECIES.ETHANOL] = 1.0;
    const res = satisfyVesselInputs([v], ['ETHANOL_BROTH']);
    expect(res.ok).toBe(true);
    expect(res.plan![0].consume).toBe('all');

    applyVesselConsumption([v], res.plan!);
    expect(v.moles[SPECIES.ETHANOL]).toBe(0);
  });
});
