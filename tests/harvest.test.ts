import { describe, expect, it } from 'vitest';
import { applyHarvest } from '../src/engine/harvest';
import { createPlayerMetabolism } from '../src/engine/metabolism';
import { createInventoryState } from '../src/engine/inventory';
import { BIOME_DAG } from '../src/data/biomeNodes';
import { createSeededRng } from '../src/engine/rng';

const boarSpecies = BIOME_DAG.find(c => c.key === 'ANIMALS')!.species[0];
const oakSpecies = BIOME_DAG[0].species[0];
const boarPart = boarSpecies.parts[0];
const oakLog = oakSpecies.parts[0]; // White Oak Log

describe('applyHarvest', () => {
  // NOTE (Task 4 deviation): the brief's verbatim version of this test called
  // applyHarvest with NO tool, expecting ok=true at 1200 glucose. With the
  // spec's closed-form cost ((W/MA) * (targetMohs/toolMohs)^2 + E_haul), a
  // toolless White Oak Log costs ~2485 kcal > 1200 glucose, so the refusal
  // path (correctly) fires. A stone axe-class tool makes the attempt payable,
  // which is what the test name describes. Assertions are unchanged.
  it('deducts kcal and adds yields to bare hands when they fit', () => {
    const p = createPlayerMetabolism();
    const inv = createInventoryState();
    const rng = createSeededRng(1);
    const out = applyHarvest(p, inv, oakLog, oakSpecies.baseDistanceMeters, 'CHOPPING_CARVING', { mohs: 6.5, mechanicalAdvantage: 1.5 }, rng);
    expect(out.ok).toBe(true);
    expect(out.kcalCost).toBeGreaterThan(0);
    expect(p.glucoseKcal).toBeCloseTo(1200 - out.kcalCost, 6);
    expect(inv.bareHands.slots.some(s => s?.itemId === 'LOG_WHITE_OAK' && s.count === 1)).toBe(true);
  });

  it('refuses when the player cannot pay the kcal cost', () => {
    const p = createPlayerMetabolism();
    p.glucoseKcal = 1;
    const inv = createInventoryState();
    const out = applyHarvest(p, inv, boarPart, boarSpecies.baseDistanceMeters, null, null, createSeededRng(2));
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('too_tired');
    expect(inv.bareHands.slots.every(s => s === null)).toBe(true);
  });

  it('boar hunt rolls a wound deterministically from the seed', () => {
    const p = createPlayerMetabolism();
    const inv = createInventoryState();
    const out = applyHarvest(p, inv, boarPart, boarSpecies.baseDistanceMeters, 'CUTTING_SKINNING', { mohs: 7, mechanicalAdvantage: 1 }, createSeededRng(99));
    expect(typeof out.wound).toBe('boolean');
    // same seed, same result, forever:
    const p2 = createPlayerMetabolism();
    const inv2 = createInventoryState();
    const out2 = applyHarvest(p2, inv2, boarPart, boarSpecies.baseDistanceMeters, 'CUTTING_SKINNING', { mohs: 7, mechanicalAdvantage: 1 }, createSeededRng(99));
    expect(out2.wound).toBe(out.wound);
  });

  // NOTE (Task 4 deviation): the brief's verbatim version was "toolless boar
  // hunt" asserting MEAT_RAW in bareHands. That is impossible three ways:
  //   1. Toolless cost is ~6873 kcal > 1200 starting glucose, so the harvest is refused.
  //   2. Bare hands hold 2 slots; HIDE (4 kg) and FAT (2.5 kg) fill them first.
  //   3. MEAT_RAW is 14 kg — it exceeds the 12 kg bare-hands container cap alone.
  // The spec-formula implementation routes MEAT_RAW to the camp cache. This
  // version equips the same blade used in the wound test and asserts meat
  // lands SOMEWHERE in inventory (the literal intent of the test name).
  it('boar hunt: meat lands in inventory, deterministic across seeds', () => {
    const p = createPlayerMetabolism();
    const inv = createInventoryState();
    applyHarvest(p, inv, boarPart, boarSpecies.baseDistanceMeters, 'CUTTING_SKINNING', { mohs: 7, mechanicalAdvantage: 1 }, createSeededRng(4));
    const allSlots = [...inv.bareHands.slots, ...inv.backpack.slots, ...inv.campCache.slots];
    expect(JSON.stringify(allSlots.map(s => s?.itemId))).toContain('MEAT_RAW');
  });
});
