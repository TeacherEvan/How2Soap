import { describe, expect, it } from 'vitest';
import {
  createInitialLedger,
  stepLedgerDay,
  fulfillSlot,
  acceptSlot,
  getDayWellSpentBonus,
  type LedgerState,
} from '../src/engine/campaign/ledger';

describe('Crown\'s Ledger (ES-2)', () => {
  describe('initialization', () => {
    it('creates ledger with 3 slots (craft, care, civic)', () => {
      const ledger = createInitialLedger(12345);
      expect(ledger.day).toBe(1);
      expect(ledger.slots).toHaveLength(3);
      expect(ledger.streak).toBe(0);
      expect(ledger.bestStreak).toBe(0);
      
      const families = ledger.slots.map(s => s.family).sort();
      expect(families).toEqual(['care', 'civic', 'craft']);
      
      // All slots start as available
      expect(ledger.slots.every(s => s.status === 'available')).toBe(true);
      expect(ledger.slots.every(s => s.deadlineDay === 1)).toBe(true);
    });

    it('is deterministic for same seed', () => {
      const ledger1 = createInitialLedger(42);
      const ledger2 = createInitialLedger(42);
      
      expect(ledger1.slots.map(s => s.id)).toEqual(ledger2.slots.map(s => s.id));
      expect(ledger1.slots.map(s => s.text)).toEqual(ledger2.slots.map(s => s.text));
      expect(ledger1.slots.map(s => s.rewardRenown)).toEqual(ledger2.slots.map(s => s.rewardRenown));
    });
  });

  describe('slot acceptance and fulfillment', () => {
    it('acceptSlot changes status from available to accepted', () => {
      const ledger = createInitialLedger(123);
      const slotId = ledger.slots[0].id;
      
      const ok = acceptSlot(ledger, slotId);
      expect(ok).toBe(true);
      
      const slot = ledger.slots.find(s => s.id === slotId);
      expect(slot?.status).toBe('accepted');
    });

    it('acceptSlot fails on non-available slot', () => {
      const ledger = createInitialLedger(123);
      const slotId = ledger.slots[0].id;
      
      acceptSlot(ledger, slotId);
      const ok = acceptSlot(ledger, slotId);
      expect(ok).toBe(false);
    });

    it('fulfillSlot changes status from accepted to fulfilled', () => {
      const ledger = createInitialLedger(123);
      const slotId = ledger.slots[0].id;
      
      acceptSlot(ledger, slotId);
      const ok = fulfillSlot(ledger, slotId);
      expect(ok).toBe(true);
      
      const slot = ledger.slots.find(s => s.id === slotId);
      expect(slot?.status).toBe('fulfilled');
    });

    it('fulfillSlot fails on non-accepted slot', () => {
      const ledger = createInitialLedger(123);
      const slotId = ledger.slots[0].id;
      
      const ok = fulfillSlot(ledger, slotId);
      expect(ok).toBe(false);
    });
  });

  describe('day advancement and streak tracking', () => {
    it('stepLedgerDay advances day and rotates slots', () => {
      const ledger = createInitialLedger(123);
      const day1Slots = ledger.slots.map(s => s.id);
      
      stepLedgerDay(ledger);
      
      expect(ledger.day).toBe(2);
      const day2Slots = ledger.slots.map(s => s.id);
      expect(day2Slots).not.toEqual(day1Slots); // Slots rotated
      expect(ledger.slots.every(s => s.status === 'available')).toBe(true); // Reset to available
    });

    it('increments streak when all 3 fulfilled', () => {
      const ledger = createInitialLedger(123);
      
      // Fulfill all 3 slots
      ledger.slots.forEach(s => {
        acceptSlot(ledger, s.id);
        fulfillSlot(ledger, s.id);
      });
      
      const day1Streak = ledger.streak;
      stepLedgerDay(ledger);
      
      expect(ledger.streak).toBe(day1Streak + 1);
      expect(ledger.bestStreak).toBe(ledger.streak);
    });

    it('resets streak when not all fulfilled', () => {
      const ledger = createInitialLedger(123);
      ledger.streak = 3;
      
      // Only fulfill 2 slots
      acceptSlot(ledger, ledger.slots[0].id);
      fulfillSlot(ledger, ledger.slots[0].id);
      acceptSlot(ledger, ledger.slots[1].id);
      fulfillSlot(ledger, ledger.slots[1].id);
      // 3rd slot left available
      
      stepLedgerDay(ledger);
      
      expect(ledger.streak).toBe(0);
    });

    it('updates bestStreak correctly', () => {
      const ledger = createInitialLedger(123);
      
      // First day: all fulfilled -> streak = 1
      ledger.slots.forEach(s => { acceptSlot(ledger, s.id); fulfillSlot(ledger, s.id); });
      stepLedgerDay(ledger);
      expect(ledger.streak).toBe(1);
      expect(ledger.bestStreak).toBe(1);
      
      // Second day: all fulfilled -> streak = 2
      ledger.slots.forEach(s => { acceptSlot(ledger, s.id); fulfillSlot(ledger, s.id); });
      stepLedgerDay(ledger);
      expect(ledger.streak).toBe(2);
      expect(ledger.bestStreak).toBe(2);
      
      // Third day: fail -> streak resets, best stays 2
      ledger.slots[0].status = 'available'; // Only 2 fulfilled
      stepLedgerDay(ledger);
      expect(ledger.streak).toBe(0);
      expect(ledger.bestStreak).toBe(2);
    });
  });

  describe('Day Well Spent bonus', () => {
    it('returns bonus when all 3 fulfilled', () => {
      const ledger = createInitialLedger(123);
      ledger.slots.forEach(s => { acceptSlot(ledger, s.id); fulfillSlot(ledger, s.id); });
      
      const bonus = getDayWellSpentBonus(ledger);
      expect(bonus).not.toBeNull();
      expect(bonus?.moraleBonus).toBe(6);
      expect(bonus?.message).toContain('Day Well Spent');
      expect(bonus?.message).toContain('+6 morale');
    });

    it('returns null when not all fulfilled', () => {
      const ledger = createInitialLedger(123);
      acceptSlot(ledger, ledger.slots[0].id);
      fulfillSlot(ledger, ledger.slots[0].id);
      // Other 2 not fulfilled
      
      const bonus = getDayWellSpentBonus(ledger);
      expect(bonus).toBeNull();
    });
  });

  describe('deterministic replay', () => {
    it('produces byte-identical ledger state for same seed across 2 runs', () => {
      const simulateDays = (seed: number, days: number): LedgerState => {
        const ledger = createInitialLedger(seed);
        for (let d = 1; d <= days; d++) {
          // Deterministic acceptance/fulfillment pattern
          ledger.slots.forEach((_s, i) => {
            if (i < 2 || d % 2 === 0) { // Deterministic pattern
              acceptSlot(ledger, ledger.slots.find(s => s.id === ledger.slots[i].id)!.id);
              fulfillSlot(ledger, ledger.slots.find(s => s.id === ledger.slots[i].id)!.id);
            }
          });
          stepLedgerDay(ledger);
        }
        return ledger;
      };

      const ledger1 = simulateDays(42, 10);
      const ledger2 = simulateDays(42, 10);
      
      // Compare serialized state
      const ser1 = JSON.stringify(ledger1);
      const ser2 = JSON.stringify(ledger2);
      expect(ser1).toBe(ser2);
    });

    it('save round-trip is clean (serialization preserves all fields)', () => {
      const ledger = createInitialLedger(999);
      
      // Simulate some days
      for (let d = 0; d < 5; d++) {
        ledger.slots.forEach(s => {
          acceptSlot(ledger, s.id);
          fulfillSlot(ledger, s.id);
        });
        stepLedgerDay(ledger);
      }
      
      // Serialize and deserialize
      const serialized = JSON.stringify(ledger);
      const deserialized: typeof ledger = JSON.parse(serialized);
      
      expect(deserialized.day).toBe(ledger.day);
      expect(deserialized.streak).toBe(ledger.streak);
      expect(deserialized.bestStreak).toBe(ledger.bestStreak);
      expect(deserialized.rngSeed).toBe(ledger.rngSeed);
      expect(deserialized.slots).toHaveLength(3);
      expect(deserialized.slots.map(s => s.id)).toEqual(ledger.slots.map(s => s.id));
      expect(deserialized.slots.map(s => s.status)).toEqual(ledger.slots.map(s => s.status));
    });
  });

  describe('slot rotation determinism', () => {
    it('rotateSlots produces same slots for same day and seed', () => {
      const ledger1 = createInitialLedger(42);
      const ledger2 = createInitialLedger(42);
      
      // Advance both to day 5
      for (let d = 0; d < 4; d++) {
        stepLedgerDay(ledger1);
        stepLedgerDay(ledger2);
      }
      
      expect(ledger1.slots.map(s => s.id)).toEqual(ledger2.slots.map(s => s.id));
      expect(ledger1.slots.map(s => s.text)).toEqual(ledger2.slots.map(s => s.text));
    });
  });
});