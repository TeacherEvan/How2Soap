import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MAX_VESSELS } from '../src/engine/memoryLayout';
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

    // Must not throw even when index exceeds MAX_VESSELS
    expect(() => renderReactionsSummary(snapshot)).not.toThrow();
  });
});
