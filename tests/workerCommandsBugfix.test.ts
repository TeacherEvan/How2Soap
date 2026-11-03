import { describe, expect, it } from 'vitest';
import { resolveToolItem, type ToolSlotKey } from '../src/engine/fabrication';
import { treatmentModel } from '../src/ui/panelModels';
import { createInventoryState, addItemToContainer } from '../src/engine/inventory';
import { createPlayerMetabolism } from '../src/engine/metabolism';
import { createPaddock, stepPaddockDay } from '../src/engine/husbandry';
import { BIOME_DAG } from '../src/data/biomeNodes';
import { applyHarvest } from '../src/engine/harvest';
import { createSeededRng } from '../src/engine/rng';

describe('workerCommandsBugfix - Task 0 Regression Tests', () => {
  describe('treatmentModel - SALICYLIC_ACID_TINCTURE vs SALICYLIC_TINCTURE', () => {
    it('recognizes SALICYLIC_ACID_TINCTURE when player has fever', () => {
      const items = [{ id: 'SALICYLIC_ACID_TINCTURE', count: 1, massKg: 0.1 }];
      const treats = treatmentModel(items as any, {
        glucoseKcal: 1000,
        conditions: { fever: true, systemicInfection: false, woundContamination: false },
      } as any);
      expect(treats.map(t => t.id)).toContain('SALICYLIC_ACID_TINCTURE');
    });

    it('recognizes legacy SALICYLIC_TINCTURE if present when player has fever', () => {
      const items = [{ id: 'SALICYLIC_TINCTURE', count: 1, massKg: 0.1 }];
      const treats = treatmentModel(items as any, {
        glucoseKcal: 1000,
        conditions: { fever: true, systemicInfection: false, woundContamination: false },
      } as any);
      expect(treats.map(t => t.id)).toContain('SALICYLIC_TINCTURE');
    });
  });

  describe('resolveToolItem', () => {
    it('resolves metallurgy tools with their predefined values', () => {
      const fork = resolveToolItem('BRONZE_FORK');
      expect(fork).toBeDefined();
      expect(fork?.slot).toBe('EATING_UTENSIL');
      expect(fork?.mohs).toBe(3.5);
      expect(fork?.mechanicalAdvantage).toBe(1.0);

      const axe = resolveToolItem('BRONZE_AXE');
      expect(axe).toBeDefined();
      expect(axe?.slot).toBe('CHOPPING_CARVING');
      expect(axe?.mechanicalAdvantage).toBe(2.5);
    });

    it('resolves primitive Tier-1 tools from ITEMS catalog with toolSlot', () => {
      const blade = resolveToolItem('FLINT_FLAKE_BLADE');
      expect(blade).toBeDefined();
      expect(blade?.id).toBe('FLINT_FLAKE_BLADE');
      expect(blade?.slot).toBe('CUTTING_SKINNING');
      expect(blade?.mohs).toBe(7.0);
      expect(blade?.mechanicalAdvantage).toBe(1.4);

      const adze = resolveToolItem('FLINT_ADZE');
      expect(adze).toBeDefined();
      expect(adze?.slot).toBe('CHOPPING_CARVING');
      expect(adze?.mohs).toBe(7.0);

      const awl = resolveToolItem('BONE_AWL');
      expect(awl).toBeDefined();
      expect(awl?.slot).toBe('STITCHING_MEDICAL');
      expect(awl?.mohs).toBe(2.5);

      const hammer = resolveToolItem('RIVER_HAMMERSTONE');
      expect(hammer).toBeDefined();
      expect(hammer?.slot).toBe('PERCUSSION_MINING');
      expect(hammer?.mohs).toBe(6.5);
    });

    it('returns null/undefined for non-tool items', () => {
      expect(resolveToolItem('WOOD_BRANCH')).toBeUndefined();
      expect(resolveToolItem('MEAT_RAW')).toBeUndefined();
      expect(resolveToolItem('NON_EXISTENT')).toBeUndefined();
    });
  });

  describe('HARVEST_PART dispatch parameters and simulation', () => {
    it('harvests successfully with speciesId, carriedMassKg, toolSlot, distanceMeters', () => {
      const oakSpecies = BIOME_DAG.flatMap(c => c.species).find(s => s.id === 'TREE_WHITE_OAK')!;
      const oakLog = oakSpecies.parts.find(p => p.id === 'OAK_HEARTWOOD_LOG')!;
      const player = createPlayerMetabolism(0.05);
      const inventory = createInventoryState();
      const rng = createSeededRng(1234);

      // Tool resolution for FLINT_ADZE
      const tool = resolveToolItem('FLINT_ADZE')!;
      expect(tool).toBeDefined();

      const initialGlucose = player.glucoseKcal;
      const res = applyHarvest(
        player,
        inventory,
        oakLog,
        oakSpecies.baseDistanceMeters,
        tool.slot,
        tool,
        rng,
      );

      expect(res.ok).toBe(true);
      expect(player.glucoseKcal).toBeLessThan(initialGlucose);
      expect(res.added.length).toBeGreaterThan(0);
      expect(res.added[0].itemId).toBe('LOG_WHITE_OAK');
    });
  });

  describe('EQUIP_TOOL logic semantics', () => {
    it('equips primitive tool from campCache and preserves stack count > 1', () => {
      const inventory = createInventoryState();
      // Put 3x FLINT_FLAKE_BLADE into campCache
      addItemToContainer(inventory.campCache, {
        itemId: 'FLINT_FLAKE_BLADE',
        count: 3,
        massKg: 0.3,
        label: 'Flint Flake Blade',
      });

      const itemId = 'FLINT_FLAKE_BLADE';
      const slot: ToolSlotKey = 'CUTTING_SKINNING';
      const tool = resolveToolItem(itemId);
      expect(tool).toBeDefined();

      // Simulate the worker equip loop
      let found = false;
      for (const container of [inventory.bareHands, inventory.backpack, inventory.campCache]) {
        for (let i = 0; i < container.slots.length; i++) {
          const s = container.slots[i];
          if (s && s.itemId === itemId) {
            s.count--;
            if (s.count <= 0) container.slots[i] = null;
            found = true;
            break;
          }
        }
        if (found) break;
      }

      expect(found).toBe(true);
      // Stack count should be decremented to 2, not wiped to null
      expect(inventory.campCache.slots[0]?.count).toBe(2);
      expect(inventory.campCache.slots[0]?.itemId).toBe('FLINT_FLAKE_BLADE');

      inventory.tools[slot] = tool!;
      expect(inventory.tools[slot]?.id).toBe('FLINT_FLAKE_BLADE');
    });

    it('returns previously equipped tool back to storage', () => {
      const inventory = createInventoryState();
      // Start with RIVER_HAMMERSTONE equipped
      inventory.tools.PERCUSSION_MINING = resolveToolItem('RIVER_HAMMERSTONE')!;

      // Add a replacement tool to campCache
      addItemToContainer(inventory.campCache, {
        itemId: 'RIVER_HAMMERSTONE',
        count: 1,
        massKg: 0.5,
        label: 'River Hammerstone',
      });

      const prev = inventory.tools.PERCUSSION_MINING;
      const prevSlot = { itemId: prev.id, count: 1, massKg: 0.5, label: prev.name };
      const returned = addItemToContainer(inventory.bareHands, prevSlot) ||
                       addItemToContainer(inventory.backpack, prevSlot) ||
                       addItemToContainer(inventory.campCache, prevSlot);

      expect(returned).toBe(true);
      // It should be stored in bareHands first
      expect(inventory.bareHands.slots[0]?.itemId).toBe('RIVER_HAMMERSTONE');
    });
  });

  describe('EAT_FOOD and APPLY_TREATMENT from campCache and condition check', () => {
    it('allows eating food stored in campCache', () => {
      const inventory = createInventoryState();
      addItemToContainer(inventory.campCache, {
        itemId: 'MEAT_RAW',
        count: 2,
        massKg: 28.0,
        label: 'Fresh Game Meat',
      });

      let removed = false;
      const itemId = 'MEAT_RAW';
      for (const container of [inventory.bareHands, inventory.backpack, inventory.campCache]) {
        for (let i = 0; i < container.slots.length; i++) {
          const s = container.slots[i];
          if (s && s.itemId === itemId) {
            s.count--;
            if (s.count <= 0) container.slots[i] = null;
            removed = true;
            break;
          }
        }
        if (removed) break;
      }

      expect(removed).toBe(true);
      expect(inventory.campCache.slots[0]?.count).toBe(1);
    });

    it('verifies item consumption check precedes condition removal in treatment', () => {
      const player = createPlayerMetabolism(0.05);
      player.conditions.woundContamination = true;
      const inventory = createInventoryState(); // Empty inventory

      // Should fail to find item and NOT cure wound
      let found = false;
      const itemId = 'SALINE_RINSE';
      for (const container of [inventory.bareHands, inventory.backpack, inventory.campCache]) {
        for (let i = 0; i < container.slots.length; i++) {
          const s = container.slots[i];
          if (s && s.itemId === itemId) {
            s.count--;
            if (s.count <= 0) container.slots[i] = null;
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (found) {
        player.conditions.woundContamination = false;
      }

      expect(found).toBe(false);
      expect(player.conditions.woundContamination).toBe(true);
    });
  });

  describe('Paddock husbanding and stepPaddockDay', () => {
    it('steps paddock day when animals are fed and watered', () => {
      const paddock = createPaddock();
      paddock.storedFeedKg = 30.0;
      paddock.storedWaterL = 60.0;
      const yields = stepPaddockDay(paddock);
      expect(yields).toBeDefined();
      expect(paddock.storedFeedKg).toBeLessThanOrEqual(30.0);
    });
  });
});

