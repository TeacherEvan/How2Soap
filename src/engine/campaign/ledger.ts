/**
 * ES-2 Crown's Ledger v1 — Dispatches from the Crown
 * 
 * Tick-clocked rotating mandate system. Three slots rotate daily.
 * Families: 'craft' | 'care' | 'civic'
 * Streak tracking: complete all 3 in a day → "Day Well Spent" (+6 morale all colonists)
 */

export type LedgerFamily = 'craft' | 'care' | 'civic';
export type AffinityId = 'apothecary' | 'soapwright' | 'forgewright';
export type LedgerStatus = 'available' | 'accepted' | 'fulfilled' | 'expired';

export interface LedgerSlot {
  id: string;
  family: LedgerFamily;
  text: string;
  deadlineDay: number;
  rewardRenown: number;
  rewardAffinity: Partial<Record<AffinityId, number>>;
  status: LedgerStatus;
}

export interface LedgerState {
  day: number;
  slots: LedgerSlot[];
  streak: number;
  bestStreak: number;
  rngSeed: number;
}

const FAMILIES: LedgerFamily[] = ['craft', 'care', 'civic'];

const DISPATCH_TEMPLATES: Record<LedgerFamily, { text: string; rewardRenown: number; rewardAffinity: Partial<Record<AffinityId, number>> }[]> = {
  craft: [
    { text: 'Forge three bronze ingots for the Crown armory.', rewardRenown: 10, rewardAffinity: { forgewright: 2 } },
    { text: 'Deliver a batch of hard soap to the quartermaster.', rewardRenown: 8, rewardAffinity: { soapwright: 2 } },
    { text: 'Craft two bronze axes for the timber crews.', rewardRenown: 12, rewardAffinity: { forgewright: 1, soapwright: 1 } },
    { text: 'Smelt copper ore into five ingots.', rewardRenown: 8, rewardAffinity: { forgewright: 2 } },
    { text: 'Produce a tin-bronze alloy batch (10 ingots).', rewardRenown: 15, rewardAffinity: { forgewright: 3 } },
  ],
  care: [
    { text: 'Brew willow tea for the infirmary (5 doses).', rewardRenown: 8, rewardAffinity: { apothecary: 2 } },
    { text: 'Prepare antiseptic salve for wound treatment (3 jars).', rewardRenown: 10, rewardAffinity: { apothecary: 2 } },
    { text: 'Distribute dried meat rations to the barracks (10 kg).', rewardRenown: 6, rewardAffinity: { apothecary: 1, forgewright: 1 } },
    { text: 'Tend the herb garden: harvest mint and willow bark.', rewardRenown: 7, rewardAffinity: { apothecary: 2 } },
    { text: 'Administer mint tonic to fatigued colonists (4 doses).', rewardRenown: 9, rewardAffinity: { apothecary: 1, forgewright: 1 } },
  ],
  civic: [
    { text: 'Clear deadfall from the western approach (3 logs).', rewardRenown: 6, rewardAffinity: { forgewright: 1 } },
    { text: 'Escort the supply cart to the river crossing.', rewardRenown: 12, rewardAffinity: { apothecary: 1, forgewright: 1 } },
    { text: 'Stand watch at the palisade gate for one shift.', rewardRenown: 8, rewardAffinity: { forgewright: 1 } },
    { text: "Deliver the Crown's correspondence to the outpost.", rewardRenown: 10, rewardAffinity: { soapwright: 1 } },
    { text: 'Organize the storehouse: sort ore, timber, and herbs.', rewardRenown: 7, rewardAffinity: { apothecary: 1, soapwright: 1 } },
  ],
};

function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandom<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function makeSlotId(family: LedgerFamily, day: number, index: number): string {
  return `LEDGER_${family.toUpperCase()}_D${day}_${index}`;
}

export function createInitialLedger(rngSeed: number = Date.now()): LedgerState {
  const rng = mulberry32(rngSeed);
  const day = 1;
  const slots: LedgerSlot[] = FAMILIES.map((family, i) => {
    const tmpl = pickRandom(rng, DISPATCH_TEMPLATES[family]);
    return {
      id: makeSlotId(family, day, i),
      family,
      text: tmpl.text,
      deadlineDay: day,
      rewardRenown: tmpl.rewardRenown,
      rewardAffinity: tmpl.rewardAffinity,
      status: 'available',
    };
  });
  return { day, slots, streak: 0, bestStreak: 0, rngSeed };
}

export function stepLedgerDay(state: LedgerState): void {
  // Check for "Day Well Spent" — all 3 fulfilled on previous day
  const allFulfilled = state.slots.every(s => s.status === 'fulfilled');
  if (allFulfilled) {
    state.streak += 1;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;
  } else {
    state.streak = 0;
  }

  // Advance day
  state.day += 1;

  // Rotate slots: generate 3 new ones for the new day
  const rng = mulberry32(state.rngSeed + state.day * 1000);
  state.slots = FAMILIES.map((family, i) => {
    const tmpl = pickRandom(rng, DISPATCH_TEMPLATES[family]);
    return {
      id: makeSlotId(family, state.day, i),
      family,
      text: tmpl.text,
      deadlineDay: state.day,
      rewardRenown: tmpl.rewardRenown,
      rewardAffinity: tmpl.rewardAffinity,
      status: 'available',
    };
  });
}

export function rotateSlots(state: LedgerState, rngSeedOverride?: number): void {
  const rng = mulberry32(rngSeedOverride ?? state.rngSeed + state.day * 1000);
  state.slots = FAMILIES.map((family, i) => {
    const tmpl = pickRandom(rng, DISPATCH_TEMPLATES[family]);
    return {
      id: makeSlotId(family, state.day, i),
      family,
      text: tmpl.text,
      deadlineDay: state.day,
      rewardRenown: tmpl.rewardRenown,
      rewardAffinity: tmpl.rewardAffinity,
      status: 'available',
    };
  });
}

export function fulfillSlot(state: LedgerState, slotId: string): boolean {
  const slot = state.slots.find(s => s.id === slotId);
  if (!slot || slot.status !== 'available' && slot.status !== 'accepted') return false;
  slot.status = 'fulfilled';
  return true;
}

export function acceptSlot(state: LedgerState, slotId: string): boolean {
  const slot = state.slots.find(s => s.id === slotId);
  if (!slot || slot.status !== 'available') return false;
  slot.status = 'accepted';
  return true;
}

export function getDayWellSpentBonus(state: LedgerState): { moraleBonus: number; message: string } | null {
  const allFulfilled = state.slots.every(s => s.status === 'fulfilled');
  if (!allFulfilled) return null;
  return {
    moraleBonus: 6,
    message: `Day Well Spent — Crown's favor shines. All colonists +6 morale. Streak: ${state.streak}.`,
  };
}