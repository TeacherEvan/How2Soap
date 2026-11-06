import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('colony sync merge — an omitted grid keeps the last copy', () => {
  beforeEach(() => {
    const el = () => ({
      innerHTML: '',
      textContent: '',
      appendChild: vi.fn(),
      addEventListener: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn(() => false) },
      style: {},
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      prepend: vi.fn(),
    });
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => el()),
      querySelector: vi.fn(() => el()),
      querySelectorAll: vi.fn(() => []),
      createElement: vi.fn(() => el()),
    });
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });

  afterEach(async () => {
    const { flushFrameRenderForTests } = await import('../src/app/syncScheduler');
    flushFrameRenderForTests();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('preserves the previous 1,024-cell grid when the worker omits it', async () => {
    const { handleWorkerMessage } = await import('../src/app/workerMessages');
    const { state } = await import('../src/app/state');

    state.colony = null;
    const firstGrid = new Uint8Array(1024);
    firstGrid[17] = 200;

    handleWorkerMessage({
      type: 'COLONY_SYNC',
      colony: { colonists: [], ledger: [], desirePathGrid: firstGrid, nextColonistId: 1 },
    } as any);
    expect((state.colony as any)?.desirePathGrid).toBe(firstGrid);

    handleWorkerMessage({
      type: 'COLONY_SYNC',
      colony: { colonists: [], ledger: [], nextColonistId: 1 },
    } as any);

    expect((state.colony as any)?.desirePathGrid).toBe(firstGrid);
  });
});
