/**
 * Milestone M6: Crown Dispatches & Timed Royal Orders
 * (§6.18.4, §6.20, D7)
 *
 * Dispatches arrive from the Court with 2 concurrent active orders.
 * Fulfilling on time boosts Crown Estate (+2, +4 if early) and unlocks charters.
 * Missing or letting them expire deducts Crown Estate (-5).
 */

export interface CrownDispatch {
  id: string;
  title: string;
  source: string;
  demandedItem: string;
  demandedQuantity: number;
  remainingTurns: number;
  initialTurns: number;
  rewardEstateDelta: { crown: number; army: number; public: number };
  rewardTrade: number;
  rewardCharters?: string[]; // e.g. 'CHARTER_ALEMBIC_HALL', 'CHARTER_HARBOUR'
  isFulfilled: boolean;
  isExpired: boolean;
}

export interface DispatchesState {
  activeDispatches: CrownDispatch[];
  completedCount: number;
  expiredCount: number;
  unlockedCharters: string[];
}

export function createInitialDispatches(): DispatchesState {
  return {
    activeDispatches: [
      {
        id: 'dispatch_crown_soap_1',
        title: 'Crown Consignment: Hospital Cleansing Soap',
        source: 'The High Chamberlain',
        demandedItem: 'BAR_SOAP',
        demandedQuantity: 2,
        remainingTurns: 4,
        initialTurns: 4,
        rewardEstateDelta: { crown: 4, army: 0, public: 2 },
        rewardTrade: 15,
        rewardCharters: ['CHARTER_ALEMBIC_HALL'],
        isFulfilled: false,
        isExpired: false,
      },
      {
        id: 'dispatch_border_garrison_arms',
        title: 'Royal Levy: Border Watch Iron Heads',
        source: 'Warden of the Northern Marches',
        demandedItem: 'COPPER_INGOT',
        demandedQuantity: 2,
        remainingTurns: 6,
        initialTurns: 6,
        rewardEstateDelta: { crown: 2, army: 4, public: 0 },
        rewardTrade: 20,
        rewardCharters: ['CHARTER_BLACKSMITH'],
        isFulfilled: false,
        isExpired: false,
      },
    ],
    completedCount: 0,
    expiredCount: 0,
    unlockedCharters: [],
  };
}

export interface StepDispatchesResult {
  expired: CrownDispatch[];
  crownPenalty: number;
}

/**
 * Step dispatches by 1 turn at dawn.
 */
export function stepDispatches(state: DispatchesState): StepDispatchesResult {
  const expired: CrownDispatch[] = [];
  let crownPenalty = 0;

  for (const d of state.activeDispatches) {
    if (d.isFulfilled || d.isExpired) continue;
    d.remainingTurns -= 1;
    if (d.remainingTurns <= 0) {
      d.isExpired = true;
      expired.push(d);
      state.expiredCount += 1;
      crownPenalty += 5; // -5 Crown Estate for expired dispatch per §6.18.4
    }
  }

  // Refill if empty
  if (state.activeDispatches.filter((d) => !d.isFulfilled && !d.isExpired).length < 2) {
    const nextId = `dispatch_order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    state.activeDispatches.push({
      id: nextId,
      title: 'Emergency Crown Supply Requisition',
      source: 'Ministry of Supplies',
      demandedItem: 'BAR_SOAP',
      demandedQuantity: 3,
      remainingTurns: 5,
      initialTurns: 5,
      rewardEstateDelta: { crown: 3, army: 1, public: 1 },
      rewardTrade: 25,
      isFulfilled: false,
      isExpired: false,
    });
  }

  return { expired, crownPenalty };
}

export interface FulfillDispatchResult {
  success: boolean;
  message: string;
  dispatch?: CrownDispatch;
}

export function fulfillDispatch(
  state: DispatchesState,
  dispatchId: string,
  stockOnHand: number,
): FulfillDispatchResult {
  const d = state.activeDispatches.find((item) => item.id === dispatchId);
  if (!d) return { success: false, message: 'Dispatch not found.' };
  if (d.isFulfilled) return { success: false, message: 'Dispatch already fulfilled.' };
  if (d.isExpired) return { success: false, message: 'Dispatch has expired.' };

  if (stockOnHand < d.demandedQuantity) {
    return {
      success: false,
      message: `Insufficient stock: need ${d.demandedQuantity}x ${d.demandedItem}, have ${stockOnHand}.`,
    };
  }

  d.isFulfilled = true;
  state.completedCount += 1;
  if (d.rewardCharters) {
    for (const c of d.rewardCharters) {
      if (!state.unlockedCharters.includes(c)) {
        state.unlockedCharters.push(c);
      }
    }
  }

  const earlyBonus = d.remainingTurns >= Math.floor(d.initialTurns / 2) ? 2 : 0;
  const netCrown = d.rewardEstateDelta.crown + earlyBonus;

  return {
    success: true,
    message: `Fulfilled ${d.title}! Crown Estate +${netCrown}, Trade +${d.rewardTrade}.`,
    dispatch: d,
  };
}
