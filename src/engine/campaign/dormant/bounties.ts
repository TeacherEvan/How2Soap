/**
 * Milestone M6: Bounties & The Magister's Guard
 * (§6.19.3, §6.19.5)
 *
 * Bounties are placed on named bad actors (raiders, beasts, dissidents).
 * Resolving bounties shapes Estates (Army, Crown, Public).
 * Magister's Guard provides personal protection against Knife in the Dark raids.
 */

export interface BountyInstance {
  id: string;
  targetName: string;
  targetTitle: string;
  payoutTrade: number;
  remainingTurns: number;
  scope: 'LOCAL' | 'REALM' | 'FOREIGN';
  category: 'RAIDER' | 'BEAST' | 'DISSIDENT';
  isClaimed: boolean;
  isExpired: boolean;
}

export interface BountiesState {
  bounties: BountyInstance[];
  magistersGuardLevel: number; // 0..5 personal protection level
  magistersGuardUpkeep: number; // upkeep in trade per turn
  claimedCount: number;
}

export function createInitialBounties(): BountiesState {
  return {
    bounties: [
      {
        id: 'bounty_grey_ross',
        targetName: 'Grey Ross',
        targetTitle: 'Highwayman of the Eastern Pass',
        payoutTrade: 30,
        remainingTurns: 7,
        scope: 'LOCAL',
        category: 'RAIDER',
        isClaimed: false,
        isExpired: false,
      },
      {
        id: 'bounty_crag_bear',
        targetName: 'Ironhide Ursus',
        targetTitle: 'Rampaging Quarry Beast',
        payoutTrade: 25,
        remainingTurns: 5,
        scope: 'LOCAL',
        category: 'BEAST',
        isClaimed: false,
        isExpired: false,
      },
    ],
    magistersGuardLevel: 1,
    magistersGuardUpkeep: 3,
    claimedCount: 0,
  };
}

export interface ClaimBountyResult {
  success: boolean;
  message: string;
  payoutTrade: number;
  estateDeltas: { crown: number; army: number; public: number };
}

export function claimBounty(state: BountiesState, bountyId: string): ClaimBountyResult {
  const b = state.bounties.find((item) => item.id === bountyId);
  if (!b) {
    return { success: false, message: 'Bounty not found.', payoutTrade: 0, estateDeltas: { crown: 0, army: 0, public: 0 } };
  }
  if (b.isClaimed) {
    return { success: false, message: 'Bounty already claimed.', payoutTrade: 0, estateDeltas: { crown: 0, army: 0, public: 0 } };
  }
  if (b.isExpired) {
    return { success: false, message: 'Bounty has expired.', payoutTrade: 0, estateDeltas: { crown: 0, army: 0, public: 0 } };
  }

  b.isClaimed = true;
  state.claimedCount += 1;

  const estateDeltas = { crown: 0, army: 0, public: 0 };
  if (b.category === 'RAIDER') {
    estateDeltas.army += 3;
    estateDeltas.public += 3;
  } else if (b.category === 'BEAST') {
    estateDeltas.public += 4;
  } else if (b.category === 'DISSIDENT') {
    estateDeltas.crown += 4;
    estateDeltas.public -= 6; // Dissident suppression damages public trust
  }

  return {
    success: true,
    message: `Bounty claimed on ${b.targetName}! Payout of ${b.payoutTrade} Trade received.`,
    payoutTrade: b.payoutTrade,
    estateDeltas,
  };
}

export function upgradeMagistersGuard(state: BountiesState): { success: boolean; message: string } {
  if (state.magistersGuardLevel >= 5) {
    return { success: false, message: 'Magister\'s Guard is already at maximum level 5.' };
  }
  state.magistersGuardLevel += 1;
  state.magistersGuardUpkeep += 3;
  return {
    success: true,
    message: `Magister's Guard reinforced to Tier ${state.magistersGuardLevel}. Personal defense against covert threats fortified.`,
  };
}

export function stepBounties(state: BountiesState): { expiredBounties: BountyInstance[] } {
  const expiredBounties: BountyInstance[] = [];
  for (const b of state.bounties) {
    if (b.isClaimed || b.isExpired) continue;
    b.remainingTurns -= 1;
    if (b.remainingTurns <= 0) {
      b.isExpired = true;
      expiredBounties.push(b);
    }
  }
  return { expiredBounties };
}
