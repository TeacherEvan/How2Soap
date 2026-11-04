/**
 * Paddock projection math — pure, unit-tested.
 */
import type { DomesticAnimal } from '../engine/husbandry';

export interface PaddockProjection {
  /** Days the stored fodder lasts at current consumption (Infinity = no mouths). */
  daysOfFeed: number;
  dailyFeedKg: number;
  dailyWaterL: number;
  milkLPerDay: number;
  butterfatGPerDay: number;
  eggsPerDay: number;
  manureKgPerDay: number;
}

export function projectPaddock(
  animals: ReadonlyArray<Pick<DomesticAnimal,
    'dailyFeedKg' | 'dailyWaterL' | 'milkLPerDay' | 'butterfatGramsPerDay' | 'eggsPerDay' | 'manureKgPerDay'>>,
  storedFeedKg: number,
): PaddockProjection {
  const proj: PaddockProjection = {
    daysOfFeed: animals.length === 0
      ? Infinity
      : animals.reduce((s, a) => s + a.dailyFeedKg, 0) > 0
        ? storedFeedKg / animals.reduce((s, a) => s + a.dailyFeedKg, 0)
        : Infinity,
    dailyFeedKg: 0,
    dailyWaterL: 0,
    milkLPerDay: 0,
    butterfatGPerDay: 0,
    eggsPerDay: 0,
    manureKgPerDay: 0,
  };
  for (const a of animals) {
    proj.dailyFeedKg += a.dailyFeedKg;
    proj.dailyWaterL += a.dailyWaterL;
    proj.milkLPerDay += a.milkLPerDay;
    proj.butterfatGPerDay += a.butterfatGramsPerDay;
    proj.eggsPerDay += a.eggsPerDay;
    proj.manureKgPerDay += a.manureKgPerDay;
  }
  proj.daysOfFeed = proj.dailyFeedKg > 0 ? storedFeedKg / proj.dailyFeedKg : Infinity;
  return proj;
}

/** Hunger/thirst severity for the bar UI (0=sated .. 100=starving). */
export function hungerBand(hungerPct: number): 'fed' | 'hungry' | 'starving' {
  if (hungerPct >= 75) return 'starving';
  if (hungerPct >= 40) return 'hungry';
  return 'fed';
}
