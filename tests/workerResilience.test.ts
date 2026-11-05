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

describe('Worker Resilience & Error Boundary (MVTH-4 / P1-4)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('catches exceptions during command execution and posts SIM_ERROR while keeping the worker alive', async () => {
    const { posted, send } = await bootWorker();

    // Send malformed INIT or LOAD_WORLD payload that causes an exception
    send({
      type: 'INIT',
      sab: new SharedArrayBuffer(16), // Invalid size, throws 'Bad SAB size'
    });

    const simErrors = posted.filter((m) => m.type === 'SIM_ERROR');
    expect(simErrors.length).toBeGreaterThanOrEqual(1);
    expect(simErrors[0].command).toBe('INIT');
    expect(simErrors[0].message).toContain('Bad SAB size');

    // Worker remains responsive to a subsequent valid INIT
    posted.length = 0;
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    expect(posted.some((m) => m.type === 'READY')).toBe(true);
  });
});
