import { describe, it, expect } from 'vitest';
import {
  serializeSave,
  deserializeSave,
  compressSaveToBase64,
  decompressBase64ToSave,
  type SerializedWorldSave,
} from '../src/engine/persistence';

describe('Save Serialization & Compression (OBJ-007 / AC-009)', () => {
  const dummySave: SerializedWorldSave = {
    version: 1,
    timestamp: Date.now(),
    tick: 54,
    day: 3,
    ambientTempK: 288.15,
    player: {
      glucoseKcal: 1150,
      adiposeKcal: 14800,
      hydrationPct: 92,
      coreTempK: 310.15,
      clothingIclo: 1.15,
    },
    inventory: { tools: {}, bareHands: {}, backpack: {} },
    vessels: [{ id: 0, material: 'WOOD', tempK: 345, moles: [] }],
  };

  it('serializes and deserializes world state cleanly', () => {
    const json = serializeSave(dummySave);
    const restored = deserializeSave(json);
    expect(restored.tick).toBe(54);
    expect(restored.player.clothingIclo).toBe(1.15);
  });

  it('compresses to base64 string and recovers original state', async () => {
    const json = serializeSave(dummySave);
    const b64 = await compressSaveToBase64(json);
    expect(typeof b64).toBe('string');
    expect(b64.length).toBeGreaterThan(0);

    const recovered = await decompressBase64ToSave(b64);
    expect(recovered.day).toBe(3);
    expect(recovered.vessels.length).toBe(1);
    expect(recovered.player.glucoseKcal).toBe(1150);
  });
});
