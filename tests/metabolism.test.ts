import { describe, it, expect } from 'vitest';
import {
  createPlayerMetabolism,
  stepPlayerMetabolism,
  consumeFood,
  METABOLIC_CONSTANTS,
} from '../src/engine/metabolism';

describe('Player Metabolism & Thermal Engine (OBJ-001 / AC-004)', () => {
  it('initializes with nominal glucose, fat, and core temperature', () => {
    const player = createPlayerMetabolism(0.05);
    expect(player.glucoseKcal).toBe(1200);
    expect(player.adiposeKcal).toBe(15000);
    expect(player.coreTempK).toBeCloseTo(310.15, 2); // 37.0 C
    expect(player.clothingIclo).toBe(0.05);
  });

  it('burns BMR over 1 hour of rest at room temperature', () => {
    const player = createPlayerMetabolism(0.05);
    const startGlucose = player.glucoseKcal;
    const result = stepPlayerMetabolism(player, {
      dtSeconds: 3600,
      ambientTempK: 295.15, // 22 C
      mechanicalWorkJoules: 0,
    });
    expect(result.bmrKcal).toBe(70.0);
    expect(player.glucoseKcal).toBeLessThan(startGlucose);
    expect(result.isHypothermic).toBe(false);
  });

  it('accounts for mechanical work with 22% efficiency', () => {
    const player = createPlayerMetabolism(0.05);
    // 180 kJ of mechanical work (e.g. cutting oak log)
    // 180,000 J / (0.22 * 4184 J/kcal) = 195.55 kcal
    const result = stepPlayerMetabolism(player, {
      dtSeconds: 1800,
      ambientTempK: 295.15,
      mechanicalWorkJoules: 180000,
    });
    expect(result.workKcal).toBeCloseTo(195.55, 1);
  });

  it('mobilizes adipose fat reserve when glucose is exhausted', () => {
    const player = createPlayerMetabolism(0.05);
    player.glucoseKcal = 50.0;
    const initialFat = player.adiposeKcal;

    // Run high mechanical work requiring > 50 kcal
    stepPlayerMetabolism(player, {
      dtSeconds: 3600,
      ambientTempK: 295.15,
      mechanicalWorkJoules: 100000, // ~108 kcal work + BMR
    });

    expect(player.glucoseKcal).toBe(0);
    expect(player.adiposeKcal).toBeLessThan(initialFat);
  });

  it('insulates significantly better with leather tunic/backpack (I_clo 1.15 vs 0.05)', () => {
    const nakedPlayer = createPlayerMetabolism(0.05);
    const clothedPlayer = createPlayerMetabolism(1.15);

    const coldAmbient = 275.15; // 2 C (freezing cold night)
    const nakedResult = stepPlayerMetabolism(nakedPlayer, {
      dtSeconds: 3600,
      ambientTempK: coldAmbient,
    });

    const clothedResult = stepPlayerMetabolism(clothedPlayer, {
      dtSeconds: 3600,
      ambientTempK: coldAmbient,
    });

    expect(nakedResult.thermalDissipationKcal).toBeGreaterThan(clothedResult.thermalDissipationKcal * 5);
  });

  it('replenishes glucose and overflows into adipose when consuming food', () => {
    const player = createPlayerMetabolism();
    player.glucoseKcal = 1900;
    consumeFood(player, 300, 10); // 100 kcal goes to glucose, 200 to fat
    expect(player.glucoseKcal).toBe(METABOLIC_CONSTANTS.MAX_GLUCOSE_KCAL);
    expect(player.adiposeKcal).toBe(15200);
    expect(player.hydrationPct).toBe(100);
  });
});
