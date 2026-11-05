import { describe, it, expect } from 'vitest';
import {
  COUNTRIES,
  createRealmState,
  stepRealmTurn,
  applyDistributeStimulants,
  applyDistributeClothes,
  applyDistributeWeapons,
  adjustEstate,
} from '../src/engine/campaign/realm';

describe('The Realm Model & National Indices (M1 / §6.18)', () => {
  it('initializes all 5 countries with distinct endowments and baseline stats', () => {
    expect(COUNTRIES.length).toBe(5);

    const brass = createRealmState('brass_coast');
    expect(brass.health).toBe(65);
    expect(brass.safety).toBe(60);
    expect(brass.vigor).toBe(55);

    const marches = createRealmState('fever_marches');
    expect(marches.health).toBe(40); // afflicted baseline
    expect(marches.estates.crown).toBe(60);
  });

  it('decays health and safety by 1 per turn (The Wasting)', () => {
    const realm = createRealmState('brass_coast');
    const initialHealth = realm.health;
    const initialSafety = realm.safety;

    stepRealmTurn(realm);
    expect(realm.health).toBe(initialHealth - 1);
    expect(realm.safety).toBe(initialSafety - 1);
  });

  it('manages stimulant distribution, exposure accumulation, and recovery', () => {
    const realm = createRealmState('brass_coast');
    expect(realm.doseExposure).toBe(0);

    // Distribute 2 crates of willow tea (+15 exposure each)
    applyDistributeStimulants(realm, 'WILLOW_TEA', 2);
    expect(realm.doseExposure).toBe(30);
    expect(realm.vigor).toBe(55 + 16);

    // Natural turn recovery is -8/turn
    stepRealmTurn(realm);
    expect(realm.doseExposure).toBe(22);
  });

  it('triggers crash roll and immunity when exposure reaches 60 or above', () => {
    const realm = createRealmState('brass_coast');
    applyDistributeStimulants(realm, 'NITROUS_TONIC', 2); // 2 * 35 = 70 exposure
    expect(realm.doseExposure).toBe(70);

    // Force crash with deterministic RNG roll < 0.35
    const res = stepRealmTurn(realm, () => 0.10);
    expect(res.crashOccurred).toBe(true);
    expect(realm.doseImmunityTurns).toBe(2);

    // Further dose attempts rejected while immune
    const rej = applyDistributeStimulants(realm, 'WILLOW_TEA', 1);
    expect(rej.success).toBe(false);
    expect(rej.message).toContain('immunity');
  });

  it('distributes clothes and weapons, boosting safety and estates', () => {
    const realm = createRealmState('iron_weald');
    const initSafety = realm.safety;
    const initArmy = realm.estates.army;
    const initPublic = realm.estates.public;

    applyDistributeClothes(realm, 5); // +10 safety, +10 public
    expect(realm.safety).toBe(initSafety + 10);
    expect(realm.estates.public).toBe(initPublic + 10);

    applyDistributeWeapons(realm, 3); // +6 safety, +6 army
    expect(realm.safety).toBe(initSafety + 16);
    expect(realm.estates.army).toBe(initArmy + 6);
  });

  it('emits warnings at 25 and 10 and triggers deposal at 0 for each Estate', () => {
    const realm = createRealmState('brass_coast');

    // 1. Lower Crown to <= 25 -> warning
    realm.estates.crown = 25;
    const res25 = stepRealmTurn(realm);
    expect(res25.warnings.some(w => w.includes('WARNING') && w.includes('Crown'))).toBe(true);

    // 2. Lower Crown to <= 10 -> emergency
    realm.estates.crown = 10;
    const res10 = stepRealmTurn(realm);
    expect(res10.warnings.some(w => w.includes('EMERGENCY') && w.includes('Crown'))).toBe(true);

    // 3. Lower Crown to 0 -> DISMISSAL deposal
    realm.estates.crown = 0;
    const resDeposal = stepRealmTurn(realm);
    expect(realm.deposal).toBe('DISMISSAL');
    expect(resDeposal.deposalOccurred).toBe('DISMISSAL');
  });

  it('triggers MUTINY when Army estate collapses and PYRE when Public collapses', () => {
    const realmArmy = createRealmState('salt_steppes');
    adjustEstate(realmArmy, 'army', -100);
    stepRealmTurn(realmArmy);
    expect(realmArmy.deposal).toBe('MUTINY');

    const realmPublic = createRealmState('fever_marches');
    adjustEstate(realmPublic, 'public', -100);
    stepRealmTurn(realmPublic);
    expect(realmPublic.deposal).toBe('PYRE');
  });
});
