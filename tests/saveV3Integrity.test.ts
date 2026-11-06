import { describe, it, expect } from 'vitest';
import {
  serializeSave,
  deserializeSave,
  type SerializedWorldSave,
} from '../src/engine/persistence';
import { restoreWorldFromSave, restoreColonyFromSave } from '../src/engine/worldRestore';
import { createInitialColonyState } from '../src/engine/colony';

describe('Save v3 Integrity & Colony/Paddock/TimedRequests Persistence (M0)', () => {
  it('serializes and deserializes v3 save with colony, paddock, and timedRequests', () => {
    const colony = createInitialColonyState();
    colony.desirePathGrid[10] = 150;

    const save: SerializedWorldSave = {
      version: 3,
      timestamp: Date.now(),
      tick: 300,
      day: 5,
      ambientTempK: 290.15,
      rngSeed: 424242,
      player: {
        glucoseKcal: 1100,
        adiposeKcal: 14000,
        hydrationPct: 90,
        coreTempK: 310.15,
        clothingIclo: 0.1,
      },
      inventory: {},
      vessels: [{ id: 1, material: 'WOOD', capacityL: 2, moles: [1, 2, 3] }],
      ever: {},
      renown: 50,
      affinity: { apothecary: 10, soapwright: 20, forgewright: 5 },
      chapter: 1,
      fabricatedRecipes: ['BAR_SOAP'],
      objectivesDone: ['first_soap'],
      lettersDone: [],
      colony: {
        colonists: [{
          id: 'c_1',
          name: 'Pioneer John',
          archetype: 'FORAGER',
          status: 'IDLE',
          position: { x: 10, y: 20 },
          velocity: { vx: 0, vy: 0 },
          baseSpeed: 80,
          morale: 85,
          wageContract: { commodity: 'FOOD', dailyAmount: 1 },
          activeStimulant: null,
          assignedJob: null,
          carriedYields: [],
          recruitedTick: 0,
        }],
        ledger: [],
        desirePathGrid: Array.from(colony.desirePathGrid),
        nextColonistId: 2,
      },
      paddock: {
        animals: [{ id: 'pig_1', species: 'WILD_BOAR', name: 'Barnaby', satiety: 90, lastFedDay: 4 }],
      },
      timedRequests: [
        {
          slot: 0,
          id: 'req_wash_tallow_300',
          title: 'Camp Doctor: Antiseptic Soap',
          requiredItemId: 'BAR_SOAP',
          requiredQty: 1,
          spawnTick: 300,
          deadlineTick: 420,
          urgencyTier: 2,
          rewardRenown: 35,
          penaltyMorale: 8,
          penaltyHygiene: 15,
          status: 'active',
        },
      ],
    };

    const json = serializeSave(save);
    const restored = deserializeSave(json);

    expect(restored.version).toBe(3);
    expect(restored.rngSeed).toBe(424242);
    expect(restored.colony?.colonists[0].name).toBe('Pioneer John');
    expect(restored.colony?.desirePathGrid[10]).toBe(150);
    expect(restored.paddock?.animals[0].name).toBe('Barnaby');
    expect(restored.timedRequests?.[0].title).toBe('Camp Doctor: Antiseptic Soap');

    // Test restoreWorldFromSave and restoreColonyFromSave
    const world = restoreWorldFromSave(restored);
    expect(world.tick).toBe(300);
    expect(world.vessels.length).toBe(1);

    const colonyState = restoreColonyFromSave(restored);
    expect(colonyState.colonists.length).toBe(1);
    expect(colonyState.desirePathGrid[10]).toBe(150);
  });
});
