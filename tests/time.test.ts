import { describe, expect, it } from 'vitest';
import { DAY_TICKS, tickToDay, SIM_STEP_SECONDS, WORKER_HZ } from '../src/engine/time';
describe('simulation clock', () => {
  it('10 Hz × 360 s/step = 240 ticks per game day', () => {
    expect(WORKER_HZ * SIM_STEP_SECONDS).toBe(3600);
    expect(DAY_TICKS).toBe(240);
  });
  it('tickToDay starts at Day 1 and flips at 240', () => {
    expect(tickToDay(0)).toBe(1);
    expect(tickToDay(239)).toBe(1);
    expect(tickToDay(240)).toBe(2);
  });
});
