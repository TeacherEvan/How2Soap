import { describe, expect, it } from 'vitest';
import { createWorld, createWorldVessel } from '../src/engine/world';
import { restoreWorldFromSave } from '../src/engine/worldRestore';

describe('restoreWorldFromSave', () => {
  it('rebuilds vessel chemistry byte-identically', () => {
    const w = createWorld(291.15);
    const v = createWorldVessel(w, 1, 'FIRED_CERAMIC', 2.0);
    v.moles[0] = 3.5; v.moles[6] = 0.75; v.moles[9] = 0.25; v.temperatureK = 341.4;
    const save = {
      version: 2 as const, timestamp: 0, tick: 777, day: 4, ambientTempK: 291.15,
      rngSeed: 42,
      player: null as any,
      inventory: null as any,
      vessels: w.vessels.map(vs => ({ ...vs, moles: Array.from(vs.moles), precipitated: Array.from(vs.precipitated) })),
      ever: {}, renown: 0, affinity: { apothecary: 0, soapwright: 0, forgewright: 0 },
      chapter: 0, fabricatedRecipes: [], objectivesDone: [], lettersDone: [], epilogueSeen: false,
    };
    const restored = restoreWorldFromSave(save);
    expect(restored.tick).toBe(777);
    expect(restored.ambientTempK).toBeCloseTo(291.15, 6);
    expect(restored.vessels).toHaveLength(1);
    expect(restored.vessels[0].moles[0]).toBeCloseTo(3.5, 10);
    expect(restored.vessels[0].moles[6]).toBeCloseTo(0.75, 10);
    expect(restored.vessels[0].temperatureK).toBeCloseTo(341.4, 4);
    expect(restored.vessels[0].moles).toBeInstanceOf(Float64Array);
  });
});