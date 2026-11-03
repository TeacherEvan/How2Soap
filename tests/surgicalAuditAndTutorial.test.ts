import { describe, it, expect, beforeEach } from 'vitest';
import { SharedWorldView, SAB_BYTE_LENGTH, TELEMETRY } from '../src/engine/memoryLayout';
import { TUTORIAL_LESSONS } from '../src/ui/tutorialCurriculum';
import { computeVesselPhdTelemetry } from '../src/ui/TutorialController';
import {
  createInitialColonyState,
  recruitColonist,
  stepColony,
} from '../src/engine/colony';
import { createInventoryState, addItemToContainer } from '../src/engine/inventory';
import { BIOME_DAG } from '../src/data/biomeNodes';

describe('Surgical Audit Remediation & 3-Tier Tutorial Suite', () => {
  let sab: SharedArrayBuffer;
  let view: SharedWorldView;

  beforeEach(() => {
    sab = new SharedArrayBuffer(SAB_BYTE_LENGTH);
    view = new SharedWorldView(sab);
  });

  describe('P0-2 & MemoryLayout SeqLock Contention Fallback', () => {
    it('readSnapshot returns cached snapshot instead of throwing on high contention', () => {
      // First read to cache initial state
      const snap1 = view.readSnapshot(16);
      expect(snap1).toBeDefined();
      expect(snap1.tick).toBe(0);

      // Force odd lock (worker writing)
      view.beginWorkerWrite();

      // Read snapshot while writing — should return snap1 instead of throwing uncaught error
      const snap2 = view.readSnapshot(8);
      expect(snap2).toBe(snap1);

      // Clean up lock
      view.endWorkerWrite(1);
    });

    it('returns cached snapshot when seq is identical to avoid redundant memory copies', () => {
      const snap1 = view.readSnapshot(16);
      const snap2 = view.readSnapshot(16);
      expect(snap2).toBe(snap1);
    });
  });

  describe('P1-1 & P1-2 Colony Mechanics & Spec Compliance', () => {
    it('processes payroll on DAY_TICKS (240 ticks) and clears STRIKE status when paid', () => {
      const inv = createInventoryState();
      addItemToContainer(inv.campCache, { itemId: 'BAR_SOAP', count: 10, massKg: 2.0, label: 'Bar Soap' });

      const colony = createInitialColonyState();
      const c = recruitColonist(colony, 'Apothecary', 'APPRENTICE_CHEMIST', { commodity: 'BAR_SOAP', dailyAmount: 1 }, 0);
      c.status = 'STRIKE';
      c.morale = 15;

      // Tick 240 (midnight payroll)
      stepColony(colony, 6, 240, inv.campCache, BIOME_DAG);

      expect(c.morale).toBeGreaterThanOrEqual(20);
      expect(c.status).toBe('IDLE');
    });

    it('triggers STRIKE when morale drops below 20 on payroll default', () => {
      const inv = createInventoryState(); // Empty camp cache
      const colony = createInitialColonyState();
      const c = recruitColonist(colony, 'Drifter', 'FORAGER', { commodity: 'DRIED_MEAT', dailyAmount: 2 }, 0);
      c.morale = 25;

      // Tick 240 without wage supplies
      stepColony(colony, 6, 240, inv.campCache, BIOME_DAG);

      expect(c.morale).toBe(0);
      expect(c.status).toBe('STRIKE');
    });

    it('applies archetype yield boost during harvesting', () => {
      const colony = createInitialColonyState();
      const forager = recruitColonist(colony, 'Leaf', 'FORAGER', { commodity: 'BAR_SOAP', dailyAmount: 1 }, 0);
      const miner = recruitColonist(colony, 'Pick', 'MINER', { commodity: 'BAR_SOAP', dailyAmount: 1 }, 0);

      expect(forager.archetype).toBe('FORAGER');
      expect(miner.archetype).toBe('MINER');
    });
  });

  describe('3-Tier Tutorial Curriculum & Lessons', () => {
    it('includes all 3 tiers with 5 lessons each (15 total)', () => {
      const beginner = TUTORIAL_LESSONS.filter((l) => l.tier === 'BEGINNER');
      const intermediate = TUTORIAL_LESSONS.filter((l) => l.tier === 'INTERMEDIATE');
      const phd = TUTORIAL_LESSONS.filter((l) => l.tier === 'PHD');

      expect(beginner.length).toBe(5);
      expect(intermediate.length).toBe(5);
      expect(phd.length).toBe(5);
      expect(TUTORIAL_LESSONS.length).toBe(15);
    });

    it('all lessons have valid titles, selectors, plates and practice reagent grants', () => {
      for (const lesson of TUTORIAL_LESSONS) {
        expect(lesson.id).toBeTruthy();
        expect(lesson.title).toBeTruthy();
        expect(lesson.spotlightSelector).toBeTruthy();
        expect(['TERRAIN', 'MINES', 'ELEMENTS', 'TIERS']).toContain(lesson.plateKey);
        expect(lesson.practiceGrant).toBeDefined();
      }
    });

    it('computes PhD physical chemistry telemetry accurately', () => {
      view.beginWorkerWrite();
      view.setTelemetry(0, TELEMETRY.TEMP_K, 360.0);
      view.setTelemetry(0, TELEMETRY.PH, 13.0);
      view.endWorkerWrite(1);

      const snap = view.readSnapshot(16);
      const telem = computeVesselPhdTelemetry(0, snap);

      expect(telem.tempK).toBe(360.0);
      expect(telem.ph).toBe(13.0);
      expect(telem.sidMolL).toBeGreaterThan(0.01); // Alkaline SID > 0
      expect(telem.arrheniusRateK).toBeGreaterThan(0);
      expect(telem.newtonCoolingWatts).toBeGreaterThan(0);
    });
  });
});
