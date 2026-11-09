import { describe, it, expect } from 'vitest';
import {
  AGE_CIVS,
  updateTechMaturity,
  resolveAgeTransition,
  startTeachTheRealm,
  stepTeachTheRealm,
  type TechNode,
} from '../src/engine/campaign/dormant/ageTransitions';
import {
  createInitialBuiltWorks,
  constructBuiltWork,
  BUILT_WORKS_DEFS,
} from '../src/engine/campaign/builtWorks';
import {
  createInitialExchange,
  registerCodexRecipe,
  updateProvenance,
  tradeRecipe,
} from '../src/engine/campaign/dormant/codexExchange';
import {
  createInitialMissions,
  executeMission,
  computeMissionProbabilities,
  MISSIONS_CATALOG,
} from '../src/engine/campaign/missions';
import {
  createInitialNotables,
  startCohortTrial,
  stepCohortTrials,
} from '../src/engine/campaign/dormant/notables';
import {
  createInitialIncursions,
  spawnIncursion,
  resolveIncursion,
} from '../src/engine/campaign/dormant/incursions';
import { getPatronEnding } from '../src/engine/campaign/patron';
import {
  executeDeepMineOrder,
  resolveCaveInResponse,
} from '../src/engine/campaign/dormant/deepMine';

describe('Milestone M7: Age Transitions & Tech Maturity', () => {
  it('defines 8 civs across Ages I, II, and III', () => {
    expect(AGE_CIVS.length).toBeGreaterThanOrEqual(8);
    const age2Civs = AGE_CIVS.filter((c) => c.age === 2);
    const age3Civs = AGE_CIVS.filter((c) => c.age === 3);
    expect(age2Civs.length).toBe(3);
    expect(age3Civs.length).toBe(2);
  });

  it('progresses tech maturity through Invention -> Practice -> Doctrine', () => {
    const testNode: TechNode = {
      id: 'test_node',
      name: 'Test Metallurgy',
      age: 2,
      category: 'SCIENCE',
      description: 'Test',
      doctrineSpecialEffect: 'Test effect',
      maturity: 0,
      userSettlementCount: 0,
      isUnlocked: true,
    };

    updateTechMaturity(testNode, 0);
    expect(testNode.maturity).toBe(0); // Invention

    updateTechMaturity(testNode, 1);
    expect(testNode.maturity).toBe(1); // Practice

    updateTechMaturity(testNode, 3);
    expect(testNode.maturity).toBe(2); // Doctrine
  });

  it('resolves Golden Age vs Dark Age transitions based on attribute points and health', () => {
    const golden = resolveAgeTransition(1, 5, 80);
    expect(golden.newAge).toBe(2);
    expect(golden.isGoldenAge).toBe(true);

    const dark = resolveAgeTransition(1, 2, 40);
    expect(dark.newAge).toBe(2);
    expect(dark.isGoldenAge).toBe(false);
  });

  it('runs TEACH_THE_REALM over a 3-turn broadcast granting permanent health & safety', () => {
    const { state: init } = startTeachTheRealm('tech_caustic_leach');
    expect(init.isBroadcasting).toBe(true);
    expect(init.turnsRemaining).toBe(3);

    const turn1 = stepTeachTheRealm(init);
    expect(turn1.state.turnsRemaining).toBe(2);

    const turn2 = stepTeachTheRealm(turn1.state);
    expect(turn2.state.turnsRemaining).toBe(1);

    const turn3 = stepTeachTheRealm(turn2.state);
    expect(turn3.state.spreadCompleted).toBe(true);
    expect(turn3.healthBonus).toBe(10);
    expect(turn3.safetyBonus).toBe(10);
  });
});

describe('Milestone M7: Deep Mining & Cave-In Crisis', () => {
  it('executes DEEP_MINE order granting 2.5x ore yields and evaluating cave-in risk', () => {
    const noCharges = executeDeepMineOrder('settlement_1', 0);
    expect(noCharges.ok).toBe(false);

    // Roll below threshold triggers cave-in
    const blastRisk = executeDeepMineOrder('settlement_1', 2, 0.1);
    expect(blastRisk.ok).toBe(true);
    expect(blastRisk.oreYieldMultiplier).toBe(2.5);
    expect(blastRisk.caveInTriggered).toBe(true);

    // Roll above threshold runs cleanly
    const blastClean = executeDeepMineOrder('settlement_1', 2, 0.8);
    expect(blastClean.caveInTriggered).toBe(false);
  });

  it('resolves cave-in responses deterministically', () => {
    const timber = resolveCaveInResponse('TIMBER_UP', true);
    expect(timber.productionStalledTurns).toBe(0);
    expect(timber.moraleDelta).toBe(2);

    const abandon = resolveCaveInResponse('EVACUATE');
    expect(abandon.productionStalledTurns).toBe(3);
    expect(abandon.moraleDelta).toBe(-4);
  });
});

describe('Milestone M7: Built Works Engine', () => {
  it('constructs Lime-Cement sewer outfalls granting +2 Health/turn', () => {
    const initial = createInitialBuiltWorks();
    expect(initial.activeHealthBonusPerTurn).toBe(0);

    const res = constructBuiltWork(initial, 'work_lime_cement');
    expect(res.ok).toBe(true);
    expect(res.state.works['work_lime_cement']).toBe(true);
    expect(res.state.activeHealthBonusPerTurn).toBe(2);
    expect(res.state.engineeringCanonCount).toBe(1);

    // Duplicate construction is rejected
    const dup = constructBuiltWork(res.state, 'work_lime_cement');
    expect(dup.ok).toBe(false);
  });

  it('registers all 6 spec-defined built works', () => {
    expect(BUILT_WORKS_DEFS.length).toBe(6);
    const ids = BUILT_WORKS_DEFS.map((w) => w.id);
    expect(ids).toContain('work_lime_cement');
    expect(ids).toContain('work_leather_rope');
    expect(ids).toContain('work_casein_glue');
    expect(ids).toContain('work_acids_engraving');
    expect(ids).toContain('work_wood_composite');
    expect(ids).toContain('work_military_engines');
  });
});

describe('Milestone M7: The Codex & Alchemist Exchange', () => {
  it('stores fabricated recipes and enforces forward-only provenance', () => {
    const state = createInitialExchange(['RECIPE_COLD_SOAP']);
    expect(state.codex['RECIPE_COLD_SOAP'].provenance).toBe('SECRET');

    const p1 = updateProvenance(state, 'RECIPE_COLD_SOAP', 'DIVULGED');
    expect(p1.ok).toBe(true);

    const p2 = updateProvenance(state, 'RECIPE_COLD_SOAP', 'PATENT');
    expect(p2.ok).toBe(true);

    // Backward transition is rejected
    const bad = updateProvenance(state, 'RECIPE_COLD_SOAP', 'SECRET');
    expect(bad.ok).toBe(false);
  });

  it('sells recipes to foreign brokers and tracks sold items', () => {
    const state = createInitialExchange();
    registerCodexRecipe(state, 'RECIPE_FINE_LYE', 'Fine Lye Process', 5);

    const res = tradeRecipe(state, {
      recipeId: 'RECIPE_FINE_LYE',
      brokerId: 'broker_rott_callaghan',
      scope: 'sell',
      tradeBalance: 10,
    });

    expect(res.ok).toBe(true);
    expect(res.tradeDelta).toBeGreaterThan(0);
    expect(state.soldRecipeIds).toContain('RECIPE_FINE_LYE');
  });

  it('simulates schema theft with exposure risk', () => {
    const state = createInitialExchange();

    // With low roll, theft is exposed
    const exposed = tradeRecipe(state, {
      recipeId: 'RECIPE_MURIATIC_ETHER',
      brokerId: 'broker_brass_verger',
      scope: 'steal',
      tradeBalance: 0,
      rngRoll: 0.1, // triggers 35% exposure
    });
    expect(exposed.exposureRiskFired).toBe(true);
    expect(exposed.publicDelta).toBe(-4);
    expect(state.stolenRecipeIds).toContain('RECIPE_MURIATIC_ETHER');
  });
});

describe('Milestone M7: Missions & Operatives', () => {
  it('computes accurate probability triads and executes mission', () => {
    const state = createInitialMissions();
    const op = state.operatives[0]; // Milo Swift (Courier, Subtle 3)
    const scoutMission = MISSIONS_CATALOG.find((m) => m.verb === 'SCOUT')!;

    const probs = computeMissionProbabilities(op, scoutMission);
    expect(probs.cleanPct).toBeGreaterThan(probs.disasterPct);

    // Roll a clean outcome
    const cleanRes = executeMission(state, op.id, 'SCOUT', 0.1);
    expect(cleanRes.outcome).toBe('CLEAN');
    expect(cleanRes.success).toBe(true);
  });

  it('permanently dismisses an operative who fails twice for cowardice', () => {
    const state = createInitialMissions();
    const op = state.operatives[1]; // Alchemist Ren

    // Force 2 disaster rolls
    const r1 = executeMission(state, op.id, 'STEAL_SCHEMA', 0.99);
    expect(r1.success).toBe(false);
    expect(op.failureCount).toBe(1);
    expect(op.isDismissed).toBe(false);

    const r2 = executeMission(state, op.id, 'STEAL_SCHEMA', 0.99);
    expect(r2.success).toBe(false);
    expect(op.failureCount).toBe(2);
    expect(op.isDismissed).toBe(true);
    expect(r2.operativeDismissed).toBe(true);
  });
});

describe('Milestone M7: Notable Citizens & Cohort Clinical Trials', () => {
  it('initializes 24 notable citizens tracked by name and role', () => {
    const state = createInitialNotables();
    expect(state.citizens.length).toBe(24);
    const berto = state.citizens.find((c) => c.name.includes('Berto'));
    expect(berto).toBeDefined();
    expect(berto?.role).toBe('COLLIER');
  });

  it('completes a 3-turn cohort trial, unlocking precision perks and Innovation', () => {
    const state = createInitialNotables();
    const start = startCohortTrial(state, 'MINER', 'WILLOW_TEA', 1);
    expect(start.ok).toBe(true);

    stepCohortTrials(state); // Turn 1
    stepCohortTrials(state); // Turn 2
    const finalTurn = stepCohortTrials(state); // Turn 3

    expect(finalTurn.completedTrials.length).toBe(1);
    expect(finalTurn.innovationGained).toBe(3);
    expect(state.unlockedDosePerks).toContain('PERK_WILLOW_TEA_PRECISION');
  });
});

describe('Milestone M7: Territorial Contest & Incursions v2', () => {
  it('captures an under-defended frontier settlement', () => {
    const state = createInitialIncursions();
    const inc = spawnIncursion(state, {
      name: 'Rival March Vanguard',
      type: 'RIVAL_MARCH',
      attackerFaction: 'The Ember Republic',
      targetSettlementId: 'frontier_outpost_1',
      targetSettlementName: 'Red Bluff Outpost',
      strength: 4,
    });

    // Guard count 0 on frontier -> capture occurs
    const res = resolveIncursion(state, inc.id, 'DEFEND', 0, 50, true);
    expect(res.settlementCaptured).toBe(true);
    expect(res.estateDeltas.army).toBe(-10);
  });
});

describe('Milestone M7: Patron Arc Endings', () => {
  it('returns authored ending hooks for all 5 patrons', () => {
    const vane = getPatronEnding('odric_vane');
    expect(vane.endingTitle).toContain('Marshal');

    const serafine = getPatronEnding('madame_serafine');
    expect(serafine.endingTitle).toContain('High Chancellor');

    const aurel = getPatronEnding('sister_aurel');
    expect(aurel.endingTitle).toContain('Primate');

    const witch = getPatronEnding('hedge_witch');
    expect(witch.endingTitle).toContain('Quiet Saint');
  });
});
