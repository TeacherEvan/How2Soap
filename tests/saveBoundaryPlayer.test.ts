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

function saveWithPlayer(player: Record<string, unknown>): SerializedWorldSave {
  return {
    version: 3,
    timestamp: 0,
    tick: 0,
    day: 1,
    ambientTempK: 288.15,
    rngSeed: 1,
    player,
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
  } as unknown as SerializedWorldSave;
}

const lastPlayer = (posted: Array<Record<string, any>>) =>
  posted.filter((m) => m.type === 'PLAYER_SYNC').at(-1)?.player;

describe('save boundary — the player record is sanitized', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    ['string glucose', { glucoseKcal: 'abc' }],
    ['NaN adipose', { adiposeKcal: Number.NaN }],
    ['negative hydration', { hydrationPct: -40 }],
    ['infinite core temperature', { coreTempK: Number.POSITIVE_INFINITY }],
    ['string clothing', { clothingIclo: 'thin' }],
  ])('repairs %s and keeps metabolism finite for a day', async (_label, overrides) => {
    const { posted, send } = await bootWorker();
    send({
      type: 'LOAD_WORLD',
      sab: new SharedArrayBuffer(SAB_BYTE_LENGTH),
      save: saveWithPlayer({
        glucoseKcal: 1200,
        adiposeKcal: 15000,
        hydrationPct: 100,
        coreTempK: 310.15,
        clothingIclo: 0.05,
        ...overrides,
      }),
    });

    expect(posted.some((m) => m.type === 'LOAD_ERROR')).toBe(false);
    const loaded = lastPlayer(posted);
    expect(loaded.glucoseKcal).toBeGreaterThanOrEqual(0);
    expect(loaded.glucoseKcal).toBeLessThanOrEqual(2000);
    expect(loaded.adiposeKcal).toBeGreaterThanOrEqual(0);
    expect(loaded.adiposeKcal).toBeLessThanOrEqual(60000);
    expect(loaded.hydrationPct).toBeGreaterThanOrEqual(0);
    expect(loaded.hydrationPct).toBeLessThanOrEqual(100);
    const loadedCoreC = parseFloat(loaded.coreTempC);
    expect(Number.isFinite(loadedCoreC)).toBe(true);
    expect(loadedCoreC).toBeGreaterThan(-50);
    expect(loadedCoreC).toBeLessThan(60);
    expect(loaded.clothingIclo).toBeGreaterThanOrEqual(0);
    expect(loaded.clothingIclo).toBeLessThanOrEqual(4);

    send({ type: 'ADVANCE', hours: 24 });
    const after = lastPlayer(posted);
    expect(Number.isFinite(after.glucoseKcal)).toBe(true);
    // The corruption discriminator: a NaN fat pool never recovers, so eating
    // can never restore adipose tissue again.
    expect(Number.isFinite(after.adiposeKcal)).toBe(true);
    expect(after.adiposeKcal).toBeGreaterThan(0);
    const coreC = parseFloat(after.coreTempC);
    expect(Number.isFinite(coreC)).toBe(true);
    expect(coreC).toBeGreaterThan(15);
    expect(coreC).toBeLessThan(45);
  });
});
