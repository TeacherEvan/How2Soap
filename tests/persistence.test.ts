import { describe, it, expect } from 'vitest';
import {
  serializeSave,
  deserializeSave,
  compressSaveToBase64,
  decompressBase64ToSave,
  migrateSave,
  type SerializedWorldSave,
} from '../src/engine/persistence';

describe('Save Serialization & Compression (OBJ-007 / AC-009)', () => {
  const dummySave: SerializedWorldSave = {
    version: 2,
    timestamp: Date.now(),
    tick: 54,
    day: 3,
    ambientTempK: 288.15,
    rngSeed: 12345,
    player: {
      glucoseKcal: 1150,
      adiposeKcal: 14800,
      hydrationPct: 92,
      coreTempK: 310.15,
      clothingIclo: 1.15,
      conditions: { fever: false, systemicInfection: false, woundContamination: false },
      dead: false,
      woundOnsetSeconds: 0,
      sepsisOnsetSeconds: 0,
    },
    inventory: { tools: {}, bareHands: {}, backpack: {} },
    vessels: [{ id: 0, material: 'WOOD', tempK: 345, moles: [] }],
    ever: {},
    renown: 0,
    affinity: { apothecary: 0, soapwright: 0, forgewright: 0 },
    chapter: 0,
    fabricatedRecipes: [],
    objectivesDone: [],
    lettersDone: [],
  };

  it('serializes and deserializes world state cleanly', () => {
    const json = serializeSave(dummySave);
    const restored = deserializeSave(json);
    expect(restored.tick).toBe(54);
    expect(restored.player.clothingIclo).toBe(1.15);
  });

  it('compresses to base64 string with sha256 prefix and recovers original state', async () => {
    const json = serializeSave(dummySave);
    const b64 = await compressSaveToBase64(json);
    expect(typeof b64).toBe('string');
    expect(b64.startsWith('sha256:')).toBe(true);

    const recovered = await decompressBase64ToSave(b64);
    expect(recovered.day).toBe(3);
    expect(recovered.vessels.length).toBe(1);
    expect(recovered.player.glucoseKcal).toBe(1150);
  });

  it('migrates v1 save to v2 with defaults', () => {
    const v1 = {
      version: 1,
      timestamp: Date.now(),
      tick: 100,
      day: 5,
      ambientTempK: 290,
      player: { glucoseKcal: 800, adiposeKcal: 10000, hydrationPct: 70, coreTempK: 310, clothingIclo: 0.5 },
      inventory: { backpackUnlocked: true },
      vessels: [],
    };
    const v2 = migrateSave(v1);
    expect(v2.version).toBe(2);
    expect(v2.tick).toBe(100);
    expect(v2.day).toBe(5);
    expect(typeof v2.rngSeed).toBe('number');
    expect(v2.renown).toBe(0);
    expect(v2.affinity.apothecary).toBe(0);
  });
});