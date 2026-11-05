import { describe, it, expect } from 'vitest';
import {
  serializeSave,
  deserializeSave,
  type SerializedWorldSave,
} from '../src/engine/persistence';
import {
  createExperimentQueue,
  startExperiment,
  stepExperiments,
} from '../src/engine/campaign/experiments';
import {
  createRealmState,
  stepRealmTurn,
  applyDistributeStimulants,
  applyDistributeClothes,
} from '../src/engine/campaign/realm';

describe('60-Turn Headless Save Soak & Replay Determinism (M1 / §4.1 & §9)', () => {
  it('runs a headless 60-turn campaign simulation and asserts save size <= 512,000 bytes', () => {
    const queue = createExperimentQueue(2);
    const realm = createRealmState('brass_coast');
    const inventory: Record<string, number> = {
      RAW_HIDE_MEDIUM: 50,
      OAK_BARK: 100,
      MASH: 50,
      WILLOW_TEA: 40,
      LEATHER_TUNIC: 30,
    };

    let simulatedSave: SerializedWorldSave = {
      version: 3,
      timestamp: 100000,
      tick: 0,
      day: 1,
      ambientTempK: 288.15,
      rngSeed: 987654321,
      player: {
        glucoseKcal: 1200,
        adiposeKcal: 15000,
        hydrationPct: 100,
        coreTempK: 310.15,
        clothingIclo: 0.1,
      },
      inventory: { ...inventory },
      vessels: [],
      ever: {},
      renown: 0,
      affinity: { apothecary: 0, soapwright: 0, forgewright: 0 },
      chapter: 0,
      fabricatedRecipes: [],
      objectivesDone: [],
      lettersDone: [],
      epilogueSeen: false,
      experiments: queue,
      realm,
    };

    // Soak for 60 turns
    for (let turn = 1; turn <= 60; turn++) {
      // Step experiments and realm
      stepExperiments(queue, turn);
      stepRealmTurn(realm, () => 0.5); // non-crashing roll

      // Enqueue experiments on certain turns
      if (turn % 4 === 1 && inventory.RAW_HIDE_MEDIUM >= 1 && inventory.OAK_BARK >= 2) {
        startExperiment(queue, {
          recipeId: 'veg_tanning',
          recipeName: 'Vegetable Tanning',
          workHours: 48,
          currentTurn: turn,
          inputs: [
            { itemId: 'RAW_HIDE_MEDIUM', count: 1 },
            { itemId: 'OAK_BARK', count: 2 },
          ],
          outputs: [{ itemId: 'VEGETABLE_TANNED_LEATHER', count: 1 }],
          inventory,
        });
      }

      if (turn % 6 === 0 && inventory.WILLOW_TEA >= 2) {
        applyDistributeStimulants(realm, 'WILLOW_TEA', 2);
        inventory.WILLOW_TEA -= 2;
      }

      if (turn % 10 === 0 && inventory.LEATHER_TUNIC >= 1) {
        applyDistributeClothes(realm, 1);
        inventory.LEATHER_TUNIC -= 1;
      }

      simulatedSave.tick += 240;
      simulatedSave.day = turn;
      simulatedSave.inventory = { ...inventory };
      simulatedSave.experiments = queue;
      simulatedSave.realm = realm;
    }

    const serialized = serializeSave(simulatedSave);
    const saveByteLength = new TextEncoder().encode(serialized).length;

    // Strict storage budget invariant: <= 512,000 bytes (512 KiB)
    expect(saveByteLength).toBeLessThanOrEqual(512000);
    // Realistically pure JSON state after 60 turns is < 15 KiB
    expect(saveByteLength).toBeLessThan(15000);

    // Verify deserialization integrity
    const deserialized = deserializeSave(serialized);
    expect(deserialized.day).toBe(60);
    expect(deserialized.realm?.turn).toBe(61);
    expect(deserialized.experiments).toBeDefined();
  });

  it('guarantees byte-identical serialized save replay across 30 scripted turns', () => {
    function runScripted30Turns(seed: number): string {
      const queue = createExperimentQueue(1);
      const realm = createRealmState('salt_steppes');
      const inventory: Record<string, number> = {
        MASH: 20,
        WILLOW_TEA: 20,
      };

      const save: SerializedWorldSave = {
        version: 3,
        timestamp: 1234567,
        tick: 0,
        day: 1,
        ambientTempK: 288.15,
        rngSeed: seed,
        player: {
          glucoseKcal: 1200,
          adiposeKcal: 15000,
          hydrationPct: 100,
          coreTempK: 310.15,
          clothingIclo: 0.1,
        },
        inventory,
        vessels: [],
        ever: {},
        renown: 0,
        affinity: { apothecary: 0, soapwright: 0, forgewright: 0 },
        chapter: 0,
        fabricatedRecipes: [],
        objectivesDone: [],
        lettersDone: [],
        epilogueSeen: false,
        experiments: queue,
        realm,
      };

      let rngState = seed;
      const deterministicRng = () => {
        rngState = (rngState * 1664525 + 1013904223) >>> 0;
        return (rngState >>> 0) / 0xffffffff;
      };

      for (let turn = 1; turn <= 30; turn++) {
        stepExperiments(queue, turn);
        stepRealmTurn(realm, deterministicRng);

        if (turn === 3 && inventory.MASH >= 1) {
          startExperiment(queue, {
            recipeId: 'fermentation',
            recipeName: 'Grain Fermentation',
            workHours: 24,
            currentTurn: turn,
            inputs: [{ itemId: 'MASH', count: 1 }],
            outputs: [],
            inventory,
            rngNextFloat: deterministicRng,
          });
        }

        save.tick += 240;
        save.day = turn;
      }

      return serializeSave(save);
    }

    const runA = runScripted30Turns(42);
    const runB = runScripted30Turns(42);

    expect(runA).toBe(runB);
    expect(new TextEncoder().encode(runA).length).toBe(new TextEncoder().encode(runB).length);
  });
});
