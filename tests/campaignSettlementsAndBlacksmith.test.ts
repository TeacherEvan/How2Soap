import { describe, it, expect } from 'vitest';
import {
  createInitialSettlementsState,
  foundSettlement,
  upgradeSettlementKind,
  recomputeSettlementYields,
} from '../src/engine/campaign/settlements';
import {
  createBlacksmithState,
  startBatchJob,
  stepBlacksmith,
} from '../src/engine/campaign/blacksmith';
import { HIRE_TIERS } from '../src/engine/campaign/dormant/hires';

describe('Milestone M4: Settlements, Blacksmith & Tiered Hires (§6.4, §6.19.1, §6.20.2)', () => {
  describe('Settlements & Municipal Yields', () => {
    it('initializes with capital at Hearth and baseline yields', () => {
      const state = createInitialSettlementsState('The Hearth');
      expect(state.settlements).toHaveLength(1);
      expect(state.settlements[0].isCapital).toBe(true);
      expect(state.settlementLimit).toBe(3);
      expect(state.globalYields.food).toBeGreaterThan(0);
      expect(state.globalYields.production).toBeGreaterThan(0);
    });

    it('founds a new settlement and expands yield base', () => {
      const state = createInitialSettlementsState('The Hearth');
      const res = foundSettlement(state, { name: 'Millstreet', q: 2, r: 1, currentDay: 4 });
      expect(res.ok).toBe(true);
      expect(state.settlements).toHaveLength(2);
      expect(state.globalYields.food).toBeGreaterThan(4);
    });

    it('enforces settlement limit with morale penalty when over limit', () => {
      const state = createInitialSettlementsState('The Hearth');
      foundSettlement(state, { name: 'Town 1', q: 1, r: 0, currentDay: 2 });
      foundSettlement(state, { name: 'Town 2', q: 2, r: 0, currentDay: 3 });
      recomputeSettlementYields(state);
      const baselineMorale = state.globalYields.morale;

      // 4th settlement (limit is 3)
      foundSettlement(state, { name: 'Town 3', q: 3, r: 0, currentDay: 4 });
      recomputeSettlementYields(state);
      expect(state.globalYields.morale).toBe(baselineMorale - 4);
    });

    it('upgrades settlement from Camp to Town to City', () => {
      const state = createInitialSettlementsState('The Hearth');
      const capital = state.settlements[0];
      expect(capital.kind).toBe('CAMP');

      upgradeSettlementKind(capital);
      expect(capital.kind).toBe('TOWN');

      upgradeSettlementKind(capital);
      expect(capital.kind).toBe('CITY');
    });
  });

  describe('The Blacksmith Engine', () => {
    it('queues and completes batch jobs with correct turn decrement', () => {
      const smith = createBlacksmithState();
      const job = startBatchJob(smith, {
        recipeId: 'BATCH_SPEARS',
        name: 'Bronze Spears',
        batchCount: 8,
        turns: 2,
        outputs: [{ itemId: 'BRONZE_SPEAR', count: 8 }],
      });

      expect(smith.jobs).toHaveLength(1);
      expect(job.turnsLeft).toBe(2);

      const step1 = stepBlacksmith(smith);
      expect(step1.completedJobs).toHaveLength(0);
      expect(smith.jobs[0].turnsLeft).toBe(1);

      const step2 = stepBlacksmith(smith);
      expect(step2.completedJobs).toHaveLength(1);
      expect(step2.completedJobs[0].id).toBe(job.id);
      expect(smith.jobs).toHaveLength(0);
    });

    it('triggers tool degradation maintenance alert after 40 turns', () => {
      const smith = createBlacksmithState();
      for (let i = 0; i < 39; i++) {
        const res = stepBlacksmith(smith);
        expect(res.toolDegraded).toBe(false);
      }
      const res40 = stepBlacksmith(smith);
      expect(res40.toolDegraded).toBe(true);
      expect(smith.maintenanceAlert).toBe(true);
    });
  });

  describe('National Labor Market Hires Tiers', () => {
    it('defines 5 distinct hire tiers with clear estate signals', () => {
      expect(HIRE_TIERS).toHaveLength(5);
      const locals = HIRE_TIERS.find((h) => h.tier === 'LOCALS');
      const gangsters = HIRE_TIERS.find((h) => h.tier === 'GANGSTERS');
      expect(locals?.estateDeltas.public).toBeGreaterThan(0);
      expect(gangsters?.estateDeltas.public).toBeLessThan(0);
      expect(gangsters?.estateDeltas.crown).toBeLessThan(0);
    });
  });
});
