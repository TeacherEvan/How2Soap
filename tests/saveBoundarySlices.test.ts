import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAB_BYTE_LENGTH } from '../src/engine/memoryLayout';
import type { SerializedWorldSave } from '../src/engine/persistence';

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

function baseSave(overrides: Record<string, unknown>): SerializedWorldSave {
  return {
    version: 3,
    timestamp: 0,
    tick: 0,
    day: 1,
    ambientTempK: 288.15,
    rngSeed: 1,
    player: {
      glucoseKcal: 1200,
      adiposeKcal: 15000,
      hydrationPct: 100,
      coreTempK: 310.15,
      clothingIclo: 0.05,
    },
    inventory: {},
    vessels: [],
    ever: {},
    renown: 0,
    affinity: { apothecary: 0, soapwright: 0, forgewright: 0 },
    chapter: 0,
    fabricatedRecipes: [],
    objectivesDone: [],
    lettersDone: [],
    epilogueSeen: false,
    ...overrides,
  } as unknown as SerializedWorldSave;
}

describe('save boundary — persisted campaign slices are sanitized', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    ['experiments', { experiments: { experiments: 5 } }, 'EXPERIMENTS_SYNC'],
    ['realm', { realm: { countryId: 'x', health: 50 } }, 'REALM_SYNC'],
    ['settlements', { settlements: { settlementLimit: 3 } }, 'SETTLEMENTS_SYNC'],
    ['settlements (nested)', { settlements: { settlements: [{}], settlementLimit: 3 } }, 'SETTLEMENTS_SYNC'],
    ['blacksmith', { blacksmith: { jobs: 'nope' } }, 'BLACKSMITH_SYNC'],
    ['paddock', { paddock: { animals: 'nope' } }, 'PLAYER_SYNC'],
  ])('falls back for a malformed %s payload and still advances a day', async (
    _label,
    overrides,
    syncType,
  ) => {
    const { posted, send } = await bootWorker();
    send({
      type: 'LOAD_WORLD',
      sab: new SharedArrayBuffer(SAB_BYTE_LENGTH),
      save: baseSave(overrides),
    });

    expect(posted.some((m) => m.type === 'LOAD_ERROR')).toBe(false);
    expect(posted.filter((m) => m.type === syncType).at(-1)).toBeDefined();

    posted.length = 0;
    send({ type: 'ADVANCE', hours: 24 });

    const errors = posted.filter((m) => m.type === 'SIM_ERROR');
    expect(errors.map((m) => m.message)).toEqual([]);
    expect(posted.some((m) => m.type === 'SIM_FATAL')).toBe(false);
  });
});
