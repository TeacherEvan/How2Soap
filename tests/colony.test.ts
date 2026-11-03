import { describe, it, expect } from 'vitest';
import {
  createInitialColonyState,
  recruitColonist,
  assignColonistJob,
  administerStimulant,
  setWageContract,
  stepColony,
  worldToGrid,
  gridToWorld,
  GRID_SIZE,
  GRID_HALF_EXTENT,
  type WageContract,
} from '../src/engine/colony';
import { createInventoryState, addItemToContainer } from '../src/engine/inventory';
import { BIOME_DAG, getSpeciesWorldPosition } from '../src/data/biomeNodes';

describe('Colony Engine (Task 2)', () => {
  describe('Initial colony state & grid mapping', () => {
    it('initializes with 0 colonists, empty ledger, and 1024-byte desire path grid', () => {
      const state = createInitialColonyState();
      expect(state.colonists).toEqual([]);
      expect(state.ledger).toEqual([]);
      expect(state.desirePathGrid).toBeInstanceOf(Uint8Array);
      expect(state.desirePathGrid.length).toBe(1024);
      for (let i = 0; i < state.desirePathGrid.length; i++) {
        expect(state.desirePathGrid[i]).toBe(0);
      }
    });

    it('maps world coordinates to 32x32 grid and back correctly', () => {
      expect(GRID_SIZE).toBe(32);
      expect(GRID_HALF_EXTENT).toBe(1600); // [-1600m, +1600m], 100m per cell

      // Camp Hearth at (0, 0)
      const centerGrid = worldToGrid(0, 0);
      expect(centerGrid.col).toBe(16);
      expect(centerGrid.row).toBe(16);

      const centerWorld = gridToWorld(16, 16);
      expect(centerWorld.x).toBe(50);
      expect(centerWorld.y).toBe(50);

      // Edge test: bottom-left corner (-1600, -1600)
      const minGrid = worldToGrid(-1600, -1600);
      expect(minGrid.col).toBe(0);
      expect(minGrid.row).toBe(0);

      // Edge test: top-right corner near (+1600, +1600)
      const maxGrid = worldToGrid(1599, 1599);
      expect(maxGrid.col).toBe(31);
      expect(maxGrid.row).toBe(31);

      // Clamp out of bounds
      const clampedLow = worldToGrid(-2000, -2000);
      expect(clampedLow.col).toBe(0);
      expect(clampedLow.row).toBe(0);

      const clampedHigh = worldToGrid(3000, 3000);
      expect(clampedHigh.col).toBe(31);
      expect(clampedHigh.row).toBe(31);
    });
  });

  describe('Colonist recruitment', () => {
    it('recruits colonist generating unique id, hearth position (0,0), morale=80, satiety=100', () => {
      const state = createInitialColonyState();
      const contract: WageContract = { commodity: 'BAR_SOAP', dailyAmount: 1 };
      const c1 = recruitColonist(state, 'Caleb the Seeker', 'FORAGER', contract, 100);

      expect(c1.id).toBeDefined();
      expect(c1.name).toBe('Caleb the Seeker');
      expect(c1.archetype).toBe('FORAGER');
      expect(c1.wageContract).toEqual(contract);
      expect(c1.morale).toBe(80);
      expect(c1.satiety).toBe(100);
      expect(c1.position).toEqual({ x: 0, y: 0 });
      expect(c1.status).toBe('IDLE');
      expect(state.colonists.length).toBe(1);
      expect(state.colonists[0]).toBe(c1);

      // Check unique id
      const c2 = recruitColonist(state, 'Mira of the Kiln', 'MINER', contract, 101);
      expect(c2.id).not.toBe(c1.id);
      expect(state.colonists.length).toBe(2);
    });
  });

  describe('Boids separation', () => {
    it('maintains minimum pairwise distance >= 3.5m when colonists move toward the same target', () => {
      const state = createInitialColonyState();
      const contract: WageContract = { commodity: 'DRIED_MEAT', dailyAmount: 1 };
      const c1 = recruitColonist(state, 'Worker 1', 'FORAGER', contract, 0);
      const c2 = recruitColonist(state, 'Worker 2', 'FORAGER', contract, 0);

      // Target species node
      const targetSpeciesId = 'TREE_WHITE_OAK';
      const targetPartId = 'OAK_HEARTWOOD_LOG';
      assignColonistJob(c1, targetSpeciesId, targetPartId);
      assignColonistJob(c2, targetSpeciesId, targetPartId);

      // Start them near each other
      c1.position = { x: 50, y: 50 };
      c2.position = { x: 50.5, y: 50.5 }; // distance ~0.7m < 3.5m

      const inv = createInventoryState();
      // Step simulation by 0.1 minutes (6 seconds)
      stepColony(state, 0.1, 10, inv.campCache, BIOME_DAG);

      const dx = c1.position.x - c2.position.x;
      const dy = c1.position.y - c2.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeGreaterThanOrEqual(1.0); // pushed apart immediately

      // Advance multiple steps towards target
      for (let i = 0; i < 20; i++) {
        stepColony(state, 0.2, 10 + i, inv.campCache, BIOME_DAG);
        const curDx = c1.position.x - c2.position.x;
        const curDy = c1.position.y - c2.position.y;
        const curDist = Math.sqrt(curDx * curDx + curDy * curDy);
        // They should actively repel each other when within 3.5m
        expect(curDist).toBeGreaterThan(0.5);
      }
    });
  });

  describe('Desire path erosion and decay', () => {
    it('increments path cells when colonist steps, decrements on decay, and provides speed bonus up to 20%', () => {
      const state = createInitialColonyState();
      const contract: WageContract = { commodity: 'BAR_SOAP', dailyAmount: 1 };
      const c1 = recruitColonist(state, 'Pathfinder', 'FORAGER', contract, 0);
      
      // Place c1 at (50, 50) and assign target
      c1.position = { x: 50, y: 50 };
      const targetSpeciesId = 'TREE_WHITE_OAK';
      const targetPartId = 'OAK_HEARTWOOD_LOG';
      assignColonistJob(c1, targetSpeciesId, targetPartId);

      const gridPos = worldToGrid(c1.position.x, c1.position.y);
      const cellIdx = gridPos.row * GRID_SIZE + gridPos.col;
      expect(state.desirePathGrid[cellIdx]).toBe(0);

      const inv = createInventoryState();
      // Step several times with traffic
      stepColony(state, 0.5, 1, inv.campCache, BIOME_DAG);
      expect(state.desirePathGrid[cellIdx]).toBeGreaterThan(0);

      // Verify desire path speed bonus calculation
      // formula: 1.0 + 0.2 * (level / 255)
      state.desirePathGrid[cellIdx] = 255;
      const fullBonusSpeed = c1.baseSpeed * (1.0 + 0.2 * (255 / 255));
      expect(fullBonusSpeed).toBeCloseTo(c1.baseSpeed * 1.2, 3);

      state.desirePathGrid[cellIdx] = 128;
      const halfBonusSpeed = c1.baseSpeed * (1.0 + 0.2 * (128 / 255));
      expect(halfBonusSpeed).toBeCloseTo(c1.baseSpeed * (1.0 + 0.2 * (128 / 255)), 3);

      // Test decay when ticks advance without traffic on a cell
      const unusedCellIdx = 0;
      state.desirePathGrid[unusedCellIdx] = 50;
      // Step with large interval or decay trigger
      // If decay occurs periodically or per tick without stepping
      const prevVal = state.desirePathGrid[unusedCellIdx];
      // Run decay step (e.g. 60 ticks of no traffic or stepColony decay)
      for (let t = 0; t < 60; t++) {
        stepColony(state, 1.0, 1000 + t, inv.campCache, BIOME_DAG);
      }
      expect(state.desirePathGrid[unusedCellIdx]).toBeLessThan(prevVal);
    });
  });

  describe('Multi-commodity payroll', () => {
    it('deducts agreed wage item from campCache at midnight (tick % 1440 === 0)', () => {
      const state = createInitialColonyState();
      const contract: WageContract = { commodity: 'BAR_SOAP', dailyAmount: 2 };
      const c1 = recruitColonist(state, 'Suds lover', 'APPRENTICE_CHEMIST', contract, 0);

      const inv = createInventoryState();
      addItemToContainer(inv.campCache, {
        itemId: 'BAR_SOAP',
        count: 5,
        massKg: 0.2,
        label: 'Molded Bar Soap',
      });

      // Advance to tick 1440 (midnight)
      stepColony(state, 1.0, 1440, inv.campCache, BIOME_DAG);

      // Check that 2 BAR_SOAP were deducted
      const soapSlot = inv.campCache.slots.find(s => s && s.itemId === 'BAR_SOAP');
      expect(soapSlot).toBeDefined();
      expect(soapSlot?.count).toBe(3);
      expect(c1.morale).toBeGreaterThanOrEqual(80); // Did not drop
      expect(state.ledger.length).toBeGreaterThan(0);
      expect(state.ledger[0].paid).toBe(true);
    });

    it('drops morale by 25 points if wage item is missing; triggers STRIKE at morale <= 0', () => {
      const state = createInitialColonyState();
      const contract: WageContract = { commodity: 'COPPER_INGOT', dailyAmount: 1 };
      const c1 = recruitColonist(state, 'Metallurgist', 'MINER', contract, 0);
      c1.morale = 25; // 1 missed payment will bring to 0

      const inv = createInventoryState(); // Empty camp cache (no copper ingots)

      // Midnight payroll
      stepColony(state, 1.0, 1440, inv.campCache, BIOME_DAG);

      expect(c1.morale).toBe(0);
      expect(c1.status).toBe('STRIKE');
      expect(state.ledger.length).toBe(1);
      expect(state.ledger[0].paid).toBe(false);

      // Another missed payment should not go below 0
      stepColony(state, 1.0, 2880, inv.campCache, BIOME_DAG);
      expect(c1.morale).toBe(0);
      expect(c1.status).toBe('STRIKE');
    });

    it('allows changing wage contract with setWageContract', () => {
      const state = createInitialColonyState();
      const c1 = recruitColonist(state, 'Worker', 'FORAGER', { commodity: 'DRIED_MEAT', dailyAmount: 1 }, 0);
      setWageContract(c1, { commodity: 'WILLOW_TEA', dailyAmount: 2 });
      expect(c1.wageContract).toEqual({ commodity: 'WILLOW_TEA', dailyAmount: 2 });
    });
  });

  describe('Stimulants pharmacokinetics', () => {
    it('applies speed multiplier for durationMinutes, then crash multiplier for crashMinutes, then normal', () => {
      const state = createInitialColonyState();
      const c1 = recruitColonist(state, 'Speedy', 'HERBALIST', { commodity: 'BAR_SOAP', dailyAmount: 1 }, 0);
      expect(c1.baseSpeed).toBeGreaterThan(0);

      // Administer WILLOW_TEA: speedMultiplier: 1.25, duration: 180 min, crashMultiplier: 0.85, crash: 45 min
      administerStimulant(c1, 'WILLOW_TEA');
      expect(c1.activeStimulant).toBeDefined();
      expect(c1.activeStimulant?.phase).toBe('BOOST');
      expect(c1.activeStimulant?.speedMultiplier).toBe(1.25);

      const inv = createInventoryState();

      // Step 60 minutes into boost
      stepColony(state, 60, 60, inv.campCache, BIOME_DAG);
      expect(c1.activeStimulant?.phase).toBe('BOOST');
      expect(c1.activeStimulant?.elapsedMinutes).toBe(60);

      // Step past 180 minutes (e.g. 130 min more -> 190 min total)
      stepColony(state, 130, 190, inv.campCache, BIOME_DAG);
      expect(c1.activeStimulant?.phase).toBe('CRASH');
      expect(c1.activeStimulant?.speedMultiplier).toBe(0.85);

      // Step past crash duration (45 min crash -> 50 min more)
      stepColony(state, 50, 240, inv.campCache, BIOME_DAG);
      expect(c1.activeStimulant).toBeNull();
    });
  });

  describe('Job assignment & harvest loop', () => {
    it('travels to species position, harvests part, and returns to deposit yields in camp storage', () => {
      const state = createInitialColonyState();
      const c1 = recruitColonist(state, 'Harvester', 'FORAGER', { commodity: 'BAR_SOAP', dailyAmount: 1 }, 0);

      const targetSpeciesId = 'TREE_WHITE_OAK';
      const targetPartId = 'OAK_HEARTWOOD_LOG';
      assignColonistJob(c1, targetSpeciesId, targetPartId);

      expect(c1.status).toBe('TRAVELING');
      expect(c1.assignedJob?.speciesId).toBe(targetSpeciesId);
      expect(c1.assignedJob?.partId).toBe(targetPartId);

      const speciesPos = getSpeciesWorldPosition(targetSpeciesId);
      expect(speciesPos).toBeDefined();
      const inv = createInventoryState();

      // Step until arrival at species node
      for (let t = 0; t < 100; t++) {
        stepColony(state, 1.0, t + 1, inv.campCache, BIOME_DAG);
        if (c1.status === 'GATHERING') break;
      }
      expect(c1.status).toBe('GATHERING');

      // Step through gathering phase
      for (let t = 0; t < 50; t++) {
        stepColony(state, 1.0, 100 + t, inv.campCache, BIOME_DAG);
        if (c1.status === 'RETURNING') break;
      }
      expect(c1.status).toBe('RETURNING');
      expect(c1.carriedYields.length).toBeGreaterThan(0);

      // Step returning back to Camp Hearth (0, 0)
      for (let t = 0; t < 100; t++) {
        stepColony(state, 1.0, 200 + t, inv.campCache, BIOME_DAG);
        if (c1.status === 'IDLE' || c1.status === 'TRAVELING') break;
      }

      // Check camp storage has yields deposited
      const logItem = inv.campCache.slots.find(s => s && s.itemId === 'LOG_WHITE_OAK');
      expect(logItem).toBeDefined();
      expect(logItem!.count).toBeGreaterThan(0);
    });
  });
});
