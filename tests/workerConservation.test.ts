import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAB_BYTE_LENGTH } from '../src/engine/memoryLayout';

interface FakeWorker {
  posted: Array<Record<string, any>>;
  send: (data: unknown) => void;
  fakeSelf: { postMessage: (msg: unknown) => void; onmessage: ((event: { data: unknown }) => void) | null };
}

async function bootWorker(): Promise<FakeWorker> {
  const posted: Array<Record<string, any>> = [];
  const fakeSelf = {
    postMessage: (msg: unknown) => posted.push(msg as Record<string, any>),
    onmessage: null as null | ((event: { data: unknown }) => void),
  };
  vi.stubGlobal('self', fakeSelf);
  vi.resetModules();
  await import('../src/engine/sim.worker');
  return {
    posted,
    fakeSelf,
    send: (data: unknown) => fakeSelf.onmessage!({ data }),
  };
}

describe('Item Conservation & Atomic Transactions (MVTH-3 / P1-5)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('CHARGE_ITEM: non-reagent item present in inventory is rejected without consuming it', async () => {
    const { posted, send } = await bootWorker();
    send({
      type: 'LOAD_WORLD',
      sab: new SharedArrayBuffer(SAB_BYTE_LENGTH),
      save: {
        version: 3,
        vessels: [{ id: 1, material: 'WOOD', capacityL: 5, moles: new Array(30).fill(0) }],
        inventory: {
          bareHands: {
            id: 'CONTAINER_BARE_HANDS',
            unlocked: true,
            maxSlots: 2,
            maxMassKg: 12,
            slots: [{ itemId: 'WOOD_BRANCH', count: 5, massKg: 0.5, label: 'Wood Branch' }, null],
          },
          backpack: { id: 'CONTAINER_BACKPACK', unlocked: false, maxSlots: 24, maxMassKg: 40, slots: [] },
          campCache: { id: 'CONTAINER_CAMP_CACHE', unlocked: true, maxSlots: 6, maxMassKg: 150, slots: new Array(6).fill(null) },
          tools: {},
        },
      },
    });

    posted.length = 0;
    // Attempt to charge non-reagent WOOD_BRANCH
    send({ type: 'CHARGE_ITEM', vesselId: 1, itemId: 'WOOD_BRANCH', count: 1 });

    const events = posted.filter((m) => m.type === 'EVENTS').flatMap((m) => m.events ?? []);
    expect(events.some((e) => e.message.includes('cannot be charged'))).toBe(true);

    // Verify inventory was NOT decremented and charged was not posted
    expect(events.some((e) => e.message.startsWith('Charged'))).toBe(false);
  });

  it('FABRICATE: rejects and preserves ingredients when inventory & camp cache are full', async () => {
    const { posted, send } = await bootWorker();
    // Fill bareHands and campCache completely, backpack locked
    send({
      type: 'LOAD_WORLD',
      sab: new SharedArrayBuffer(SAB_BYTE_LENGTH),
      save: {
        version: 3,
        vessels: [],
        player: { glucoseKcal: 500 },
        inventory: {
          tools: {
            PERCUSSION_MINING: {
              id: 'RIVER_HAMMERSTONE',
              name: 'River Hammerstone',
              slot: 'PERCUSSION_MINING',
              durability: 100,
              maxDurability: 100,
              mohs: 6.5,
              mechanicalAdvantage: 1.5,
            },
          },
          bareHands: {
            id: 'CONTAINER_BARE_HANDS',
            unlocked: true,
            maxSlots: 2,
            maxMassKg: 12,
            // Ingredients for RECIPE_KNAP_FLINT: 1x FLINT_NODULE
            slots: [
              { itemId: 'FLINT_NODULE', count: 1, massKg: 0.5, label: 'Flint Nodule' },
              { itemId: 'DUMMY_HAND', count: 1, massKg: 1, label: 'Dummy' },
            ],
          },
          backpack: { id: 'CONTAINER_BACKPACK', unlocked: false, maxSlots: 24, maxMassKg: 40, slots: [] },
          // Fill all 6 campCache slots so no room for the 2 outputs
          campCache: {
            id: 'CONTAINER_CAMP_CACHE',
            unlocked: true,
            maxSlots: 6,
            maxMassKg: 150,
            slots: [
              { itemId: 'DUMMY_1', count: 1, massKg: 1, label: 'D1' },
              { itemId: 'DUMMY_2', count: 1, massKg: 1, label: 'D2' },
              { itemId: 'DUMMY_3', count: 1, massKg: 1, label: 'D3' },
              { itemId: 'DUMMY_4', count: 1, massKg: 1, label: 'D4' },
              { itemId: 'DUMMY_5', count: 1, massKg: 1, label: 'D5' },
              { itemId: 'DUMMY_6', count: 1, massKg: 1, label: 'D6' },
            ],
          },
        },
      },
    });

    posted.length = 0;
    // RECIPE_KNAP_FLINT produces FLINT_FLAKE_BLADE and FLINT_ADZE_HEAD
    send({ type: 'FABRICATE', recipeId: 'RECIPE_KNAP_FLINT' });

    const events = posted.filter((m) => m.type === 'EVENTS').flatMap((m) => m.events ?? []);
    expect(events.some((e) => e.message.includes('inventory and camp storage full'))).toBe(true);
    expect(events.some((e) => e.message.startsWith('Fabricated'))).toBe(false);
  });

  it('EQUIP_TOOL: tool swap preserves both tools and refuses if no room to store previous tool', async () => {
    const { posted, send } = await bootWorker();
    // Fill all containers, equip Tool A, have Tool B in a slot
    send({
      type: 'LOAD_WORLD',
      sab: new SharedArrayBuffer(SAB_BYTE_LENGTH),
      save: {
        version: 3,
        vessels: [],
        inventory: {
          tools: {
            CUTTING_SKINNING: {
              id: 'FLINT_FLAKE_BLADE',
              name: 'Flint Flake Blade',
              slot: 'CUTTING_SKINNING',
              durability: 50,
              maxDurability: 50,
              mohs: 6.5,
              mechanicalAdvantage: 1.2,
            },
          },
          bareHands: {
            id: 'CONTAINER_BARE_HANDS',
            unlocked: true,
            maxSlots: 2,
            maxMassKg: 12,
            // 1 slot has BRONZE_SPEAR (tool), other slot filled with dummy
            slots: [
              { itemId: 'BRONZE_SPEAR', count: 1, massKg: 1.5, label: 'Bronze Spear' },
              { itemId: 'DUMMY_HAND', count: 1, massKg: 1, label: 'Dummy' },
            ],
          },
          backpack: { id: 'CONTAINER_BACKPACK', unlocked: false, maxSlots: 24, maxMassKg: 40, slots: [] },
          // Fill all 6 campCache slots completely
          campCache: {
            id: 'CONTAINER_CAMP_CACHE',
            unlocked: true,
            maxSlots: 6,
            maxMassKg: 150,
            slots: [
              { itemId: 'D1', count: 1, massKg: 1, label: 'D1' },
              { itemId: 'D2', count: 1, massKg: 1, label: 'D2' },
              { itemId: 'D3', count: 1, massKg: 1, label: 'D3' },
              { itemId: 'D4', count: 1, massKg: 1, label: 'D4' },
              { itemId: 'D5', count: 1, massKg: 1, label: 'D5' },
              { itemId: 'D6', count: 1, massKg: 1, label: 'D6' },
            ],
          },
        },
      },
    });

    posted.length = 0;
    // Swap tool: equipping BRONZE_SPEAR frees its slot in bareHands, which CAN fit the previous FLINT_FLAKE_BLADE!
    send({ type: 'EQUIP_TOOL', slot: 'CUTTING_SKINNING', itemId: 'BRONZE_SPEAR' });

    // This should succeed because BRONZE_SPEAR vacated a slot
    const events = posted.filter((m) => m.type === 'EVENTS').flatMap((m) => m.events ?? []);
    expect(events.some((e) => e.message.includes('Cannot swap tool'))).toBe(false);
  });
});
