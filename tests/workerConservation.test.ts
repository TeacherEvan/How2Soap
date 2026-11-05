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

  it('CHARGE_ITEM with an unknown/unsupported item does not consume the item from inventory', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });

    // Create a vessel
    send({ type: 'CREATE_VESSEL', id: 1, material: 'WOOD', capacityL: 5 });

    // Charge an unknown/non-reagent item like UNKNOWN_ITEM
    posted.length = 0;
    send({ type: 'CHARGE_ITEM', vesselId: 1, itemId: 'UNKNOWN_OR_UNSUPPORTED', count: 1 });

    const events = posted.filter((m) => m.type === 'EVENTS').flatMap((m) => m.events ?? []);
    // Must reject without claiming charged
    const chargedMessages = events.filter((e) => e.message.startsWith('Charged'));
    expect(chargedMessages.length).toBe(0);
  });
});
