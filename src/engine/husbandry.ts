/**
 * Domestication & Husbandry Engine
 *
 * Implements Section 4.2 (Node 4: Animals) of Master Technical Specification:
 * - Live Animal Capture (+20% haul transport energy cost compared to hunting)
 * - Split-Rail Paddock Construction & Capacity
 * - Daily feed/water inputs
 * - Renewable yields: Milk (butterfat for soap), Eggs, Guano / Manure (KNO3 precursor for saltpeter beds)
 */

export interface DomesticAnimal {
  readonly id: string;
  readonly species: string;
  readonly dailyFeedKg: number;
  readonly dailyWaterL: number;
  readonly milkLPerDay: number;
  readonly butterfatGramsPerDay: number;
  readonly manureKgPerDay: number;
  readonly eggsPerDay: number;
  hungerPct: number;    // 0 = sated, 100 = starving
  thirstPct: number;
}

export interface Paddock {
  id: string;
  name: string;
  maxAnimals: number;
  animals: DomesticAnimal[];
  storedFeedKg: number;
  storedWaterL: number;
  accumulatedManureKg: number;
}

export function createPaddock(id = 'PADDOCK_MAIN', maxAnimals = 6): Paddock {
  return {
    id,
    name: 'Split-Rail Paddock',
    maxAnimals,
    animals: [],
    storedFeedKg: 20.0,
    storedWaterL: 50.0,
    accumulatedManureKg: 0,
  };
}

export function captureAnimal(species: 'GOAT' | 'RED_JUNGLE_FOWL' | 'AUROCHS'): DomesticAnimal {
  switch (species) {
    case 'GOAT':
      return {
        id: `GOAT_${Math.floor(Math.random() * 10000)}`,
        species: 'Capra hircus (Farmed Goat)',
        dailyFeedKg: 2.5,
        dailyWaterL: 4.0,
        milkLPerDay: 1.2,
        butterfatGramsPerDay: 54.0, // Used for soap tristearin fat!
        manureKgPerDay: 0.8,
        eggsPerDay: 0,
        hungerPct: 0,
        thirstPct: 0,
      };
    case 'RED_JUNGLE_FOWL':
      return {
        id: `FOWL_${Math.floor(Math.random() * 10000)}`,
        species: 'Gallus gallus (Jungle Fowl)',
        dailyFeedKg: 0.15,
        dailyWaterL: 0.2,
        milkLPerDay: 0,
        butterfatGramsPerDay: 0,
        manureKgPerDay: 0.04, // High-N Guano
        eggsPerDay: 1,
        hungerPct: 0,
        thirstPct: 0,
      };
    case 'AUROCHS':
      return {
        id: `AUROCHS_${Math.floor(Math.random() * 10000)}`,
        species: 'Bos primigenius (Aurochs Cow)',
        dailyFeedKg: 9.0,
        dailyWaterL: 25.0,
        milkLPerDay: 6.0,
        butterfatGramsPerDay: 270.0,
        manureKgPerDay: 5.0,
        eggsPerDay: 0,
        hungerPct: 0,
        thirstPct: 0,
      };
  }
}

export interface PaddockDailyYield {
  milkL: number;
  butterfatGrams: number;
  eggs: number;
  manureKg: number;
}

/** Step the paddock 1 simulated day (24 hours). */
export function stepPaddockDay(paddock: Paddock): PaddockDailyYield {
  let milkL = 0;
  let butterfatGrams = 0;
  let eggs = 0;
  let manureKg = 0;

  for (const animal of paddock.animals) {
    if (paddock.storedFeedKg >= animal.dailyFeedKg) {
      paddock.storedFeedKg -= animal.dailyFeedKg;
      animal.hungerPct = 0;
    } else {
      animal.hungerPct = Math.min(100, animal.hungerPct + 25);
    }

    if (paddock.storedWaterL >= animal.dailyWaterL) {
      paddock.storedWaterL -= animal.dailyWaterL;
      animal.thirstPct = 0;
    } else {
      animal.thirstPct = Math.min(100, animal.thirstPct + 25);
    }

    // Only produce if healthy (not starving/dehydrated)
    if (animal.hungerPct < 50 && animal.thirstPct < 50) {
      milkL += animal.milkLPerDay;
      butterfatGrams += animal.butterfatGramsPerDay;
      eggs += animal.eggsPerDay;
      manureKg += animal.manureKgPerDay;
    }
  }

  paddock.accumulatedManureKg += manureKg;

  return {
    milkL,
    butterfatGrams,
    eggs,
    manureKg,
  };
}
