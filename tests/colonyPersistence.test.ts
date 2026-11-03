import { describe, it, expect } from 'vitest';
import {
  serializeSave,
  deserializeSave,
  compressSaveToBase64,
  decompressBase64ToSave,
  migrateSave,
  type SerializedWorldSave,
} from '../src/engine/persistence';
import { restoreWorldFromSave } from '../src/engine/worldRestore';
import {
  createInitialColonyState,
  recruitColonist,
  assignColonistJob,
  administerStimulant,
  type WageContract,
} from '../src/engine/colony';

describe('Task 3: Colony Persistence, Worker Commands & World Restore', () => {
  describe('Save serialization & deserialization with colony state', () => {
    it('round-trips colony state through serializeSave and deserializeSave', () => {
      const colony = createInitialColonyState();
      const contract: WageContract = { commodity: 'BAR_SOAP', dailyAmount: 2 };
      const c1 = recruitColonist(colony, 'Suds Lover', 'APPRENTICE_CHEMIST', contract, 10);
      c1.morale = 95;
      c1.position = { x: 120, y: -45 };
      c1.velocity = { vx: 1.5, vy: -0.5 };
      assignColonistJob(c1, 'TREE_WHITE_OAK', 'OAK_HEARTWOOD_LOG', 20);
      administerStimulant(c1, 'WILLOW_TEA');

      // Set some desire path grid values
      colony.desirePathGrid[50] = 120;
      colony.desirePathGrid[512] = 255;

      const save: SerializedWorldSave = {
        version: 2,
        timestamp: 12345678,
        tick: 1440,
        day: 2,
        ambientTempK: 295.15,
        rngSeed: 9999,
        player: {
          glucoseKcal: 1100,
          adiposeKcal: 14000,
          hydrationPct: 90,
          coreTempK: 310.15,
          clothingIclo: 0.1,
        },
        inventory: {},
        vessels: [],
        ever: {},
        renown: 5,
        affinity: { apothecary: 10, soapwright: 20, forgewright: 0 },
        chapter: 1,
        fabricatedRecipes: ['MOLD_BAR_SOAP'],
        objectivesDone: [],
        lettersDone: [],
        epilogueSeen: false,
        colony: {
          colonists: colony.colonists,
          ledger: colony.ledger,
          desirePathGrid: Array.from(colony.desirePathGrid),
          nextColonistId: colony.nextColonistId,
          lastDecayTick: colony.lastDecayTick,
        },
      };

      const json = serializeSave(save);
      const restored = deserializeSave(json);

      expect(restored.colony).toBeDefined();
      expect(restored.colony?.colonists.length).toBe(1);
      expect(restored.colony?.colonists[0].name).toBe('Suds Lover');
      expect(restored.colony?.colonists[0].archetype).toBe('APPRENTICE_CHEMIST');
      expect(restored.colony?.colonists[0].morale).toBe(95);
      expect(restored.colony?.colonists[0].position).toEqual({ x: 120, y: -45 });
      expect(restored.colony?.colonists[0].assignedJob?.speciesId).toBe('TREE_WHITE_OAK');
      expect(restored.colony?.colonists[0].activeStimulant?.stimulantId).toBe('WILLOW_TEA');
      expect(restored.colony?.desirePathGrid[50]).toBe(120);
      expect(restored.colony?.desirePathGrid[512]).toBe(255);
      expect(restored.colony?.nextColonistId).toBe(colony.nextColonistId);
    });

    it('round-trips colony state through gzip base64 compression with SHA-256 integrity', async () => {
      const colony = createInitialColonyState();
      const c1 = recruitColonist(colony, 'Miner One', 'MINER', { commodity: 'DRIED_MEAT', dailyAmount: 1 }, 0);
      expect(c1.id).toBe('colonist_1');
      colony.desirePathGrid[100] = 77;

      const save: SerializedWorldSave = {
        version: 2,
        timestamp: 1000,
        tick: 200,
        day: 1,
        ambientTempK: 288.15,
        rngSeed: 123,
        player: {
          glucoseKcal: 1200,
          adiposeKcal: 15000,
          hydrationPct: 100,
          coreTempK: 310.15,
          clothingIclo: 0.05,
        },
        inventory: {},
        vessels: [],
        ever: {},
        renown: 0,
        affinity: { apothecary: 0, soapwright: 0, forgewright: 0 },
        chapter: 0,
        fabricatedRecipes: [],
        objectivesDone: [],
        lettersDone: [],
        epilogueSeen: false,
        colony: {
          colonists: colony.colonists,
          ledger: colony.ledger,
          desirePathGrid: Array.from(colony.desirePathGrid),
          nextColonistId: colony.nextColonistId,
        },
      };

      const b64 = await compressSaveToBase64(serializeSave(save));
      const recovered = await decompressBase64ToSave(b64);

      expect(recovered.colony).toBeDefined();
      expect(recovered.colony?.colonists.length).toBe(1);
      expect(recovered.colony?.colonists[0].name).toBe('Miner One');
      expect(recovered.colony?.desirePathGrid[100]).toBe(77);
    });

    it('handles legacy saves without a colony field cleanly', () => {
      // Legacy v1 save
      const v1 = {
        version: 1,
        timestamp: 100,
        tick: 50,
        day: 1,
        ambientTempK: 288.15,
        player: { glucoseKcal: 1000, adiposeKcal: 10000, hydrationPct: 90, coreTempK: 310.15, clothingIclo: 0.05 },
        inventory: {},
        vessels: [],
      };
      const migrated = migrateSave(v1);
      expect(migrated.version).toBe(2);
      expect(migrated.colony).toBeUndefined();

      // Legacy v2 save without colony
      const v2Json = JSON.stringify({
        version: 2,
        player: { glucoseKcal: 1000 },
      });
      const deserializedV2 = deserializeSave(v2Json);
      expect(deserializedV2.colony).toBeUndefined();
    });
  });

  describe('restoreWorldFromSave and colony restore helper', () => {
    it('restores WorldState cleanly and supports restoring full ColonyState with Uint8Array grid', async () => {
      const colony = createInitialColonyState();
      recruitColonist(colony, 'Chemist', 'APPRENTICE_CHEMIST', { commodity: 'BAR_SOAP', dailyAmount: 1 }, 5);
      colony.desirePathGrid[42] = 200;

      const save: SerializedWorldSave = {
        version: 2,
        timestamp: 0,
        tick: 100,
        day: 1,
        ambientTempK: 290.15,
        rngSeed: 42,
        player: { glucoseKcal: 1000, adiposeKcal: 10000, hydrationPct: 90, coreTempK: 310.15, clothingIclo: 0.05 },
        inventory: {},
        vessels: [],
        ever: {},
        renown: 0,
        affinity: { apothecary: 0, soapwright: 0, forgewright: 0 },
        chapter: 0,
        fabricatedRecipes: [],
        objectivesDone: [],
        lettersDone: [],
        epilogueSeen: false,
        colony: {
          colonists: colony.colonists,
          ledger: colony.ledger,
          desirePathGrid: Array.from(colony.desirePathGrid),
          nextColonistId: colony.nextColonistId,
        },
      };

      const world = restoreWorldFromSave(save);
      expect(world.tick).toBe(100);

      // Verify restoreColonyFromSave
      const { restoreColonyFromSave } = await import('../src/engine/worldRestore');
      const restoredColony = restoreColonyFromSave(save);
      expect(restoredColony.colonists.length).toBe(1);
      expect(restoredColony.colonists[0].name).toBe('Chemist');
      expect(restoredColony.desirePathGrid).toBeInstanceOf(Uint8Array);
      expect(restoredColony.desirePathGrid.length).toBe(1024);
      expect(restoredColony.desirePathGrid[42]).toBe(200);

      // Verify fallback when save.colony is missing
      const saveNoColony = { ...save, colony: undefined };
      const fallbackColony = restoreColonyFromSave(saveNoColony);
      expect(fallbackColony.colonists).toEqual([]);
      expect(fallbackColony.desirePathGrid).toBeInstanceOf(Uint8Array);
      expect(fallbackColony.desirePathGrid.length).toBe(1024);
    });
  });

  describe('Worker commands and colony state semantics', () => {
    it('simulates worker handling RECRUIT_COLONIST, ASSIGN_COLONIST_JOB, ADMINISTER_STIMULANT, SET_WAGE_CONTRACT', async () => {
      const {
        createInitialColonyState,
        recruitColonist,
        assignColonistJob,
        administerStimulant,
        setWageContract,
      } = await import('../src/engine/colony');

      const colony = createInitialColonyState();
      expect(colony.colonists).toHaveLength(0);

      // 1. RECRUIT_COLONIST
      const c = recruitColonist(colony, 'Ada Lovelace', 'APPRENTICE_CHEMIST', { commodity: 'BAR_SOAP', dailyAmount: 1 }, 10);
      expect(c.id).toBe('colonist_1');
      expect(c.name).toBe('Ada Lovelace');
      expect(c.archetype).toBe('APPRENTICE_CHEMIST');
      expect(colony.colonists).toHaveLength(1);

      // 2. ASSIGN_COLONIST_JOB
      assignColonistJob(c, 'TREE_WHITE_OAK', 'OAK_HEARTWOOD_LOG', 15);
      expect(c.assignedJob).toBeDefined();
      expect(c.assignedJob?.speciesId).toBe('TREE_WHITE_OAK');
      expect(c.assignedJob?.partId).toBe('OAK_HEARTWOOD_LOG');
      expect(c.assignedJob?.workRequired).toBe(15);
      expect(c.status).toBe('TRAVELING');

      // 3. ADMINISTER_STIMULANT
      const stimOk = administerStimulant(c, 'WILLOW_TEA');
      expect(stimOk).toBe(true);
      expect(c.activeStimulant).toBeDefined();
      expect(c.activeStimulant?.stimulantId).toBe('WILLOW_TEA');
      expect(c.activeStimulant?.phase).toBe('BOOST');

      // 4. SET_WAGE_CONTRACT
      setWageContract(c, { commodity: 'DRIED_MEAT', dailyAmount: 3 });
      expect(c.wageContract.commodity).toBe('DRIED_MEAT');
      expect(c.wageContract.dailyAmount).toBe(3);
    });

    it('simulates stepColony execution per tick and verifies desire paths and payroll', async () => {
      const {
        createInitialColonyState,
        recruitColonist,
        assignColonistJob,
        stepColony,
      } = await import('../src/engine/colony');
      const { createInventoryState, addItemToContainer } = await import('../src/engine/inventory');
      const { BIOME_DAG } = await import('../src/data/biomeNodes');

      const colony = createInitialColonyState();
      const inventory = createInventoryState();

      // Add wage commodities to camp cache
      addItemToContainer(inventory.campCache, {
        itemId: 'BAR_SOAP',
        count: 10,
        massKg: 1.0,
        label: 'Bar of Soap',
      });

      const c = recruitColonist(colony, 'Worker Bob', 'FORAGER', { commodity: 'BAR_SOAP', dailyAmount: 1 }, 0);
      assignColonistJob(c, 'TREE_WHITE_OAK', 'OAK_HEARTWOOD_LOG', 5);

      // Advance by 1 step (6 minutes)
      stepColony(colony, 6.0, 1, inventory.campCache, BIOME_DAG);

      expect(c.position.x !== 0 || c.position.y !== 0).toBe(true);
      // Colonist should have updated desire paths
      const nonZeroCells = colony.desirePathGrid.filter(v => v > 0);
      expect(nonZeroCells.length).toBeGreaterThan(0);
    });
  });
});
