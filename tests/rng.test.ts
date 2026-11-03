// tests/rng.test.ts
import { describe, expect, it } from 'vitest';
import { mulberry32, hashSeed, createSeededRng } from '../src/engine/rng';

describe('seeded RNG (worker determinism)', () => {
  it('mulberry32 is deterministic for the same seed', () => {
    const a = mulberry32(123456789);
    const b = mulberry32(123456789);
    for (let i = 0; i < 1000; i += 1) expect(a()).toBe(b());
  });
  it('different seeds produce different streams', () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toBe(b);
  });
  it('stream stays in [0, 1)', () => {
    const next = mulberry32(42);
    for (let i = 0; i < 10000; i += 1) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('hashSeed is stable and string-sensitive', () => {
    expect(hashSeed('how2soap')).toBe(hashSeed('how2soap'));
    expect(hashSeed('how2soap')).not.toBe(hashSeed('How2Soap'));
  });
  it('createSeededRng.roll honours the probability threshold', () => {
    const rng = createSeededRng(7);
    let hits = 0;
    for (let i = 0; i < 1000; i += 1) if (rng.roll(0.2)) hits += 1;
    expect(hits).toBeGreaterThan(100);
    expect(hits).toBeLessThan(300);
  });
});
