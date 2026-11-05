import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestAutoSave, AUTO_SAVE_KEY } from '../src/app/autosave';
import { state } from '../src/app/state';

describe('Autosave Scheduler (MVTH-1 / P0-1)', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    vi.useFakeTimers();
    store = {};
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      length: 0,
      key: () => null,
    };
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', {
      clearTimeout: (id: number) => clearTimeout(id),
      setTimeout: (fn: Function, ms: number) => setTimeout(fn, ms),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('guarantees saves occur under continuous 10 Hz PLAYER_SYNC input instead of starving', () => {
    // Simulate 10 s of continuous 10 Hz PLAYER_SYNC (100 ms interval = 100 ticks)
    for (let tick = 1; tick <= 100; tick++) {
      if (!state.snapshot) {
        state.snapshot = {
          tick,
          telemetry: new Float64Array(32 * 8),
          moles: new Float64Array(32 * 256),
        };
      } else {
        state.snapshot.tick = tick;
      }
      state.player.glucoseKcal = 1200 - tick * 0.1;

      requestAutoSave();
      vi.advanceTimersByTime(100);
    }

    const setItemMock = localStorage.setItem as unknown as ReturnType<typeof vi.fn>;
    const calls = setItemMock.mock.calls.filter((c) => c[0] === AUTO_SAVE_KEY);

    // In the buggy implementation, clearTimeout is called every 100 ms, so timer NEVER fires!
    // calls.length is 0!
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(calls.length).toBeLessThanOrEqual(6);
  });
});
