/**
 * Paddock projection math — days of fodder, renderable ledger.
 */
import { describe, expect, it } from 'vitest';
import { projectPaddock, hungerBand } from '../src/ui/paddockModel';

const goat = {
  dailyFeedKg: 2.5,
  dailyWaterL: 4,
  milkLPerDay: 1.2,
  butterfatGramsPerDay: 54,
  eggsPerDay: 0,
  manureKgPerDay: 0.42,
};
const fowl = {
  dailyFeedKg: 0.12,
  dailyWaterL: 0.3,
  milkLPerDay: 0,
  butterfatGramsPerDay: 0,
  eggsPerDay: 1,
  manureKgPerDay: 0.08,
};

describe('projectPaddock', () => {
  it('empty paddock: infinite fodder days, zero output', () => {
    const p = projectPaddock([], 0);
    expect(p.daysOfFeed).toBe(Infinity);
    expect(p.dailyFeedKg).toBe(0);
    expect(p.milkLPerDay).toBe(0);
  });

  it('projects days of fodder for mixed stock', () => {
    const p = projectPaddock([goat, goat, fowl], 13.12);
    expect(p.dailyFeedKg).toBeCloseTo(5.12, 5);
    expect(p.daysOfFeed).toBeCloseTo(13.12 / 5.12, 3);
    expect(p.milkLPerDay).toBeCloseTo(2.4, 5);
    expect(p.eggsPerDay).toBe(1);
    expect(p.manureKgPerDay).toBeCloseTo(0.92, 5);
  });

  it('zero feed with mouths to feed: 0 days remaining', () => {
    const p = projectPaddock([goat], 0);
    expect(p.daysOfFeed).toBe(0);
  });
});

describe('hungerBand', () => {
  it('maps hunger percentage to severity bands', () => {
    expect(hungerBand(0)).toBe('fed');
    expect(hungerBand(39)).toBe('fed');
    expect(hungerBand(40)).toBe('hungry');
    expect(hungerBand(74)).toBe('hungry');
    expect(hungerBand(75)).toBe('starving');
    expect(hungerBand(100)).toBe('starving');
  });
});
