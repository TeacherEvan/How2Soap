import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeInventoryDigest, computeColonyDigest, buildSaveSnapshot, requestAutoSave, bindAutoSaveOnHide } from '../src/app/autosave';
import { snapshotSignature } from '../src/engine/saveSignature';
import { state } from '../src/app/state';
import { AUTO_SAVE_KEY } from '../src/app/autosave';

// Mock localStorage for Node environment
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// Mock window.setTimeout/clearTimeout to work with fake timers
let timerIdCounter = 0;
const pendingTimers = new Map<number, { cb: Function; deadline: number }>();

// Track virtual time
let virtualNow = Date.now();
const originalDateNow = Date.now;
global.Date.now = vi.fn(() => virtualNow);

globalThis.window = {
  setTimeout: vi.fn((cb: Function, delay: number) => {
    const id = ++timerIdCounter;
    const deadline = virtualNow + delay;
    pendingTimers.set(id, { cb, deadline });
    return id;
  }),
  clearTimeout: vi.fn((id: number) => {
    pendingTimers.delete(id);
  }),
} as any;

// Helper to advance fake timers and execute callbacks
const advanceTimersAndExecute = (ms: number) => {
  vi.advanceTimersByTime(ms);
  virtualNow += ms;
  const now = virtualNow;
  for (const [id, timer] of pendingTimers.entries()) {
    if (timer.deadline <= now) {
      timer.cb();
      pendingTimers.delete(id);
    }
  }
};

// Mock document
globalThis.document = {
  visibilityState: 'visible',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
} as any;

/**
 * Integration test for save/restore with paused mutations.
 * Reproduces the P2-2 bug class: inventory/colony changes while paused
 * must be captured by autosave signature.
 */

describe('Save/Restore: paused mutations captured by autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();

    // Reset state
    state.inventory = {
      backpackUnlocked: true,
      bareHands: { slots: [null, null] },
      backpack: { slots: new Array(24).fill(null) },
      campCache: { slots: [] },
      tools: {},
    };
    state.colony = {
      colonists: [
        { id: 1, status: 'IDLE', assignedJob: { speciesId: 'FORAGER' }, morale: 100 },
        { id: 2, status: 'WORKING', assignedJob: { speciesId: 'MINER' }, morale: 80 },
      ],
      ledger: [],
      desirePathGrid: new Array(1024).fill(0),
      nextColonistId: 3,
      lastDecayTick: 0,
    };
    state.snapshot = { tick: 10, telemetry: null, moles: new Float64Array() };
    state.player = {
      glucoseKcal: 1000,
      adiposeKcal: 15000,
      hydrationPct: 100,
      coreTempC: '37.0',
      clothingIclo: 0.05,
      day: 1,
      ambientTempK: 288.15,
      conditions: { fever: false, systemicInfection: false, woundContamination: false, dead: false },
    };
    state.rngSeed = 42;
    state.progression = {
      ever: {},
      renown: 0,
      affinity: { apothecary: 0, soapwright: 0, forgewright: 0 },
      chapter: 0,
      fabricatedRecipes: [],
      objectivesDone: [],
      lettersDone: [],
    };
    state.vessels = [];
    state.tutorial = { snapshot: () => undefined } as any;
    state.featureFlags = { colonyChemistryLink: true };
    state.paused = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computeInventoryDigest captures item additions', () => {
    state.inventory.backpack.slots[0] = { itemId: 'WOOD', count: 5 };
    const digest = computeInventoryDigest(state.inventory);
    expect(digest).toContain('WOOD:5');
  });

  it('computeInventoryDigest is order-independent', () => {
    state.inventory.backpack.slots[0] = { itemId: 'WOOD', count: 5 };
    state.inventory.backpack.slots[1] = { itemId: 'STONE', count: 3 };
    const digest1 = computeInventoryDigest(state.inventory);
    
    state.inventory.backpack.slots[0] = { itemId: 'STONE', count: 3 };
    state.inventory.backpack.slots[1] = { itemId: 'WOOD', count: 5 };
    const digest2 = computeInventoryDigest(state.inventory);
    
    expect(digest1).toBe(digest2);
  });

  it('computeColonyDigest captures colonist changes', () => {
    const digest = computeColonyDigest(state.colony);
    expect(digest).toContain('1:IDLE:FORAGER:100');
    expect(digest).toContain('2:WORKING:MINER:80');
  });

  it('snapshotSignature includes inventoryDigest and colonyDigest', () => {
    state.inventory.backpack.slots[0] = { itemId: 'WOOD', count: 5 };
    const invDigest = computeInventoryDigest(state.inventory);
    const colDigest = computeColonyDigest(state.colony);
    
    const sig = snapshotSignature({
      tick: 10,
      glucose: 1000,
      seed: 42,
      day: 1,
      inventoryDigest: invDigest,
      colonyDigest: colDigest,
    });
    
    expect(sig).toContain('WOOD:5');
    expect(sig).toContain('1:IDLE:FORAGER:100');
  });

  it('requestAutoSave triggers save when inventory changes while paused', () => {
    // Initial save
    requestAutoSave();
    advanceTimersAndExecute(3000);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(AUTO_SAVE_KEY, expect.any(String));
    
    const firstSave = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(firstSave.inventory.backpack.slots[0]).toBeNull();
    
    // Mutate inventory while "paused" (no tick advance)
    state.inventory.backpack.slots[0] = { itemId: 'WOOD', count: 10 };
    state.paused = true;
    
    requestAutoSave();
    advanceTimersAndExecute(3000);
    
    const secondSaveCall = localStorageMock.setItem.mock.calls.find(c => c[0] === AUTO_SAVE_KEY && c[1] !== localStorageMock.setItem.mock.calls[0][1]);
    expect(secondSaveCall).toBeDefined();
    
    const secondSave = JSON.parse(secondSaveCall![1]);
    expect(secondSave.inventory.backpack.slots[0]).toEqual({ itemId: 'WOOD', count: 10 });
  });

  it('requestAutoSave triggers save when colony changes while paused', () => {
    // Reset timer state
    pendingTimers.clear();
    timerIdCounter = 0;
    localStorageMock.setItem.mockClear();
    
    requestAutoSave();
    advanceTimersAndExecute(3000);
    
    const firstSave = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(firstSave.colony?.colonists[0]?.status).toBe('IDLE');
    
    // Mutate colony while paused
    state.colony!.colonists[0].status = 'STRIKE';
    state.colony!.colonists[0].morale = 15;
    state.paused = true;
    
    requestAutoSave();
    advanceTimersAndExecute(3000);
    
    const secondSaveCall = localStorageMock.setItem.mock.calls.find(c => c[0] === AUTO_SAVE_KEY && c[1] !== localStorageMock.setItem.mock.calls[0][1]);
    expect(secondSaveCall).toBeDefined();
    
    const secondSave = JSON.parse(secondSaveCall![1]);
    expect(secondSave.colony?.colonists[0]?.status).toBe('STRIKE');
    expect(secondSave.colony?.colonists[0]?.morale).toBe(15);
  });

  it('requestAutoSave does NOT write when nothing changed (signature match)', () => {
    // Reset timer state
    pendingTimers.clear();
    timerIdCounter = 0;
    localStorageMock.setItem.mockClear();
    
    requestAutoSave();
    advanceTimersAndExecute(3000);
    
    const firstCallCount = localStorageMock.setItem.mock.calls.length;
    expect(firstCallCount).toBe(1);
    
    // Call again with no mutations
    requestAutoSave();
    advanceTimersAndExecute(3000);
    
    // Should not have written again (signature matches)
    const saveCalls = localStorageMock.setItem.mock.calls.filter(c => c[0] === AUTO_SAVE_KEY);
    expect(saveCalls.length).toBe(1);
  });

  it('bindAutoSaveOnHide flushes immediately on visibilitychange', () => {
    // Reset timer state
    pendingTimers.clear();
    timerIdCounter = 0;
    localStorageMock.setItem.mockClear();
    
    bindAutoSaveOnHide();
    
    state.inventory.backpack.slots[0] = { itemId: 'WOOD', count: 7 };
    
    Object.defineProperty(globalThis.document, 'visibilityState', { value: 'hidden', configurable: true });
    globalThis.document.dispatchEvent(new Event('visibilitychange'));
    
    // Manually call the listener since mock dispatchEvent doesn't trigger it
    const listener = globalThis.document.addEventListener.mock.calls.find(c => c[0] === 'visibilitychange')?.[1];
    if (listener) listener(new Event('visibilitychange'));
    
    const saveCalls = localStorageMock.setItem.mock.calls.filter(c => c[0] === AUTO_SAVE_KEY);
    expect(saveCalls.length).toBeGreaterThan(0);
    
    const save = JSON.parse(saveCalls[saveCalls.length - 1][1]);
    expect(save.inventory.backpack.slots[0]).toEqual({ itemId: 'WOOD', count: 7 });
  });
});

describe('Save/Restore: SHA-256 integrity', () => {
  it('compressSaveToBase64 includes SHA-256 prefix', async () => {
    const { compressSaveToBase64 } = await import('../src/engine/persistence');
    const json = JSON.stringify({ test: 'data', version: 3 });
    const compressed = await compressSaveToBase64(json);
    
    expect(compressed.startsWith('sha256:')).toBe(true);
    const parts = compressed.split(':');
    expect(parts.length).toBe(3);
    expect(parts[1].length).toBe(64); // SHA-256 hex
  });

  it('decompressBase64ToSave rejects corrupted payload', async () => {
    const { compressSaveToBase64, decompressBase64ToSave } = await import('../src/engine/persistence');
    const json = JSON.stringify({ test: 'data', version: 3 });
    const compressed = await compressSaveToBase64(json);
    
    // Corrupt the base64 payload (last part after second colon) - this will produce invalid gzip
    const parts = compressed.split(':');
    const corruptedPayload = parts[2].slice(0, -4) + 'AAAA'; // Corrupt base64
    const corrupted = `sha256:${parts[1]}:${corruptedPayload}`;
    
    // Should throw during decompression (invalid gzip) or SHA mismatch
    await expect(decompressBase64ToSave(corrupted)).rejects.toThrow();
  });

  it('decompressBase64ToSave accepts legacy format without prefix (valid gzip)', async () => {
    const { decompressBase64ToSave } = await import('../src/engine/persistence');
    
    // Create a valid gzip base64 payload manually
    const json = JSON.stringify({ version: 2, tick: 42, player: { glucoseKcal: 1000 } });
    const encoder = new TextEncoder();
    const data = encoder.encode(json);
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();
    const compressedBuffer = await new Response(cs.readable).arrayBuffer();
    const bytes = new Uint8Array(compressedBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const legacyB64 = btoa(binary);
    
    const save = await decompressBase64ToSave(legacyB64);
    expect(save.version).toBe(2);
    expect(save.tick).toBe(42);
    expect(save.player.glucoseKcal).toBe(1000);
  });
});

describe('Save/Restore: version migration', () => {
  it('migrateSave upgrades v1 to v2', async () => {
    const { migrateSave } = await import('../src/engine/persistence');
    const v1Save = { version: 1, tick: 5, player: { glucoseKcal: 800 } };
    const migrated = migrateSave(v1Save);
    
    expect(migrated.version).toBe(2);
    expect(migrated.player.glucoseKcal).toBe(800);
    expect(migrated.player.adiposeKcal).toBe(15000); // default
  });

  it('migrateSave preserves v2+ saves', async () => {
    const { migrateSave } = await import('../src/engine/persistence');
    const v3Save = { version: 3, tick: 100, player: { glucoseKcal: 500, adiposeKcal: 10000 } };
    const migrated = migrateSave(v3Save);
    
    expect(migrated.version).toBe(3);
    expect(migrated.player.glucoseKcal).toBe(500);
    expect(migrated.player.adiposeKcal).toBe(10000);
  });
});