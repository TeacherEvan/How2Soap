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

describe('Advance Message Budget (MVTH-5 / P1-2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('ADVANCE 192 hours suppresses intermediate tick syncs and emits at most 2 REQUEST_SYNC messages', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });

    // Clear initial messages
    posted.length = 0;

    // Advance 192 hours ("March x8" = 192 h * 10 Hz = 1920 steps)
    send({ type: 'ADVANCE', hours: 192 });

    const requestSyncs = posted.filter((m) => m.type === 'REQUEST_SYNC');
    const crisisSyncs = posted.filter((m) => m.type === 'CRISIS_SYNC');
    const recaps = posted.filter((m) => m.type === 'TURN_RECAP');

    // Without batch coalescing, this emitted 1920 REQUEST_SYNC messages!
    expect(requestSyncs.length).toBeLessThanOrEqual(2);
    expect(crisisSyncs.length).toBeLessThanOrEqual(2);
    expect(recaps.length).toBe(1);
  });
});
