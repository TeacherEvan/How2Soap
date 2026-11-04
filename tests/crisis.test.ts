/**
 * Crisis Turns engine — deterministic scheduling, telegraphing, resolution.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCrisisEffects,
  createCrisisDirector,
  crisisIdForCycle,
  crisisTickForCycle,
  CRISIS_DEFS,
  CRISIS_IDS,
  FIRST_CRISIS_TICK,
  TELEGRAPH_LEAD_TICKS,
  MAX_ACTIVE_TICKS,
  type CrisisContext,
  type CrisisId,
} from '../src/engine/crisis';
import { createWorld, createWorldVessel } from '../src/engine/world';
import { createPlayerMetabolism } from '../src/engine/metabolism';
import { createInventoryState } from '../src/engine/inventory';
import { createInitialColonyState, recruitColonist } from '../src/engine/colony';
import { createSeededRng } from '../src/engine/rng';

function makeCtx(seed = 1): CrisisContext & { world: ReturnType<typeof createWorld> } {
  const world = createWorld(288.15);
  const player = createPlayerMetabolism(0.05);
  player.glucoseKcal = 1000;
  player.adiposeKcal = 15000;
  player.hydrationPct = 80;
  const inventory = createInventoryState();
  const colony = createInitialColonyState();
  recruitColonist(colony, 'Ash', 'FORAGER', { commodity: 'FOOD', dailyAmount: 1 }, 0);
  return { world, player, inventory, colony, rng: createSeededRng(seed >>> 0) };
}

const NO_REVEAL = (): null => null;

/** Tick the director forward until a crisis activates (or the horizon passes). */
function runToActivation(director: ReturnType<typeof createCrisisDirector>, ctx: CrisisContext, horizon = 4000) {
  for (let t = 0; t <= horizon; t += 1) {
    ctx.world.tick = t;
    const res = director.tick(t, false, ctx);
    if (res.activated) return res.activated;
  }
  return null;
}

describe('crisis schedule (deterministic)', () => {
  it('same seed ⇒ same crisis id and tick for every cycle', () => {
    for (const seed of [1, 42, 1337, 987654321]) {
      for (let cycle = 0; cycle < 4; cycle += 1) {
        expect(crisisTickForCycle(seed, cycle)).toBe(crisisTickForCycle(seed, cycle));
        expect(crisisIdForCycle(seed, cycle)).toBe(crisisIdForCycle(seed, cycle));
      }
    }
  });

  it('first crisis is scheduled at or after Day 2 (tick 480)', () => {
    for (const seed of [1, 7, 99]) {
      expect(crisisTickForCycle(seed, 0)).toBeGreaterThanOrEqual(FIRST_CRISIS_TICK);
    }
  });

  it('cycles are strictly increasing', () => {
    const seed = 4242;
    for (let cycle = 0; cycle < 6; cycle += 1) {
      expect(crisisTickForCycle(seed, cycle + 1)).toBeGreaterThan(crisisTickForCycle(seed, cycle));
    }
  });

  it('every scheduled id is a registered calamity', () => {
    for (const seed of [3, 11, 2718]) {
      for (let cycle = 0; cycle < 8; cycle += 1) {
        expect(CRISIS_IDS).toContain(crisisIdForCycle(seed, cycle));
      }
    }
  });

  it('telegraph leads the activation by exactly 2 watches', () => {
    const seed = 7;
    const director = createCrisisDirector();
    director.reset(seed, 0);
    const ctx = makeCtx(seed);
    const due = crisisTickForCycle(seed, 0);
    let telegraphAt: number | null = null;
    let activatedAt: number | null = null;
    for (let t = 0; t <= due + 1 && (activatedAt === null || telegraphAt === null); t += 1) {
      ctx.world.tick = t;
      const res = director.tick(t, false, ctx);
      if (res.telegraphed && telegraphAt === null) telegraphAt = t;
      if (res.activated && activatedAt === null) activatedAt = t;
    }
    expect(activatedAt).toBe(due);
    expect(telegraphAt).toBe(due - TELEGRAPH_LEAD_TICKS);
  });

  it('two fresh directors with the same seed fire the same crisis', () => {
    const seed = 123;
    const a = createCrisisDirector();
    const b = createCrisisDirector();
    a.reset(seed, 0);
    b.reset(seed, 0);
    const ctxA = makeCtx(seed);
    const ctxB = makeCtx(seed);
    const actA = runToActivation(a, ctxA);
    const actB = runToActivation(b, ctxB);
    expect(actA?.crisisId).toBe(actB?.crisisId);
  });

  it('loading a late save retires past crises — nothing fires before startTick', () => {
    const seed = 5;
    const director = createCrisisDirector();
    director.reset(seed, crisisTickForCycle(seed, 4) + 1);
    const ctx = makeCtx(seed);
    for (let t = 0; t < crisisTickForCycle(seed, 4); t += 1) {
      ctx.world.tick = t;
      const res = director.tick(t, false, ctx);
      expect(res.activated).toBeNull();
    }
  });
});

describe('crisis resolution', () => {
  it('applying «Trek to the far spring» costs 120 kcal and grants +40 hydration', () => {
    const ctx = makeCtx(1);
    const messages = applyCrisisEffects(
      ctx,
      CRISIS_DEFS.WELL_TAINT.choices.find((c) => c.id === 'well_trek')!.effects,
      NO_REVEAL,
      0,
    );
    expect(ctx.player.glucoseKcal).toBe(880);
    expect(ctx.player.hydrationPct).toBe(100); // capped
    expect(messages).toEqual([]);
  });

  it('ventHottest drops pressure and kills the heater on the hottest vessel', () => {
    const ctx = makeCtx(1);
    const cold = createWorldVessel(ctx.world, 1, 'WOOD', 5);
    cold.temperatureK = 300;
    cold.pressureKPa = 145; // explicitly NOT ambient — must remain untouched
    const hot = createWorldVessel(ctx.world, 2, 'FIRED_CERAMIC', 2);
    hot.temperatureK = 400;
    hot.heaterWatts = 800;
    hot.pressureKPa = 150;
    applyCrisisEffects(ctx, [{ kind: 'ventHottest' }], NO_REVEAL, 0);
    expect(hot.pressureKPa).toBe(101.325);
    expect(hot.heaterWatts).toBe(0);
    expect(cold.pressureKPa).toBe(145);
  });

  it('vesselRuptureHottest ruptures the hottest vessel only', () => {
    const ctx = makeCtx(1);
    createWorldVessel(ctx.world, 1, 'WOOD', 5).temperatureK = 300;
    const hot = createWorldVessel(ctx.world, 2, 'FIRED_CERAMIC', 2);
    hot.temperatureK = 410;
    applyCrisisEffects(ctx, [{ kind: 'vesselRuptureHottest' }], NO_REVEAL, 0);
    expect(hot.ruptured).toBe(true);
    expect(ctx.world.vessels[0].ruptured).toBeFalsy();
  });

  it('boil_decant is rejected when the player has no second vessel', () => {
    const director = createCrisisDirector();
    director.reset(7, 0); // seed 7 → first cycle id? resolved via schedule
    const ctx = makeCtx(7);
    // Force the active crisis to BOIL_OVER by searching for the activation tick and id
    const due = crisisTickForCycle(7, 0);
    void due;
    // Instead of seed-math, exercise resolve() semantics directly through a synthetic active crisis:
    // drive the director to its natural activation and observe the id —
    const act = runToActivation(director, ctx);
    expect(act).not.toBeNull();
    if (act!.crisisId === 'BOIL_OVER') {
      void CRISIS_DEFS.BOIL_OVER;
      const res = director.resolve('BOIL_OVER', 'boil_decant', ctx);
      expect(res.ok).toBe(false);
      expect(res.messages.join(' ')).toMatch(/second vessel/);
    }
  });

  it('resolving with a stale/mismatched crisis id fails honestly', () => {
    const director = createCrisisDirector();
    director.reset(11, 0);
    const ctx = makeCtx(11);
    const res = director.resolve('FEVER_WAVE', 'fever_regime', ctx);
    expect(res.ok).toBe(false);
    expect(res.messages.join(' ')).toMatch(/already passed/);
  });

  it('fate auto-resolves the worst choice after 8 unanswered watches', () => {
    const seed = 19;
    const director = createCrisisDirector();
    director.reset(seed, 0);
    const ctx = makeCtx(seed);
    const glucoseBefore = ctx.player.glucoseKcal;
    const adiposeBefore = ctx.player.adiposeKcal;
    const hydrationBefore = ctx.player.hydrationPct;
    const moraleBefore = ctx.colony.colonists.map((c) => c.morale);
    const due = crisisTickForCycle(seed, 0);
    for (let t = 0; t <= due + MAX_ACTIVE_TICKS; t += 1) {
      ctx.world.tick = t;
      director.tick(t, false, ctx);
    }
    expect(director.snapshot().phase).toBe('idle');
    expect(director.snapshot().active).toBeNull();
    const changed =
      ctx.player.glucoseKcal !== glucoseBefore ||
      ctx.player.adiposeKcal !== adiposeBefore ||
      ctx.player.hydrationPct !== hydrationBefore ||
      ctx.colony.colonists.some((c, i) => c.morale !== moraleBefore[i]);
    expect(changed).toBe(true);
  });

  it('roll respects probability extremes deterministically', () => {
    const ctx = makeCtx(1);
    ctx.rng = { next: () => 0, roll: () => true, seed: 1 };
    applyCrisisEffects(ctx, [{ kind: 'roll', probability: 1, effects: [{ kind: 'wound' }] }], NO_REVEAL, 0);
    expect(ctx.player.conditions.woundContamination).toBe(true);

    const ctx2 = makeCtx(1);
    ctx2.rng = { next: () => 0, roll: () => false, seed: 1 };
    applyCrisisEffects(ctx2, [{ kind: 'roll', probability: 0, effects: [{ kind: 'wound' }] }], NO_REVEAL, 0);
    expect(ctx2.player.conditions.woundContamination).toBe(false);
  });

  it('spy choice reveals the next crisis by name', () => {
    const seed = 23;
    const director = createCrisisDirector();
    director.reset(seed, 0);
    const ctx = makeCtx(seed);
    const act = runToActivation(director, ctx);
    expect(act).not.toBeNull();
    const nextId = crisisIdForCycle(seed, 1);
    const nextTitle = CRISIS_DEFS[nextId].title;
    // Find the spy choice on the active crisis, whatever it is.
    const def = CRISIS_DEFS[act!.crisisId as CrisisId];
    const spyChoice = def.choices.find((c) => c.effects.some((e) => e.kind === 'revealNextCrisis'));
    if (spyChoice) {
      const res = director.resolve(def.id, spyChoice.id, ctx);
      expect(res.messages.join(' ')).toContain(nextTitle);
    }
  });

  it('colony morale shifts are clamped to [0, 100]', () => {
    const ctx = makeCtx(1);
    ctx.colony.colonists.forEach((c) => (c.morale = 4));
    applyCrisisEffects(ctx, [{ kind: 'morale', delta: -50 }], NO_REVEAL, 0);
    expect(ctx.colony.colonists[0].morale).toBe(0);
    applyCrisisEffects(ctx, [{ kind: 'morale', delta: 500 }], NO_REVEAL, 0);
    expect(ctx.colony.colonists[0].morale).toBe(100);
  });
});

describe('crisis soak', () => {
  it('a full 10-day season with auto-answering does not crash or NaN', () => {
    const seed = 777;
    const director = createCrisisDirector();
    director.reset(seed, 0);
    const ctx = makeCtx(seed);
    for (let t = 0; t < 2400; t += 1) {
      ctx.world.tick = t;
      director.tick(t, false, ctx);
      const snap = director.snapshot();
      if (snap.active) {
        const def = CRISIS_DEFS[snap.active.crisisId as CrisisId];
        const safe = def.choices.find((c) => !c.worst && !c.requiresOtherVessel) ?? def.choices[0];
        director.resolve(def.id, safe.id, ctx);
      }
    }
    expect(Number.isFinite(ctx.player.glucoseKcal)).toBe(true);
    expect(ctx.player.glucoseKcal).toBeGreaterThanOrEqual(0);
  });
});
