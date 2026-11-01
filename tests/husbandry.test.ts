import { describe, it, expect } from 'vitest';
import {
  createPaddock,
  captureAnimal,
  stepPaddockDay,
} from '../src/engine/husbandry';

describe('Animal Domestication & Husbandry (OBJ-006 / AC-008)', () => {
  it('creates an empty paddock with initial feed and water reserves', () => {
    const paddock = createPaddock();
    expect(paddock.animals.length).toBe(0);
    expect(paddock.storedFeedKg).toBe(20.0);
    expect(paddock.storedWaterL).toBe(50.0);
  });

  it('captures domestic animals with accurate biological yields', () => {
    const goat = captureAnimal('GOAT');
    expect(goat.butterfatGramsPerDay).toBe(54.0); // 54g butterfat for soap
    expect(goat.milkLPerDay).toBe(1.2);

    const fowl = captureAnimal('RED_JUNGLE_FOWL');
    expect(fowl.eggsPerDay).toBe(1);
  });

  it('produces milk, butterfat, and manure when fed and watered over 1 day', () => {
    const paddock = createPaddock();
    paddock.animals.push(captureAnimal('GOAT'));
    paddock.animals.push(captureAnimal('RED_JUNGLE_FOWL'));

    const yields = stepPaddockDay(paddock);
    expect(yields.milkL).toBe(1.2);
    expect(yields.butterfatGrams).toBe(54.0);
    expect(yields.eggs).toBe(1);
    expect(yields.manureKg).toBeCloseTo(0.84, 2);
    expect(paddock.accumulatedManureKg).toBeCloseTo(0.84, 2);
  });
});
