import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MAX_VESSELS, SAB_BYTE_LENGTH } from '../src/engine/memoryLayout';
import { state, type Snapshot } from '../src/app/state';

describe('Vessel Capacity Cap (MVTH-6 / P1-8)', () => {
  beforeEach(() => {
    const el = () => ({
      textContent: '',
      addEventListener: vi.fn(),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      append: vi.fn(),
      replaceChildren: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() },
    });
    const mockDoc = {
      getElementById: vi.fn(() => el()),
      querySelector: vi.fn(() => el()),
      querySelectorAll: vi.fn(() => []),
      createElement: vi.fn(() => el()),
    };
    vi.stubGlobal('document', mockDoc);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('safely handles attempts to render reactions summary for vessel indices >= MAX_VESSELS without throwing', async () => {
    const { renderReactionsSummary } = await import('../src/app/views');

    state.vessels = [];
    for (let i = 0; i < 35; i++) {
      state.vessels.push({
        id: i + 1,
        material: 'WOOD',
        capacityL: 5,
        closed: false,
        label: `Bucket ${i + 1}`,
      });
    }

    state.selected = 33; // 34th vessel (index 33 >= MAX_VESSELS 32)
    const snapshot: Snapshot = {
      tick: 1,
      telemetry: new Float64Array(MAX_VESSELS * 8),
      moles: new Float64Array(MAX_VESSELS * 256),
    };

    expect(() => {
      renderReactionsSummary(snapshot);
    }).not.toThrow();
  });

  it('worker rejects creating a 33rd vessel when MAX_VESSELS (32) is reached', async () => {
    const posted: Array<Record<string, any>> = [];
    const fakeSelf = {
      postMessage: (msg: unknown) => posted.push(msg as Record<string, any>),
      onmessage: null as null | ((event: { data: unknown }) => void),
    };
    vi.stubGlobal('self', fakeSelf);
    vi.resetModules();
    await import('../src/engine/sim.worker');
    const send = (data: unknown) => fakeSelf.onmessage!({ data });

    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });

    // Seed up to MAX_VESSELS (32)
    for (let i = 1; i <= MAX_VESSELS; i++) {
      send({ type: 'CREATE_VESSEL', id: i, material: 'WOOD', capacityL: 5 });
    }

    posted.length = 0;
    // Attempt to create the 33rd vessel
    send({ type: 'CREATE_VESSEL', id: 33, material: 'WOOD', capacityL: 5 });

    const events = posted.filter((m) => m.type === 'EVENTS').flatMap((m) => m.events ?? []);
    expect(events.some((e) => e.message.includes(`maximum limit of ${MAX_VESSELS} reached`))).toBe(true);
  });
});
