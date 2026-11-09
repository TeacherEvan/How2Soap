/**
 * Milestone M6: Territorial Contest & Incursions v1
 * (§6.25)
 *
 * "Other villages, civilians or kingdoms try to conquer your territory from time to time"
 * Incursions are seeded, named, and telegraphed 1 turn in advance in the Dawn Report:
 * 1. Pale frontier raid (steppes raiders)
 * 2. Rival march (Ember Republic / Vale League / Coast Companies)
 * 3. Poor-harvest raid (scavengers seeking grain)
 *
 * Responses:
 * - DEFEND (uses settlement guard rating, weapons MA)
 * - BRIBE (pays Trade/goods to turn them back)
 * - YIELD (saves blood, but loses granary stock, yields drop)
 */

export type IncursionType = 'PALE_RAID' | 'RIVAL_MARCH' | 'HARVEST_RAID';
export type IncursionDefenseChoice = 'DEFEND' | 'BRIBE' | 'YIELD';

export interface Incursion {
  id: string;
  name: string;
  type: IncursionType;
  attackerFaction: string;
  targetSettlementId: string;
  targetSettlementName: string;
  strength: number; // 1..5
  turnsUntilArrival: number; // 1 = telegraphed today, strikes tomorrow
  isTelegraphed: boolean;
  isResolved: boolean;
}

export interface IncursionsState {
  activeIncursions: Incursion[];
  repelledCount: number;
  yieldedCount: number;
}

export function createInitialIncursions(): IncursionsState {
  return {
    activeIncursions: [],
    repelledCount: 0,
    yieldedCount: 0,
  };
}

export function spawnIncursion(
  state: IncursionsState,
  params: {
    name: string;
    type: IncursionType;
    attackerFaction: string;
    targetSettlementId: string;
    targetSettlementName: string;
    strength: number;
  },
): Incursion {
  const inc: Incursion = {
    id: `incursion_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: params.name,
    type: params.type,
    attackerFaction: params.attackerFaction,
    targetSettlementId: params.targetSettlementId,
    targetSettlementName: params.targetSettlementName,
    strength: params.strength,
    turnsUntilArrival: 1, // 1 turn telegraph
    isTelegraphed: true,
    isResolved: false,
  };
  state.activeIncursions.push(inc);
  return inc;
}

export interface ResolveIncursionResult {
  success: boolean;
  message: string;
  estateDeltas: { crown: number; army: number; public: number };
  casualties: number;
  settlementCaptured?: boolean;
}

export function resolveIncursion(
  state: IncursionsState,
  incursionId: string,
  choice: IncursionDefenseChoice,
  settlementGuardCount: number,
  tradeOnHand: number,
  isFrontierSettlement = false,
): ResolveIncursionResult {
  const inc = state.activeIncursions.find((item) => item.id === incursionId);
  if (!inc) {
    return { success: false, message: 'Incursion not found.', estateDeltas: { crown: 0, army: 0, public: 0 }, casualties: 0 };
  }
  if (inc.isResolved) {
    return { success: false, message: 'Incursion already resolved.', estateDeltas: { crown: 0, army: 0, public: 0 }, casualties: 0 };
  }

  inc.isResolved = true;

  switch (choice) {
    case 'DEFEND': {
      // Guard rating scales down losses
      const effectiveDefense = settlementGuardCount * 1.5;
      const victory = effectiveDefense >= inc.strength;

      if (victory) {
        state.repelledCount += 1;
        return {
          success: true,
          message: `The defenders of ${inc.targetSettlementName} held the line! ${inc.name} repelled with zero casualties. Army Estate +4, Public +3.`,
          estateDeltas: { crown: 1, army: 4, public: 3 },
          casualties: 0,
        };
      } else {
        // Incursion v2 (§6.25): Under-defended frontier settlements can be captured
        if (isFrontierSettlement && inc.strength >= 3 && settlementGuardCount < 2) {
          state.yieldedCount += 1;
          return {
            success: false,
            settlementCaptured: true,
            message: `The garrison of ${inc.targetSettlementName} was overrun by ${inc.attackerFaction}! The settlement has fallen under rival occupation. Reclaim objective initiated! Crown -8, Army -10, Public -8.`,
            estateDeltas: { crown: -8, army: -10, public: -8 },
            casualties: 3,
          };
        }

        return {
          success: true,
          message: `The defense wavered against ${inc.attackerFaction}! Although the attackers withdrew, outer stores were breached. Army -2, Public -4.`,
          estateDeltas: { crown: -2, army: -2, public: -4 },
          casualties: 1,
        };
      }
    }

    case 'BRIBE': {
      const bribeCost = inc.strength * 15;
      if (tradeOnHand < bribeCost) {
        return {
          success: false,
          message: `Insufficient Trade treasury to bribe attackers. Need ${bribeCost} Trade.`,
          estateDeltas: { crown: 0, army: 0, public: 0 },
          casualties: 0,
        };
      }
      state.repelledCount += 1;
      return {
        success: true,
        message: `Paid off the war-captains of ${inc.attackerFaction} with ${bribeCost} Trade. They turned back without bloodshed.`,
        estateDeltas: { crown: 0, army: -1, public: 1 },
        casualties: 0,
      };
    }

    case 'YIELD': {
      state.yieldedCount += 1;
      return {
        success: true,
        message: `Yielded granaries and outskirts of ${inc.targetSettlementName} to save lives. Attackers looted supplies. Crown -4, Public -6.`,
        estateDeltas: { crown: -4, army: -3, public: -6 },
        casualties: 0,
      };
    }
  }
}
