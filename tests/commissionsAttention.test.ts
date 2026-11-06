import { describe, it, expect } from 'vitest';
import {
  generateDailyCommissions,
  evaluateCommissions,
  claimCommission,
  createInitialCommissionsState,
} from '../src/engine/commissions';
import { computeAllBadges, getAggregateBadge } from '../src/ui/tileAttention';

describe('Spec 2: Commissions & Tile Attention Engine', () => {
  describe('Daily Commissions Generation', () => {
    it('produces exactly 3 distinct commissions per day', () => {
      const comms = generateDailyCommissions(1, 1337);
      expect(comms).toHaveLength(3);
      const ids = new Set(comms.map((c) => c.id));
      expect(ids.size).toBe(3);
    });

    it('is deterministic for the same day and seed', () => {
      const run1 = generateDailyCommissions(3, 42);
      const run2 = generateDailyCommissions(3, 42);
      expect(run1).toEqual(run2);
    });

    it('varies across different days', () => {
      const day1 = generateDailyCommissions(1, 42);
      const day2 = generateDailyCommissions(2, 42);
      expect(day1.map((c) => c.id)).not.toEqual(day2.map((c) => c.id));
    });
  });

  describe('Commission Evaluation & Claiming', () => {
    it('evaluates progress and triggers completion when target reached', () => {
      const commState = createInitialCommissionsState(1);
      commState.active = [
        {
          id: 'vigor',
          label: 'Vigor test',
          progress: 0,
          target: 45,
          renownReward: 10,
          complete: false,
          claimed: false,
        },
      ];

      const clientState = { realm: { vigor: 50 } };
      const { hasNewCompletion } = evaluateCommissions(commState, null, clientState);
      expect(hasNewCompletion).toBe(true);
      expect(commState.active[0].complete).toBe(true);
      expect(commState.active[0].progress).toBe(45);
    });

    it('handles manual claiming and advances streaks', () => {
      const commState = createInitialCommissionsState(1);
      commState.active = [
        {
          id: 'vigor',
          label: 'Vigor test',
          progress: 45,
          target: 45,
          renownReward: 10,
          complete: true,
          claimed: false,
        },
      ];

      // Claim on Day 1
      const res1 = claimCommission(commState, 'vigor', 1);
      expect(res1.success).toBe(true);
      expect(res1.renownReward).toBe(10);
      expect(commState.streak).toBe(1);
      expect(commState.lastClaimDay).toBe(1);

      // Claim on Day 2
      commState.active[0].claimed = false;
      const res2 = claimCommission(commState, 'vigor', 2);
      expect(res2.success).toBe(true);
      expect(commState.streak).toBe(2);
      expect(commState.lastClaimDay).toBe(2);

      // Miss Day 3, claim on Day 4 -> streak resets to 1
      commState.active[0].claimed = false;
      const res3 = claimCommission(commState, 'vigor', 4);
      expect(res3.success).toBe(true);
      expect(commState.streak).toBe(1);
      expect(commState.lastClaimDay).toBe(4);
    });

    it('flags 7-day milestone streak', () => {
      const commState = createInitialCommissionsState(7);
      commState.streak = 6;
      commState.lastClaimDay = 6;
      commState.active = [
        {
          id: 'vigor',
          label: 'Vigor test',
          progress: 45,
          target: 45,
          renownReward: 10,
          complete: true,
          claimed: false,
        },
      ];

      const res = claimCommission(commState, 'vigor', 7);
      expect(res.streakMilestone).toBe(true);
      expect(commState.streak).toBe(7);
    });
  });

  describe('Tile Attention & Badges', () => {
    it('detects crisis when vessel pressure or pH is dangerous', () => {
      const clientState = {
        vessels: [
          { id: 'v1', pressure: 100, maxPressure: 100 }, // 100% > 95%
        ],
      };
      const badges = computeAllBadges(null, clientState);
      expect(badges.get('reactions')?.level).toBe('crisis');
    });

    it('detects strike crisis or low mandate for settlement', () => {
      const clientState = {
        colony: { colonists: [{ id: 'c1', morale: 15 }] },
        realm: { mandate: 50 },
      };
      const badges = computeAllBadges(null, clientState);
      expect(badges.get('settlement')?.level).toBe('crisis');
    });

    it('aggregates badges by priority: crisis > action > info', () => {
      const map = new Map<string, any>([
        ['chronicle', { level: 'info', label: 'Unread log' }],
        ['commissions', { level: 'action', label: 'Ready to claim' }],
        ['reactions', { level: 'crisis', label: 'Pressure warning' }],
      ]);
      const agg = getAggregateBadge(map);
      expect(agg?.level).toBe('crisis');
    });
  });
});
