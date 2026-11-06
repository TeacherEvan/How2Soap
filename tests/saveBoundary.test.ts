import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAB_BYTE_LENGTH } from '../src/engine/memoryLayout';
import { restoreColonyFromSave } from '../src/engine/worldRestore';
import { createInventoryState } from '../src/engine/inventory';
import { stepColony } from '../src/engine/colony';
import { BIOME_DAG } from '../src/data/biomeNodes';
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

function saveWithColonists(colonists: unknown[]): SerializedWorldSave {
  return {
    version: 3,
    timestamp: 0,
    tick: 240,
    day: 2,
    ambientTempK: 288.15,
    rngSeed: 1,
    player: {},
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
    colony: {
      colonists: colonists as any,
      ledger: [],
      desirePathGrid: [],
      nextColonistId: 2,
    },
  } as unknown as SerializedWorldSave;
}

describe('save boundary — colonist records are repaired or dropped', () => {
  it.each([
    ['missing wageContract', { id: 'c1', name: 'No Contract' }],
    ['null wageContract', { id: 'c2', name: 'Null Contract', wageContract: null }],
    [
      'NaN position',
      {
        id: 'c3',
        name: 'NaN Position',
        wageContract: { commodity: 'BAR_SOAP', dailyAmount: 1 },
        position: { x: Number.NaN, y: 0 },
      },
    ],
    [
      'unknown archetype and status',
      {
        id: 'c4',
        name: 'Bad Enum',
        archetype: 'WIZARD',
        status: 'FLYING',
        wageContract: { commodity: 'BAR_SOAP', dailyAmount: 1 },
      },
    ],
  ])('repairs %s and survives midnight payroll', (_label, raw) => {
    const colony = restoreColonyFromSave(saveWithColonists([raw]));
    expect(colony.colonists).toHaveLength(1);

    const inventory = createInventoryState();
    expect(() => stepColony(colony, 6, 240, inventory.campCache, BIOME_DAG)).not.toThrow();

    const colonist = colony.colonists[0];
    expect(Number.isFinite(colonist.position.x)).toBe(true);
    expect(Number.isFinite(colonist.position.y)).toBe(true);
    expect(colonist.wageContract.dailyAmount).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(colonist.morale)).toBe(true);
    expect(Number.isFinite(colonist.baseSpeed)).toBe(true);
  });

  it('drops records that cannot be identified at all', () => {
    const colony = restoreColonyFromSave(
      saveWithColonists([{}, { id: 'no-name' }, null, 'not-an-object', 42]),
    );
    expect(colony.colonists).toHaveLength(0);
  });
});

describe('save boundary — a rejected LOAD_WORLD is reported, not silent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('posts LOAD_ERROR and does not pretend the world is ready', async () => {
    const { posted, send } = await bootWorker();

    send({
      type: 'LOAD_WORLD',
      sab: new SharedArrayBuffer(SAB_BYTE_LENGTH),
      save: { version: 3, vessels: [{ id: 'not-a-number', material: 'WOOD' }] },
    });

    expect(posted.filter((m) => m.type === 'LOAD_ERROR')).toHaveLength(1);
    expect(posted.some((m) => m.type === 'READY')).toBe(false);
  });
});
