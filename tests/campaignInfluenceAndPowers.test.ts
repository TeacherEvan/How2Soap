import { describe, it, expect } from 'vitest';
import {
  createInitialInfluenceState,
  executePowerAction,
} from '../src/engine/campaign/influence';
import {
  createInitialDispatches,
  fulfillDispatch,
  stepDispatches,
} from '../src/engine/campaign/dispatches';
import {
  performArchimedesAssay,
  resolveQuarantineGate,
} from '../src/engine/campaign/harbour';
import {
  createInitialPetitionersBoard,
  resolvePetition,
} from '../src/engine/campaign/petitioners';
import {
  createInitialBounties,
  claimBounty,
  upgradeMagistersGuard,
} from '../src/engine/campaign/bounties';
import {
  createInitialIncursions,
  spawnIncursion,
  resolveIncursion,
} from '../src/engine/campaign/incursions';

describe('Milestone M6: Influence, Independent Powers & The Realm\'s Hands', () => {
  it('manages Independent Powers actions: Befriend, Levy, Incite, Incorporate', () => {
    const state = createInitialInfluenceState(1);
    expect(state.powers.length).toBe(4);
    expect(state.currentInfluencePool).toBe(20);

    const wolfKin = state.powers[0];
    expect(wolfKin.id).toBe('power_wolf_kin');

    // Befriend consumes 10 influence and raises power influence
    const befriendRes = executePowerAction(state, 'power_wolf_kin', 'BEFRIEND');
    expect(befriendRes.success).toBe(true);
    expect(state.currentInfluencePool).toBe(10);
    expect(wolfKin.influence).toBe(35);

    // Fails when pool is insufficient
    const secondBefriend = executePowerAction(state, 'power_wolf_kin', 'BEFRIEND');
    expect(secondBefriend.success).toBe(true);
    expect(state.currentInfluencePool).toBe(0);

    const thirdBefriend = executePowerAction(state, 'power_wolf_kin', 'BEFRIEND');
    expect(thirdBefriend.success).toBe(false);

    // Suzerainty threshold at 60
    state.currentInfluencePool = 50;
    executePowerAction(state, 'power_wolf_kin', 'BEFRIEND');
    expect(wolfKin.influence).toBe(75);
    expect(wolfKin.status).toBe('SUZERAIN');
    expect(wolfKin.suzerainActive).toBe(true);
  });

  it('handles Crown Dispatches and charter unlocking on fulfillment', () => {
    const state = createInitialDispatches();
    expect(state.activeDispatches.length).toBe(2);

    const first = state.activeDispatches[0];
    // Attempt fulfillment with insufficient stock
    const failRes = fulfillDispatch(state, first.id, 1);
    expect(failRes.success).toBe(false);

    // Fulfill with adequate stock
    const okRes = fulfillDispatch(state, first.id, 5);
    expect(okRes.success).toBe(true);
    expect(state.completedCount).toBe(1);
    expect(state.unlockedCharters).toContain('CHARTER_ALEMBIC_HALL');

    // Stepping turns expires unfulfilled dispatches and penalizes Crown
    const stepRes = stepDispatches(state);
    expect(stepRes.expired.length).toBe(0);
  });

  it('performs Archimedes density assay and Harbour Quarantine Gate', () => {
    // Pure Bronze Assay
    const pureBronze = performArchimedesAssay({
      cargoId: 'cargo_1',
      declaredMaterial: 'BRONZE',
      measuredMassGrams: 880,
      measuredVolumeCm3: 100, // 8.80 g/cm3
    });
    expect(pureBronze.isPure).toBe(true);
    expect(pureBronze.measuredDensity).toBe(8.80);

    // Adulterated Slag Bronze
    const slagBronze = performArchimedesAssay({
      cargoId: 'cargo_2',
      declaredMaterial: 'BRONZE',
      measuredMassGrams: 750,
      measuredVolumeCm3: 100, // 7.50 g/cm3
    });
    expect(slagBronze.isPure).toBe(false);

    // Quarantine Gate resolution
    const vessel = {
      vesselId: 'ship_dawn',
      shipName: 'The Sea Pearl',
      originPort: 'Vale Marches',
      carrierType: 'MERCHANT' as const,
      suspectedFever: true,
      cargoValueTrade: 25,
    };

    // Fumigate with soap
    const fumigateRes = resolveQuarantineGate(vessel, 'FUMIGATE', 2);
    expect(fumigateRes.soapConsumed).toBe(1);
    expect(fumigateRes.publicHealthDelta).toBe(1);
  });

  it('resolves Petitioners\' Board demands with estate feedback', () => {
    const board = createInitialPetitionersBoard();
    expect(board.petitions.length).toBe(2);

    const p = board.petitions[0];
    const res = resolvePetition(board, p.id, 'SETTLE');
    expect(res.success).toBe(true);
    expect(board.resolvedCount).toBe(1);
    expect(res.estateDeltas.public).toBeGreaterThan(0);
  });

  it('manages Bounties and upgrades Magister\'s Guard', () => {
    const bState = createInitialBounties();
    expect(bState.magistersGuardLevel).toBe(1);

    const guardUpgrade = upgradeMagistersGuard(bState);
    expect(guardUpgrade.success).toBe(true);
    expect(bState.magistersGuardLevel).toBe(2);

    const b = bState.bounties[0];
    const claimRes = claimBounty(bState, b.id);
    expect(claimRes.success).toBe(true);
    expect(bState.claimedCount).toBe(1);
  });

  it('spawns and resolves territorial Incursions', () => {
    const incState = createInitialIncursions();
    const inc = spawnIncursion(incState, {
      name: 'Pale Scouting Warband',
      type: 'PALE_RAID',
      attackerFaction: 'The Pale Tribes',
      targetSettlementId: 'settlement_hearth',
      targetSettlementName: 'Hearth Keep',
      strength: 2,
    });
    expect(inc.isTelegraphed).toBe(true);

    // Defend with 2 guards (effective defense = 2 * 1.5 = 3 >= strength 2)
    const defendRes = resolveIncursion(incState, inc.id, 'DEFEND', 2, 50);
    expect(defendRes.success).toBe(true);
    expect(defendRes.casualties).toBe(0);
    expect(incState.repelledCount).toBe(1);
  });
});
