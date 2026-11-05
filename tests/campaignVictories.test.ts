import { describe, it, expect } from 'vitest';
import {
  createInitialVictoryState,
  updateVictoryScores,
  evaluateVictoryEligibilities,
  getEndingCardContent,
  calculateTestOfTimeScore,
} from '../src/engine/campaign/victories';
import { createRealmState } from '../src/engine/campaign/realm';
import { createInitialSettlementsState } from '../src/engine/campaign/settlements';
import { createInitialBuiltWorks, constructBuiltWork } from '../src/engine/campaign/builtWorks';

describe('Campaign Victories & Deposal Endgames (§6.10, §6.18.5, §6.18.8, §6.29)', () => {
  it('initializes default victory state with 0 scores and IGNORE undertow stance', () => {
    const v = createInitialVictoryState();
    expect(v.scores.dominion).toBe(0);
    expect(v.scores.tourism).toBe(0);
    expect(v.scores.gdp).toBe(0);
    expect(v.scores.innovation).toBe(0);
    expect(v.undertowStance).toBe('IGNORE');
    expect(v.claimedVictory).toBeNull();
    expect(v.deposalOccurred).toBeNull();
    expect(v.isMuseumMode).toBe(false);
  });

  it('updates victory scores deterministically each turn', () => {
    const v = createInitialVictoryState();
    const settlements = createInitialSettlementsState('Old Town');
    const realm = createRealmState();
    const builtWorks = createInitialBuiltWorks();

    const scores = updateVictoryScores(v, {
      settlements,
      realm,
      builtWorks,
      currentAge: 2,
      wondersCount: 1,
      uniqueQuartersCount: 1,
    });

    // 1 settlement + capital: dominion = 1 + 2 = 3
    expect(scores.dominion).toBe(3);
    // Tourism = floor(renown / 2) + 1*2 (wonder) + 1*3 (uq) = 0 + 2 + 3 = 5
    expect(scores.tourism).toBeGreaterThanOrEqual(5);
    // GDP = trade yield + 0 cities
    expect(scores.gdp).toBeGreaterThanOrEqual(1);
    // Innovation = discovery yield + 1 (age 2)
    expect(scores.innovation).toBeGreaterThanOrEqual(2);
  });

  it('correctly evaluates all 4 canonical victories + 1 alternate victory', () => {
    const v = createInitialVictoryState();
    const realm = createRealmState();
    const settlements = createInitialSettlementsState();
    const builtWorks = createInitialBuiltWorks();

    // In Age I with low scores, none should be eligible
    const initialElig = evaluateVictoryEligibilities(v, realm, settlements, 1, builtWorks);
    expect(initialElig.every((e) => !e.eligible)).toBe(true);

    // 1. Test Scientific Victory (The Cure)
    v.scores.innovation = 120;
    v.penicillinConsignmentsDelivered = 6;
    realm.health = 85;
    let elig = evaluateVictoryEligibilities(v, realm, settlements, 3, builtWorks);
    const cure = elig.find((e) => e.type === 'THE_CURE');
    expect(cure?.eligible).toBe(true);

    // 2. Test Cultural Victory (The Grand Magister)
    v.scores.tourism = 110;
    realm.estates.crown = 75;
    v.dispatchesMastered = 7;
    elig = evaluateVictoryEligibilities(v, realm, settlements, 3, builtWorks);
    const magister = elig.find((e) => e.type === 'THE_GRAND_MAGISTER');
    expect(magister?.eligible).toBe(true);

    // 3. Test Economic Victory (The Salt Ledger)
    v.scores.gdp = 135;
    v.tradeConvoysCompleted = 6;
    settlements.settlements.push({ ...settlements.settlements[0], id: 'settle_2' }, { ...settlements.settlements[0], id: 'settle_3' });
    elig = evaluateVictoryEligibilities(v, realm, settlements, 3, builtWorks);
    const ledger = elig.find((e) => e.type === 'THE_SALT_LEDGER');
    expect(ledger?.eligible).toBe(true);

    // 4. Test Military Victory (The War for the Nation's Breath)
    v.scores.dominion = 105;
    realm.safety = 80;
    v.frontierThreatsPacified = 5;
    elig = evaluateVictoryEligibilities(v, realm, settlements, 3, builtWorks);
    const military = elig.find((e) => e.type === 'THE_NATIONS_BREATH');
    expect(military?.eligible).toBe(true);

    // 5. Test Alternate Rebel Victory (The Republic of Compound)
    v.undertowStance = 'JOIN';
    realm.estates.public = 80;
    elig = evaluateVictoryEligibilities(v, realm, settlements, 3, builtWorks);
    const rebel = elig.find((e) => e.type === 'THE_REPUBLIC_OF_COMPOUND');
    expect(rebel?.eligible).toBe(true);
  });

  it('renders rich narrative endings and epilogues for all 5 victories and 3 deposals', () => {
    let builtWorks = createInitialBuiltWorks();
    builtWorks = constructBuiltWork(builtWorks, 'work_lime_cement').state;
    builtWorks = constructBuiltWork(builtWorks, 'work_leather_rope').state;
    builtWorks = constructBuiltWork(builtWorks, 'work_casein_glue').state;

    // Victory card with engineering canon dominant
    const cardCure = getEndingCardContent('THE_CURE', builtWorks, 'sister_aurel');
    expect(cardCure.isVictory).toBe(true);
    expect(cardCure.stamp).toBe('SCIENTIFIC VICTORY');
    expect(cardCure.title).toBe('The Voltaic Eradication');
    expect(cardCure.canonSummary).toContain('Engineering Canon Dominant');
    expect(cardCure.canonSummary).toContain('Primate of the Healing River');

    // Alternate Rebel Victory
    const cardRebel = getEndingCardContent('THE_REPUBLIC_OF_COMPOUND', builtWorks, 'hedge_witch');
    expect(cardRebel.isVictory).toBe(true);
    expect(cardRebel.title).toBe('The Republic of Compound');

    // 3 Deposals
    const cardDismissal = getEndingCardContent('DISMISSAL', builtWorks, 'odric_vane');
    expect(cardDismissal.isVictory).toBe(false);
    expect(cardDismissal.title).toBe('Recalled to the Court');

    const cardMutiny = getEndingCardContent('MUTINY', builtWorks, 'odric_vane');
    expect(cardMutiny.isVictory).toBe(false);
    expect(cardMutiny.title).toBe('The Sword Decides');

    const cardPyre = getEndingCardContent('PYRE', builtWorks, 'madame_serafine');
    expect(cardPyre.isVictory).toBe(false);
    expect(cardPyre.title).toBe('The Crowd Decides');
  });

  it('computes Test of Time score and rank correctly', () => {
    const v = createInitialVictoryState();
    v.scores.dominion = 80;
    v.scores.tourism = 90;
    v.scores.gdp = 70;
    v.scores.innovation = 85;

    const realm = createRealmState();
    realm.estates.crown = 70;
    realm.estates.army = 65;
    realm.estates.public = 75; // avg = 70 -> estateBonus = 140

    const settlements = createInitialSettlementsState(); // 1 settlement -> 15

    const scoreResult = calculateTestOfTimeScore(v, realm, settlements, 40); // turnPenalty = 20
    // Total = 80 + 90 + 70 + 85 + 140 + 15 - 20 = 460
    expect(scoreResult.totalScore).toBe(460);
    expect(scoreResult.rankTitle).toBe('High Chancellor of the Realm');
    expect(scoreResult.breakdown.turnPenalty).toBe(20);
    expect(scoreResult.breakdown.estateBonus).toBe(140);
  });
});
