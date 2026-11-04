/**
 * Spine coverage for src/engine/sim.worker.ts: command dispatch against a
 * stubbed worker context. Verifies READY handshake, command effects on the
 * world, and that unknown/unhandled commands surface as EVENTS (never silent).
 */
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

function eventMessages(posted: Array<Record<string, any>>): string[] {
  return posted
    .filter((m) => m.type === 'EVENTS')
    .flatMap((m) => m.events ?? [])
    .map((e: { message: string }) => e.message);
}

describe('sim.worker.ts command dispatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('INIT posts READY + PLAYER_SYNC + COLONY_SYNC', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    expect(posted.some((m) => m.type === 'READY')).toBe(true);
    expect(posted.some((m) => m.type === 'PLAYER_SYNC')).toBe(true);
    expect(posted.some((m) => m.type === 'COLONY_SYNC')).toBe(true);
  });

  it('INIT with a corrupt SharedArrayBuffer throws instead of corrupting state', async () => {
    const { send } = await bootWorker();
    expect(() => send({ type: 'INIT', sab: new SharedArrayBuffer(16) })).toThrow(/Bad SAB size/);
  });

  it('CREATE_VESSEL then CHARGE_ITEM reports missing inventory item honestly', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    send({ type: 'CREATE_VESSEL', id: 1, material: 'WOOD', capacityL: 5, label: 'Test Bucket' });
    const vesselsMsg = posted.find((m) => m.type === 'VESSELS');
    expect(vesselsMsg?.vessels?.some((v: { label: string }) => v.label === 'Test Bucket')).toBe(true);

    send({ type: 'CHARGE_ITEM', vesselId: 1, itemId: 'CHARCOAL', count: 1 });
    expect(eventMessages(posted).some((m) => m.includes('No CHARCOAL in inventory'))).toBe(true);
  });

  it('ADVANCE runs the full tick pipeline without throwing', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    send({ type: 'CREATE_VESSEL', id: 1, material: 'WOOD', capacityL: 5 });
    expect(() => send({ type: 'ADVANCE', hours: 1 })).not.toThrow();
    // PLAYER_SYNC posted once at INIT, again after ADVANCE
    expect(posted.filter((m) => m.type === 'PLAYER_SYNC').length).toBeGreaterThanOrEqual(2);
  });

  it('FABRICATE with unknown recipe surfaces an EVENTS error', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    send({ type: 'FABRICATE', recipeId: 'NOT_A_RECIPE' });
    expect(eventMessages(posted).some((m) => m.includes('Unknown recipe'))).toBe(true);
  });

  it('EQUIP_TOOL with bogus tool id is rejected honestly', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    send({ type: 'EQUIP_TOOL', slot: 'CHOPPING_CARVING', itemId: 'NOT_A_TOOL' });
    expect(eventMessages(posted).some((m) => m.includes('Unknown tool'))).toBe(true);
  });

  it('EQUIP_TOOL for a tool not in inventory is rejected honestly', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    send({ type: 'EQUIP_TOOL', slot: 'CHOPPING_CARVING', itemId: 'BRONZE_AXE' });
    expect(eventMessages(posted).some((m) => m.includes('not in inventory'))).toBe(true);
  });

  it('HARVEST_PART with unknown species surfaces an EVENTS error', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    send({
      type: 'HARVEST_PART',
      partId: 'NOT_A_PART',
      speciesId: 'NOT_A_SPECIES',
      carriedMassKg: 1,
      toolSlot: 'PERCUSSION_MINING',
      distanceMeters: 100,
    });
    expect(eventMessages(posted).some((m) => m.includes('Unknown part'))).toBe(true);
  });

  it('APPLY_TREATMENT does not consume medicine the player does not need', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    send({ type: 'APPLY_TREATMENT', itemId: 'SALICYLIC_ACID_TINCTURE' });
    expect(eventMessages(posted).some((m) => m.includes('No active condition'))).toBe(true);
  });

  it('EAT_FOOD with an unknown item is rejected honestly', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    send({ type: 'EAT_FOOD', itemId: 'NOT_A_FOOD' });
    expect(eventMessages(posted).some((m) => m.includes('Not edible'))).toBe(true);
  });

  it('an unknown command type is surfaced as EVENTS, never silently swallowed', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    send({ type: 'DEFINITELY_NOT_A_COMMAND' });
    expect(eventMessages(posted).some((m) => m.includes('Unknown simulation command'))).toBe(true);
  });
});
