/**
 * Timed Requests Engine Model — 3 Concurrent Town Requests
 *
 * Runs inside the Web Worker simulation loop.
 * Zero-dependency, zero SAB expansion (preserves SAB_BYTE_LENGTH === 67648).
 */

export interface TimedRequest {
  readonly slot: number;
  readonly id: string;
  readonly title: string;
  readonly requiredItemId: string;
  readonly requiredQty: number;
  readonly spawnTick: number;
  readonly deadlineTick: number;
  readonly urgencyTier: 1 | 2 | 3; // 1 = Standard, 2 = Urgent, 3 = Emergency
  readonly rewardRenown: number;
  readonly penaltyMorale: number;
  readonly penaltyHygiene: number;
  status: 'active' | 'fulfilled' | 'expired';
}

export interface TimedRequestTemplate {
  readonly id: string;
  readonly title: string;
  readonly requiredItemId: string;
  readonly requiredQty: number;
  readonly durationTicks: number;
  readonly urgencyTier: 1 | 2 | 3;
  readonly rewardRenown: number;
  readonly penaltyMorale: number;
  readonly penaltyHygiene: number;
}

export const REQUEST_TEMPLATES: readonly TimedRequestTemplate[] = [
  {
    id: 'req_wash_tallow',
    title: 'Camp Doctor: Antiseptic Soap',
    requiredItemId: 'BAR_SOAP',
    requiredQty: 1,
    durationTicks: 120,
    urgencyTier: 2,
    rewardRenown: 35,
    penaltyMorale: 8,
    penaltyHygiene: 15,
  },
  {
    id: 'req_tallow_render',
    title: 'Hearth Keeper: Tallow Fat',
    requiredItemId: 'RAW_ADIPOSE_FAT',
    requiredQty: 2,
    durationTicks: 90,
    urgencyTier: 1,
    rewardRenown: 15,
    penaltyMorale: 4,
    penaltyHygiene: 5,
  },
  {
    id: 'req_fire_wood',
    title: 'Furnace tender: Dry Kindling',
    requiredItemId: 'PINE_DEADFALL_WOOD',
    requiredQty: 3,
    durationTicks: 60,
    urgencyTier: 1,
    rewardRenown: 10,
    penaltyMorale: 3,
    penaltyHygiene: 2,
  },
  {
    id: 'req_emergency_saline',
    title: 'Clinic Crisis: Salt Crystals',
    requiredItemId: 'HALITE_SALT',
    requiredQty: 2,
    durationTicks: 45,
    urgencyTier: 3,
    rewardRenown: 50,
    penaltyMorale: 12,
    penaltyHygiene: 20,
  },
];

export interface TimedRequestManager {
  readonly slots: Array<TimedRequest | null>;
  step(
    currentTick: number,
    onExpired?: (req: TimedRequest) => void,
  ): void;
  fulfill(
    slot: number,
    inventory: Record<string, number>,
    currentTick: number,
  ): { success: boolean; speedMultiplier: number; rewardRenown: number } | null;
}

export function createTimedRequestManager(): TimedRequestManager {
  const slots: Array<TimedRequest | null> = [null, null, null];
  let nextSpawnTick = 5;
  let templateIdx = 0;

  return {
    slots,
    step(currentTick: number, onExpired?: (req: TimedRequest) => void): void {
      // Check active requests for expiration
      for (let i = 0; i < 3; i++) {
        const req = slots[i];
        if (req && req.status === 'active') {
          if (currentTick >= req.deadlineTick) {
            req.status = 'expired';
            slots[i] = null;
            onExpired?.(req);
          }
        }
      }

      // Check if we should spawn into an empty slot
      if (currentTick >= nextSpawnTick) {
        const emptySlot = slots.findIndex(s => s === null);
        if (emptySlot !== -1) {
          const tpl = REQUEST_TEMPLATES[templateIdx % REQUEST_TEMPLATES.length];
          templateIdx++;
          slots[emptySlot] = {
            slot: emptySlot,
            id: `${tpl.id}_${currentTick}`,
            title: tpl.title,
            requiredItemId: tpl.requiredItemId,
            requiredQty: tpl.requiredQty,
            spawnTick: currentTick,
            deadlineTick: currentTick + tpl.durationTicks,
            urgencyTier: tpl.urgencyTier,
            rewardRenown: tpl.rewardRenown,
            penaltyMorale: tpl.penaltyMorale,
            penaltyHygiene: tpl.penaltyHygiene,
            status: 'active',
          };
          nextSpawnTick = currentTick + 30; // Next check in 30 ticks
        }
      }
    },

    fulfill(
      slot: number,
      inventory: Record<string, number>,
      currentTick: number,
    ): { success: boolean; speedMultiplier: number; rewardRenown: number } | null {
      const req = slots[slot];
      if (!req || req.status !== 'active') return null;

      const have = inventory[req.requiredItemId] ?? 0;
      if (have < req.requiredQty) {
        return { success: false, speedMultiplier: 1.0, rewardRenown: 0 };
      }

      // Deduct inventory
      inventory[req.requiredItemId] = have - req.requiredQty;

      // Speed multiplier calculation
      const totalDuration = req.deadlineTick - req.spawnTick;
      const remainingRatio = totalDuration > 0
        ? Math.max(0, (req.deadlineTick - currentTick) / totalDuration)
        : 0;

      let speedMultiplier = 1.0;
      if (remainingRatio >= 0.5) {
        speedMultiplier = 1.5;
      } else if (remainingRatio < 0.2) {
        speedMultiplier = 1.0;
      }

      const rewardRenown = Math.round(req.rewardRenown * speedMultiplier);
      req.status = 'fulfilled';
      slots[slot] = null;

      return {
        success: true,
        speedMultiplier,
        rewardRenown,
      };
    },
  };
}
