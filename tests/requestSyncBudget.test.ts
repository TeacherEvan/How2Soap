import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAB_BYTE_LENGTH } from '../src/engine/memoryLayout';
import { WALL_TICK_MS } from '../src/engine/time';

interface FakeWorker {
  posted: Array<Record<string, any>>;
  send: (data: unknown) => void;
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
  return { posted, send: (data: unknown) => fakeSelf.onmessage!({ data }) };
}

const requestSyncs = (posted: Array<Record<string, any>>) =>
  posted.filter((m) => m.type === 'REQUEST_SYNC');

describe('request sync — unchanged payloads are not re-posted every tick', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('posts once on INIT and stays quiet while the slot set is unchanged', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });

    // The first tick publishes the initial slot set once.
    vi.advanceTimersByTime(WALL_TICK_MS);
    expect(requestSyncs(posted)).toHaveLength(1);

    posted.length = 0;
    vi.advanceTimersByTime(WALL_TICK_MS * 3);

    expect(requestSyncs(posted)).toHaveLength(0);
  });

  it('re-posts when the slot payload actually changes', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    vi.advanceTimersByTime(WALL_TICK_MS);
    const initialPayload = JSON.stringify(requestSyncs(posted)[0]?.slots);
    posted.length = 0;

    // The first town request spawns at tick 5; the payload must be re-posted.
    vi.advanceTimersByTime(WALL_TICK_MS * 5);

    const requests = requestSyncs(posted);
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0].slots)).not.toBe(initialPayload);
  });
});
