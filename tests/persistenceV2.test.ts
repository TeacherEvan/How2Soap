import { describe, expect, it } from 'vitest';
import { migrateSave, serializeSave, deserializeSave } from '../src/engine/persistence';

describe('save v2 migration + round trip', () => {
  it('v1 save migrates with defaults, keeps tick/day', () => {
    const v1 = { version: 1, timestamp: 1, tick: 240, day: 2, ambientTempK: 288.15,
      player: { glucoseKcal: 500, adiposeKcal: 12000, hydrationPct: 80, coreTempK: 310.15, clothingIclo: 1.15 },
      inventory: { backpackUnlocked: true }, vessels: [] };
    const v2 = migrateSave(v1);
    expect(v2.version).toBe(2);
    expect(v2.renown).toBe(0);
    expect(v2.chapter).toBe(0);
    expect(Array.isArray(v2.fabricatedRecipes)).toBe(true);
    expect(v2.day).toBe(2);
    expect(typeof v2.rngSeed).toBe('number');
  });
  it('serialize→deserialize round-trips v2 exactly', () => {
    const save = migrateSave({ version: 1, timestamp: 1, tick: 1, day: 1, ambientTempK: 290,
      player: { glucoseKcal: 1, adiposeKcal: 2, hydrationPct: 3, coreTempK: 310, clothingIclo: 0.05 },
      inventory: {}, vessels: [] });
    const back = deserializeSave(serializeSave(save));
    expect(back.rngSeed).toBe(save.rngSeed);
    expect(back.day).toBe(save.day);
  });
});
