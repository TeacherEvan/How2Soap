import { describe, expect, it } from 'vitest';
import {
  computeCouplingEffects,
  applyCouplingsToMiniGame,
  rollSpoilage,
  createCouplingRng,
} from '../src/engine/campaign/couplings';
import { SoapKettleMiniGame } from '../src/ui/SoapKettleMiniGame';

describe('Colony ↔ Chemistry Couplings (ES-3)', () => {
  describe('flag fencing & default state', () => {
    it('returns null effects when coupling is disabled (flag off)', () => {
      const effects = computeCouplingEffects(
        { enabled: false, rngSeed: 42 },
        {
          colonists: [
            { archetype: 'APPRENTICE_CHEMIST', assignedVessel: 0 },
            { archetype: 'FORAGER', status: 'CRASH', assignedVessel: 1 },
          ],
        }
      );

      expect(effects.laborQuality).toBeNull();
      expect(effects.unrestSpoilage).toBeNull();
      expect(effects.crashClumsiness).toBeNull();
    });

    it('base mini-game config is unchanged when effects are null', () => {
      const base = {
        targetStrokes: 12,
        phase2MinTemp: 80,
        phase2MaxTemp: 95,
        phase1Tolerance: 10,
        phase2Tolerance: 7.5,
      };

      const modified = applyCouplingsToMiniGame(base, {
        laborQuality: null,
        unrestSpoilage: null,
        crashClumsiness: null,
      });

      expect(modified).toEqual(base);
    });
  });

  describe('labor → quality effect', () => {
    it('activates when APPRENTICE_CHEMIST is assigned to a vessel', () => {
      const effects = computeCouplingEffects(
        { enabled: true, rngSeed: 42 },
        {
          colonists: [
            { archetype: 'APPRENTICE_CHEMIST', assignedVessel: 0, morale: 50 },
            { archetype: 'MINER', morale: 50 },
          ],
        }
      );

      expect(effects.laborQuality).not.toBeNull();
      expect(effects.laborQuality?.traceTargetReduction).toBe(3); // 12 -> 9
      expect(effects.laborQuality?.phase2BandWiden).toBe(2); // 80-95 -> 78-96 °C
      expect(effects.unrestSpoilage).toBeNull();
      expect(effects.crashClumsiness).toBeNull();
    });

    it('modifies minigame target strokes and temperature band', () => {
      const base = {
        targetStrokes: 12,
        phase2MinTemp: 80,
        phase2MaxTemp: 95,
        phase1Tolerance: 10,
        phase2Tolerance: 7.5,
      };

      const modified = applyCouplingsToMiniGame(base, {
        laborQuality: { traceTargetReduction: 3, phase2BandWiden: 2 },
        unrestSpoilage: null,
        crashClumsiness: null,
      });

      expect(modified.targetStrokes).toBe(9);
      expect(modified.phase2MinTemp).toBe(78);
      expect(modified.phase2MaxTemp).toBe(97);
    });

    it('SoapKettleMiniGame adopts reduced target strokes when applied', () => {
      const game = new SoapKettleMiniGame();
      game.applyCouplingEffects({
        laborQuality: { traceTargetReduction: 3, phase2BandWiden: 2 },
      });
      expect(game.targetStrokes).toBe(9);
    });
  });

  describe('unrest → spoilage effect', () => {
    it('activates on mean morale < 40', () => {
      const effects = computeCouplingEffects(
        { enabled: true, rngSeed: 42 },
        {
          colonists: [
            { archetype: 'MINER', morale: 30 },
            { archetype: 'FORAGER', morale: 35 },
          ],
        }
      );

      expect(effects.unrestSpoilage).not.toBeNull();
      expect(effects.unrestSpoilage?.spoilageChance).toBe(0.15);
      expect(effects.unrestSpoilage?.ruptureSeverityIncrease).toBe(1);
    });

    it('activates when a colonist is on STRIKE', () => {
      const effects = computeCouplingEffects(
        { enabled: true, rngSeed: 42 },
        {
          colonists: [
            { archetype: 'MINER', morale: 80, status: 'STRIKE' },
            { archetype: 'FORAGER', morale: 80, status: 'IDLE' },
          ],
        }
      );

      expect(effects.unrestSpoilage).not.toBeNull();
      expect(effects.unrestSpoilage?.spoilageChance).toBe(0.15);
    });

    it('deterministic spoilage rolls with seeded RNG', () => {
      const rng1 = createCouplingRng(12345);
      const rng2 = createCouplingRng(12345);

      const rolls1 = Array.from({ length: 20 }, () => rollSpoilage(rng1, 0.15));
      const rolls2 = Array.from({ length: 20 }, () => rollSpoilage(rng2, 0.15));

      expect(rolls1).toEqual(rolls2);
      expect(rolls1.some(r => r === true)).toBe(true); // at least one spoilage event in 20 rolls
    });
  });

  describe('crash → clumsiness effect', () => {
    it('activates when colonist in CRASH phase is assigned to a vessel or in colony', () => {
      const effects = computeCouplingEffects(
        { enabled: true, rngSeed: 42 },
        {
          colonists: [
            { archetype: 'FORAGER', status: 'CRASH', assignedVessel: 2, morale: 50 },
            { archetype: 'MINER', status: 'IDLE', morale: 50 },
          ],
        }
      );

      expect(effects.crashClumsiness).not.toBeNull();
      expect(effects.crashClumsiness?.phase1ToleranceReduction).toBe(4);
      expect(effects.crashClumsiness?.phase2BandReduction).toBe(4);
    });

    it('activates when colonist has activeStimulant.phase === CRASH', () => {
      const effects = computeCouplingEffects(
        { enabled: true, rngSeed: 42 },
        {
          colonists: [
            {
              archetype: 'MINER',
              status: 'TRAVELING',
              morale: 50,
              activeStimulant: { phase: 'CRASH' },
            },
          ],
        }
      );

      expect(effects.crashClumsiness).not.toBeNull();
      expect(effects.crashClumsiness?.phase1ToleranceReduction).toBe(4);
      expect(effects.crashClumsiness?.phase2BandReduction).toBe(4);
    });

    it('reduces phase 1 tolerance in applyCouplingsToMiniGame', () => {
      const base = {
        targetStrokes: 12,
        phase2MinTemp: 80,
        phase2MaxTemp: 95,
        phase1Tolerance: 10,
        phase2Tolerance: 7.5,
      };

      const modified = applyCouplingsToMiniGame(base, {
        laborQuality: null,
        unrestSpoilage: null,
        crashClumsiness: { phase1ToleranceReduction: 4, phase2BandReduction: 4 },
      });

      expect(modified.phase1Tolerance).toBe(6);
      expect(modified.phase2MinTemp).toBe(78);
      expect(modified.phase2MaxTemp).toBe(93);
    });
  });

  describe('economy soak & determinism (OBJ-M05-015)', () => {
    it('net-yield soak asserts expected yield bounds under coupling conditions', () => {
      const runBatches = (seed: number, isApprentice: boolean, isUnrest: boolean) => {
        let perfectCount = 0;
        let ruinedCount = 0;
        let standardCount = 0;

        for (let i = 0; i < 50; i++) {
          const game = new SoapKettleMiniGame();
          if (isApprentice) {
            game.applyCouplingEffects({
              laborQuality: { traceTargetReduction: 3, phase2BandWiden: 2 },
            });
          }
          if (isUnrest) {
            // @ts-expect-error accessing private couplingEffects for testing
            game.couplingEffects.unrestSpoilage = { spoilageChance: 0.15, ruptureSeverityIncrease: 1 };
            game.setSpoilageSeed(seed + i * 997);
          }

          game.startBatch();
          game.lyeVolume = 50;
          game.fatVolume = 50;
          game.phase = 'STIRRING';
          const requiredStrokes = isApprentice ? 9 : 12;
          for (let s = 0; s < requiredStrokes; s++) {
            game.stirStroke();
          }
          const result = game.lastResult!;
          if (result.quality === 'PERFECT') perfectCount++;
          else if (result.quality === 'RUINED') ruinedCount++;
          else standardCount++;
        }

        return { perfectCount, ruinedCount, standardCount };
      };

      // Normal conditions: 0 unrest, all batches perfect
      const normal = runBatches(42, true, false);
      expect(normal.perfectCount).toBe(50);
      expect(normal.ruinedCount).toBe(0);

      // Unrest conditions: ~15% spoiled batches (between 5% and 30% for 50 batches)
      const unrest = runBatches(42, true, true);
      expect(unrest.ruinedCount).toBeGreaterThan(0);
      expect(unrest.ruinedCount).toBeLessThan(20);
      expect(unrest.perfectCount + unrest.ruinedCount).toBe(50);
    });
  });
});
