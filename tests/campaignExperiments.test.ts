import { describe, it, expect } from 'vitest';
import {
  turnsPerExperiment,
  createExperimentQueue,
  startExperiment,
  stepExperiments,
  getMaxConcurrentExperiments,
} from '../src/engine/campaign/experiments';

describe('Campaign Experiments Model (M1 / §6.17)', () => {
  it('converts workHours into campaign turns correctly', () => {
    // <= 3 hours complete within 1 turn
    expect(turnsPerExperiment(0.5)).toBe(1);
    expect(turnsPerExperiment(1)).toBe(1);
    expect(turnsPerExperiment(3)).toBe(1);

    // Long multi-turn operations
    expect(turnsPerExperiment(24)).toBe(1); // 1 turn (24h)
    expect(turnsPerExperiment(25)).toBe(2); // 2 turns
    expect(turnsPerExperiment(48)).toBe(2); // 2 turns (48h)
    expect(turnsPerExperiment(72)).toBe(3); // 3 turns (72h)
  });

  it('enforces concurrency bounds: base 4 + benchBuildings, capped at 32', () => {
    expect(getMaxConcurrentExperiments(0)).toBe(4);
    expect(getMaxConcurrentExperiments(2)).toBe(6);
    expect(getMaxConcurrentExperiments(10)).toBe(14);
    expect(getMaxConcurrentExperiments(50)).toBe(32); // capped at MAX_VESSELS 32
  });

  it('reserves inventory inputs upon starting experiment', () => {
    const queue = createExperimentQueue();
    const inventory: Record<string, number> = {
      RAW_HIDE_MEDIUM: 2,
      OAK_BARK: 4,
    };

    const res = startExperiment(queue, {
      recipeId: 'veg_tanning',
      recipeName: 'Vegetable Tanning',
      workHours: 48,
      currentTurn: 1,
      inputs: [
        { itemId: 'RAW_HIDE_MEDIUM', count: 1 },
        { itemId: 'OAK_BARK', count: 2 },
      ],
      outputs: [{ itemId: 'VEGETABLE_TANNED_LEATHER', count: 1 }],
      inventory,
    });

    expect(res.success).toBe(true);
    expect(inventory.RAW_HIDE_MEDIUM).toBe(1);
    expect(inventory.OAK_BARK).toBe(2);
    expect(queue.experiments.length).toBe(1);
    expect(queue.experiments[0].turnsLeft).toBe(2);
  });

  it('rejects starting when reagents are insufficient', () => {
    const queue = createExperimentQueue();
    const inventory: Record<string, number> = { OAK_BARK: 1 };

    const res = startExperiment(queue, {
      recipeId: 'veg_tanning',
      recipeName: 'Vegetable Tanning',
      workHours: 48,
      currentTurn: 1,
      inputs: [{ itemId: 'OAK_BARK', count: 2 }],
      outputs: [],
      inventory,
    });

    expect(res.success).toBe(false);
    expect(res.reason).toContain('Insufficient reagent');
    expect(queue.experiments.length).toBe(0);
    expect(inventory.OAK_BARK).toBe(1); // unchanged
  });

  it('rejects starting when laboratory concurrency cap is reached', () => {
    const queue = createExperimentQueue(0); // max 4
    const inventory: Record<string, number> = { FLINT: 100 };

    for (let i = 0; i < 4; i++) {
      const res = startExperiment(queue, {
        recipeId: `bench_${i}`,
        recipeName: `Bench Job ${i}`,
        workHours: 1,
        currentTurn: 1,
        inputs: [{ itemId: 'FLINT', count: 1 }],
        outputs: [],
        inventory,
      });
      expect(res.success).toBe(true);
    }

    // 5th attempt fails
    const fifth = startExperiment(queue, {
      recipeId: 'bench_overload',
      recipeName: 'Overload',
      workHours: 1,
      currentTurn: 1,
      inputs: [{ itemId: 'FLINT', count: 1 }],
      outputs: [],
      inventory,
    });

    expect(fifth.success).toBe(false);
    expect(fifth.reason).toContain('capacity reached');
  });

  it('progresses active experiments and finishes on turn completion', () => {
    const queue = createExperimentQueue();
    const inventory: Record<string, number> = { REAGENT: 10 };

    startExperiment(queue, {
      recipeId: 'slow_experiment',
      recipeName: 'Slow Distillation',
      workHours: 48, // 2 turns
      currentTurn: 1,
      inputs: [{ itemId: 'REAGENT', count: 1 }],
      outputs: [{ itemId: 'PRODUCT', count: 1 }],
      inventory,
    });

    // Step 1 turn
    const step1 = stepExperiments(queue, 2);
    expect(step1.completed.length).toBe(0);
    expect(step1.active.length).toBe(1);
    expect(step1.active[0].turnsLeft).toBe(1);
    expect(step1.benchLedger[0].status).toBe('in_progress');

    // Step 2nd turn
    const step2 = stepExperiments(queue, 3);
    expect(step2.completed.length).toBe(1);
    expect(step2.active.length).toBe(0);
    expect(step2.benchLedger[0].status).toBe('completed');
  });

  it('handles living processes deterministic sour roll correctly', () => {
    const queue = createExperimentQueue();
    const inventory: Record<string, number> = { MASH: 10 };

    // Deterministic roll below sourChance (0.12) -> should sour
    const sourRoll = () => 0.05;
    const resSour = startExperiment(queue, {
      recipeId: 'fermentation',
      recipeName: 'Grain Fermentation',
      workHours: 24,
      currentTurn: 1,
      inputs: [{ itemId: 'MASH', count: 1 }],
      outputs: [],
      inventory,
      rngNextFloat: sourRoll,
    });

    expect(resSour.instance?.sour).toBe(true);

    // Deterministic roll above sourChance -> clean batch
    const cleanRoll = () => 0.50;
    const resClean = startExperiment(queue, {
      recipeId: 'fermentation',
      recipeName: 'Grain Fermentation',
      workHours: 24,
      currentTurn: 1,
      inputs: [{ itemId: 'MASH', count: 1 }],
      outputs: [],
      inventory,
      rngNextFloat: cleanRoll,
    });

    expect(resClean.instance?.sour).toBe(false);
  });
});
