import { describe, expect, it } from 'vitest';
import {
  initialProgression,
  levelFromRenown,
  affinityRank,
  dominantAffinity,
  evaluateObjectives,
  applyProgressEvents,
  applyProgressEventsWithSensor,
  currentChapter,
  type ObjectiveSensor,
} from '../src/engine/progression';

const sensorFor = (over: Partial<ObjectiveSensor> = {}): ObjectiveSensor => ({
  hasSpecies: () => false,
  hasItem: () => false,
  hasFabricated: () => false,
  hasFlag: () => false,
  hasEaten: () => false,
  hasTreated: () => false,
  hasHarvestedSpeciesPart: () => false,
  hasCompletedSoapKettleBatch: () => false,
  hasFulfilledTimedRequest: () => false,
  ...over,
});

describe('renown curve + levels', () => {
  it('computes level/title/progress from thresholds', () => {
    expect(levelFromRenown(0).level).toBe(1);
    expect(levelFromRenown(0).title).toBe('Scrub Apprentice');
    expect(levelFromRenown(160).level).toBe(2);
    expect(levelFromRenown(99999).level).toBe(10);
    expect(levelFromRenown(99999).toNext).toBeNull();
  });

  it('affinity ranks 0/1/2/3 by 30/80/150', () => {
    expect(affinityRank(0)).toBe(0);
    expect(affinityRank(29)).toBe(0);
    expect(affinityRank(30)).toBe(1);
    expect(affinityRank(80)).toBe(2);
    expect(affinityRank(150)).toBe(3);
  });

  it('dominant affinity: clear winner wins; tie or all-zero → null', () => {
    expect(dominantAffinity({ apothecary: 10, soapwright: 10, forgewright: 10 })).toBeNull();
    expect(dominantAffinity({ apothecary: 0, soapwright: 0, forgewright: 0 })).toBeNull();
    expect(dominantAffinity({ apothecary: 50, soapwright: 10, forgewright: 5 })).toBe('apothecary');
  });
});

describe('evaluator', () => {
  it('ch1 objectives complete from fabricated recipes', () => {
    const save = initialProgression();
    const sensor = sensorFor({
      hasFabricated: (r: string) =>
        ['RECIPE_CRAFT_FLINT_ADZE', 'RECIPE_CARVE_WOODEN_BUCKET', 'RECIPE_STITCH_BACKPACK'].includes(r),
    });
    const done = evaluateObjectives(save, sensor);
    expect(done).toContain('ch1_adze');
    expect(done).toContain('ch1_bucket');
    expect(done).toContain('ch1_pack');
    expect(done).not.toContain('ch1_ash');
  });

  it('idempotent: objectivesDone filter is sticky', () => {
    const save = initialProgression();
    const sensor = sensorFor({ hasFabricated: () => true });
    const first = evaluateObjectives(save, sensor);
    save.objectivesDone = [...save.objectivesDone, ...first];
    const second = evaluateObjectives(save, sensor);
    expect(second).toHaveLength(0);
  });

  it('applyProgressEvents awards renown on objective completion', () => {
    const save = initialProgression();
    const ev = applyProgressEvents(save, { kind: 'recipe', target: 'RECIPE_CRAFT_FLINT_ADZE' });
    expect(ev.objectives).toContain('ch1_adze');
    expect(save.renown).toBeGreaterThan(0);
    expect(save.affinity.soapwright).toBe(0);
  });

  it('letter claim applies renown + affinity exactly once', () => {
    const save = initialProgression();
    const sensor = sensorFor({
      hasFabricated: (id: string) => id === 'RECIPE_KNAP_FLINT',
    });
    const ev1 = applyProgressEventsWithSensor(save, { kind: 'recipe', target: 'RECIPE_KNAP_FLINT' }, sensor);
    expect(ev1.letters).toContain('l_riverfolk');
    const renownAfterClaim = save.renown;
    const ev2 = applyProgressEventsWithSensor(save, { kind: 'recipe', target: 'RECIPE_KNAP_FLINT' }, sensor);
    expect(save.renown).toBe(renownAfterClaim);
    expect(save.lettersDone.filter(id => id === 'l_riverfolk')).toHaveLength(1);
    expect(ev2.letters).toHaveLength(0);
  });

  it('currentChapter returns active chapter based on save state', () => {
    const save = initialProgression();
    const ch = currentChapter(save);
    expect(ch?.id).toBe('ch1');
  });
});
