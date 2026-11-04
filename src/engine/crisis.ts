/**
 * Crisis Turns — deterministic, telegraphed calamity engine.
 *
 * Every crisis is scheduled from (seed, cycle) alone — no crisis state is ever
 * persisted, so saves reload identically mid-telegraph. All randomness flows
 * through the worker's seeded RNG. Effects compose through a small, pure
 * vocabulary resolved against world/player/inventory/colony.
 *
 * Spec: docs/plans/crisis-turns-spec.md
 */
import type { WorldState } from './world';
import type { PlayerMetabolismState } from './metabolism';
import {
  addItemToContainer,
  type InventoryState,
} from './inventory';
import type { ColonyState } from './colony';
import type { createSeededRng } from './rng';
import { hashSeed } from './rng';

// ---------------------------------------------------------------------------
// Effect vocabulary
// ---------------------------------------------------------------------------

export type CrisisEffect =
  | { kind: 'glucose'; delta: number } // kcal
  | { kind: 'adipose'; delta: number } // kcal reserves
  | { kind: 'hydration'; delta: number } // percentage points (0–100)
  | { kind: 'morale'; delta: number } // per-colonist delta (0–100)
  | { kind: 'tempShift'; hottest: boolean; deltaK: number } // vessel temperature
  | { kind: 'ventHottest' } // hottest vessel: pressure → ambient, heater off
  | { kind: 'vesselRuptureHottest' } // hottest vessel ruptures
  | { kind: 'itemLoss'; itemId: string; count?: number; all?: boolean }
  | { kind: 'itemGain'; itemId: string; count: number }
  | { kind: 'wound' } // woundContamination = true
  | { kind: 'fever' } // fever condition = true
  | { kind: 'roll'; probability: number; effects: CrisisEffect[] } // seeded roll
  | { kind: 'revealNextCrisis' }; // scout: message names the next telegraph

export interface CrisisChoice {
  id: string;
  label: string;
  /** Quantified player-facing outcome, e.g. "−150 kcal, −5 hydration". */
  detail: string;
  effects: CrisisEffect[];
  /** When a crisis is auto-resolved (8 watches unanswered), this choice fires. */
  worst?: boolean;
  /** Requires at least one other vessel to exist (UI must disable otherwise). */
  requiresOtherVessel?: boolean;
}

export type CrisisSeverity = 1 | 2 | 3;

export type CrisisId =
  | 'ASH_BLIGHT'
  | 'WOLF_PACK'
  | 'WELL_TAINT'
  | 'FEVER_WAVE'
  | 'BOIL_OVER'
  | 'PALE_RAID'
  | 'BLIGHT_RAIN'
  | 'RIVAL_EXPEDITION';

export interface CrisisDef {
  id: CrisisId;
  title: string;
  description: string;
  severity: CrisisSeverity;
  choices: CrisisChoice[];
}

export const CRISIS_DEFS: Record<CrisisId, CrisisDef> = {
  ASH_BLIGHT: {
    id: 'ASH_BLIGHT',
    title: 'Southern Blight Front',
    description:
      'Wind off the southern ridge carries a grey, spore-heavy front. The ash harvest grounds will be slick with blight for a watch — work them dirty or wait it out.',
    severity: 2,
    choices: [
      {
        id: 'ash_burn',
        label: 'Burn the sick growth',
        detail: '−40 kcal · 50% chance the spores take their due (wound)',
        effects: [{ kind: 'glucose', delta: -40 }, { kind: 'roll', probability: 0.5, effects: [{ kind: 'wound' }] }],
      },
      {
        id: 'ash_shelter',
        label: 'Shelter and ration',
        detail: '−150 kcal · −5 hydration · no risk',
        effects: [{ kind: 'glucose', delta: -150 }, { kind: 'hydration', delta: -5 }],
        worst: true,
      },
      {
        id: 'ash_colony',
        label: 'Send colonists through it',
        detail: '−60 kcal · −10 colony morale',
        effects: [{ kind: 'glucose', delta: -60 }, { kind: 'morale', delta: -10 }],
      },
    ],
  },
  WOLF_PACK: {
    id: 'WOLF_PACK',
    title: 'Wolf Pack on the Ridge',
    description:
      'Three ash-grey ridge wolves have denned above the paddock. The livestock spooks; the tame meat walks on thin legs tonight.',
    severity: 2,
    choices: [
      {
        id: 'wolf_rally',
        label: 'Rally the colonists',
        detail: '−80 kcal · +5 colony morale (a bold watch)',
        effects: [{ kind: 'glucose', delta: -80 }, { kind: 'morale', delta: 5 }],
      },
      {
        id: 'wolf_cull',
        label: 'Cull a beast',
        detail: '−60 kcal · gain 2× Raw Adipose Fat',
        effects: [{ kind: 'glucose', delta: -60 }, { kind: 'itemGain', itemId: 'RAW_ADIPOSE_FAT', count: 2 }],
      },
      {
        id: 'wolf_herd',
        label: 'Drive them off with noise',
        detail: '−100 kcal · −3 hydration · no gain',
        effects: [{ kind: 'glucose', delta: -100 }, { kind: 'hydration', delta: -3 }],
        worst: true,
      },
    ],
  },
  WELL_TAINT: {
    id: 'WELL_TAINT',
    title: 'The Well Runs Sour',
    description:
      'A brackish seep has reached the fresh-water line overnight. The bucket rope comes up grey and smells of brine and something older.',
    severity: 2,
    choices: [
      {
        id: 'well_drink',
        label: 'Drink it anyway',
        detail: '+30 hydration · 66% chance of the sweating sickness',
        effects: [{ kind: 'hydration', delta: 30 }, { kind: 'roll', probability: 0.66, effects: [{ kind: 'fever' }] }],
        worst: true,
      },
      {
        id: 'well_boil',
        label: 'Boil every drop',
        detail: '+25 hydration · hottest vessel +8 K · −50 kcal',
        effects: [
          { kind: 'hydration', delta: 25 },
          { kind: 'tempShift', hottest: true, deltaK: 8 },
          { kind: 'glucose', delta: -50 },
        ],
      },
      {
        id: 'well_trek',
        label: 'Trek to the far spring',
        detail: '−120 kcal · +40 hydration · no risk',
        effects: [{ kind: 'glucose', delta: -120 }, { kind: 'hydration', delta: 40 }],
      },
    ],
  },
  FEVER_WAVE: {
    id: 'FEVER_WAVE',
    title: 'Sweating Sickness',
    description:
      'The seasonal flux moves through the camp at night — a wet heat that crawls into the joints. The weak will pay first.',
    severity: 2,
    choices: [
      {
        id: 'fever_regime',
        label: 'Wet-cloth regime',
        detail: '−90 kcal · everyone weathers it',
        effects: [{ kind: 'glucose', delta: -90 }],
      },
      {
        id: 'fever_power',
        label: 'Power through it',
        detail: '−30 kcal · 66% chance you take the fever',
        effects: [{ kind: 'glucose', delta: -30 }, { kind: 'roll', probability: 0.66, effects: [{ kind: 'fever' }] }],
        worst: true,
      },
      {
        id: 'fever_isolate',
        label: 'Isolate the weak',
        detail: '−15 colony morale · the strong carry on',
        effects: [{ kind: 'morale', delta: -15 }],
      },
    ],
  },
  BOIL_OVER: {
    id: 'BOIL_OVER',
    title: 'Vessel Crescendo',
    description:
      'The big vessel sings a note you have not heard from it before. Pressure is finding its way up the seams — it will not hold past the hour.',
    severity: 3,
    choices: [
      {
        id: 'boil_vent',
        label: 'Vent it into the cold',
        detail: 'Hottest vessel: pressure → ambient · heater off · contents saved',
        effects: [{ kind: 'ventHottest' }],
      },
      {
        id: 'boil_ride',
        label: 'Ride it out',
        detail: '33% chance the vessel ruptures',
        effects: [{ kind: 'roll', probability: 0.33, effects: [{ kind: 'vesselRuptureHottest' }] }],
        worst: true,
      },
      {
        id: 'boil_decant',
        label: 'Decant, fast',
        detail: 'Hottest vessel −25 K · needs a second vessel',
        effects: [{ kind: 'tempShift', hottest: true, deltaK: -25 }],
        requiresOtherVessel: true,
      },
    ],
  },
  PALE_RAID: {
    id: 'PALE_RAID',
    title: 'The Pale Expedition',
    description:
      'Thin-cloaked figures picked the cache over in the dark. They left boot prints, a cold fire ring, and one wax-sealed note: they know what you are making.',
    severity: 3,
    choices: [
      {
        id: 'raid_drive',
        label: 'Drive them off',
        detail: '+5 colony morale · 50% chance of a wound',
        effects: [{ kind: 'morale', delta: 5 }, { kind: 'roll', probability: 0.5, effects: [{ kind: 'wound' }] }],
      },
      {
        id: 'raid_scraps',
        label: 'Let them take the scraps',
        detail: '−1 Bar Soap from stores · −150 adipose reserves',
        effects: [
          { kind: 'itemLoss', itemId: 'BAR_SOAP', count: 1 },
          { kind: 'adipose', delta: -150 },
        ],
        worst: true,
      },
      {
        id: 'raid_salt',
        label: 'Salt their water skins',
        detail: '−5 colony morale · they will sicken · 33% chance you are seen (wound)',
        effects: [{ kind: 'morale', delta: -5 }, { kind: 'roll', probability: 0.33, effects: [{ kind: 'wound' }] }],
      },
    ],
  },
  BLIGHT_RAIN: {
    id: 'BLIGHT_RAIN',
    title: 'Black Rain',
    description:
      'A slow, acid-lean rain has begun. Anything fermenting in the open will come away wrong — or come away as nothing at all.',
    severity: 1,
    choices: [
      {
        id: 'rain_cover',
        label: 'Cover the vats',
        detail: '−5 colony morale · the work survives',
        effects: [{ kind: 'morale', delta: -5 }],
      },
      {
        id: 'rain_let',
        label: 'Let it ferment wrong',
        detail: 'This batch is gone · −2 colony morale',
        effects: [{ kind: 'morale', delta: -2 }],
        worst: true,
      },
      {
        id: 'rain_catch',
        label: 'Capture the black water',
        detail: '−20 kcal · +5 colony morale · useful later',
        effects: [{ kind: 'glucose', delta: -20 }, { kind: 'morale', delta: 5 }],
      },
    ],
  },
  RIVAL_EXPEDITION: {
    id: 'RIVAL_EXPEDITION',
    title: 'Rival Kilns Lit',
    description:
      'Fire-glow on the northern bluff, twice your stack height. Whoever they are, they are building something to burn — and they are not burning wood.',
    severity: 1,
    choices: [
      {
        id: 'rival_race',
        label: 'Race them harder',
        detail: '−80 kcal · +3 colony morale',
        effects: [{ kind: 'glucose', delta: -80 }, { kind: 'morale', delta: 3 }],
      },
      {
        id: 'rival_ignore',
        label: 'Ignore them',
        detail: 'No cost. They are someone else’s problem.',
        effects: [],
        worst: true,
      },
      {
        id: 'rival_spy',
        label: 'Scout their camp',
        detail: '−40 kcal · reveals their next move',
        effects: [{ kind: 'glucose', delta: -40 }, { kind: 'revealNextCrisis' }],
      },
    ],
  },
};

export const CRISIS_IDS = Object.keys(CRISIS_DEFS) as CrisisId[];

// ---------------------------------------------------------------------------
// Deterministic schedule
// ---------------------------------------------------------------------------

export const FIRST_CRISIS_TICK = 480; // Day 2, 00:00
export const CYCLE_MIN = 240; // ~1 game day
export const CYCLE_SPAN = 140; // jitter of one scheduled gap
export const TELEGRAPH_LEAD_TICKS = 20; // 2 watches (10 ticks = 1 watch)
export const MAX_ACTIVE_TICKS = 80; // 8 unanswered watches → fate chooses

export type CrisisRng = ReturnType<typeof createSeededRng>;

export function crisisTickForCycle(seed: number, cycleIndex: number): number {
  let tick =
    FIRST_CRISIS_TICK +
    Math.floor((hashSeed(`crisis:first:${seed >>> 0}`) / 4294967296) * 80);
  for (let i = 0; i < cycleIndex; i += 1) {
    const gapSeed = hashSeed(`crisis:gap:${seed >>> 0}:${i}`);
    tick += CYCLE_MIN + Math.floor((gapSeed / 4294967296) * CYCLE_SPAN);
  }
  return tick;
}

export function crisisIdForCycle(seed: number, cycleIndex: number): CrisisId {
  const h = hashSeed(`crisis:id:${seed >>> 0}:${cycleIndex}`);
  return CRISIS_IDS[Math.floor((h / 4294967296) * CRISIS_IDS.length) % CRISIS_IDS.length];
}

// ---------------------------------------------------------------------------
// Effect application (pure)
// ---------------------------------------------------------------------------

export interface CrisisContext {
  world: WorldState;
  player: PlayerMetabolismState;
  inventory: InventoryState;
  colony: ColonyState;
  rng: CrisisRng;
}

const clampPct = (v: number): number => Math.min(100, Math.max(0, v));
const clampMorale = (v: number): number => Math.min(100, Math.max(0, v));

function hottestVessel(
  world: WorldState,
): { index: number; temperatureK: number } | null {
  let best: { index: number; temperatureK: number } | null = null;
  for (let i = 0; i < world.vessels.length; i += 1) {
    const v = world.vessels[i];
    if (!v || v.ruptured) continue;
    if (!best || v.temperatureK > best.temperatureK) {
      best = { index: i, temperatureK: v.temperatureK };
    }
  }
  return best;
}

function takeFromContainers(inventory: InventoryState, itemId: string, count: number): number {
  let remaining = count;
  for (const container of [inventory.bareHands, inventory.backpack, inventory.campCache]) {
    if (remaining <= 0) break;
    for (let i = 0; i < container.slots.length && remaining > 0; i += 1) {
      const s = container.slots[i];
      if (s && s.itemId === itemId) {
        const take = Math.min(s.count, remaining);
        s.count -= take;
        remaining -= take;
        if (s.count <= 0) container.slots[i] = null;
      }
    }
  }
  return count - remaining;
}

export function applyCrisisEffects(
  ctx: CrisisContext,
  effects: CrisisEffect[],
  revealNextMessage: (cycleIndex: number) => string | null,
  cycleIndex: number,
): string[] {
  const messages: string[] = [];
  for (const effect of effects) {
    switch (effect.kind) {
      case 'glucose':
        ctx.player.glucoseKcal = Math.max(0, ctx.player.glucoseKcal + effect.delta);
        break;
      case 'adipose':
        ctx.player.adiposeKcal = Math.max(0, ctx.player.adiposeKcal + effect.delta);
        break;
      case 'hydration':
        ctx.player.hydrationPct = clampPct(ctx.player.hydrationPct + effect.delta);
        break;
      case 'morale':
        for (const c of ctx.colony.colonists) c.morale = clampMorale(c.morale + effect.delta);
        break;
      case 'tempShift': {
        const h = effect.hottest ? hottestVessel(ctx.world) : null;
        if (h) {
          ctx.world.vessels[h.index].temperatureK = Math.max(
            0,
            ctx.world.vessels[h.index].temperatureK + effect.deltaK,
          );
        }
        break;
      }
      case 'ventHottest': {
        const h = hottestVessel(ctx.world);
        if (h) {
          ctx.world.vessels[h.index].pressureKPa = 101.325;
          ctx.world.vessels[h.index].heaterWatts = 0;
          messages.push('You vent the vessel into the cold floor. It stops singing.');
        } else {
          messages.push('No vessel stands hot enough to vent.');
        }
        break;
      }
      case 'vesselRuptureHottest': {
        const h = hottestVessel(ctx.world);
        if (h) {
          ctx.world.vessels[h.index].ruptured = true;
          messages.push('The seam gives with a shriek. Hot glass, hot lye, wet floor.');
        }
        break;
      }
      case 'itemLoss': {
        if (effect.all) {
          takeFromContainers(ctx.inventory, effect.itemId, Number.MAX_SAFE_INTEGER);
        } else {
          takeFromContainers(ctx.inventory, effect.itemId, effect.count ?? 1);
        }
        break;
      }
      case 'itemGain': {
        const slot = { itemId: effect.itemId, count: effect.count, massKg: 0.1 * effect.count, label: effect.itemId };
        if (
          !addItemToContainer(ctx.inventory.bareHands, slot) &&
          !addItemToContainer(ctx.inventory.backpack, slot)
        ) {
          addItemToContainer(ctx.inventory.campCache, slot);
        }
        break;
      }
      case 'wound':
        ctx.player.conditions.woundContamination = true;
        messages.push('Something opens you. Clean it before it festers.');
        break;
      case 'fever':
        ctx.player.conditions.fever = true;
        messages.push('A sweating sickness takes hold of the camp.');
        break;
      case 'roll':
        if (ctx.rng.roll(effect.probability)) {
          messages.push(...applyCrisisEffects(ctx, effect.effects, revealNextMessage, cycleIndex));
        }
        break;
      case 'revealNextCrisis': {
        const msg = revealNextMessage(cycleIndex);
        if (msg) messages.push(msg);
        break;
      }
    }
  }
  return messages;
}

// ---------------------------------------------------------------------------
// Crisis director
// ---------------------------------------------------------------------------

export type CrisisPhase = 'idle' | 'telegraph' | 'active';

export interface CrisisTelegraph {
  crisisId: CrisisId;
  severity: CrisisSeverity;
  watchesUntil: number;
}

export interface CrisisActive {
  crisisId: CrisisId;
  title: string;
  description: string;
  severity: CrisisSeverity;
  startedTick: number;
  choices: Array<{ id: string; label: string; detail: string; requiresOtherVessel: boolean }>;
}

export interface CrisisSnapshot {
  phase: CrisisPhase;
  telegraph: CrisisTelegraph | null;
  active: CrisisActive | null;
}

export interface CrisisTickResult {
  /** Emitted when a crisis becomes visible (once per crisis). */
  telegraphed: CrisisTelegraph | null;
  /** Emitted when a crisis fires (once per crisis). */
  activated: CrisisActive | null;
  /** Auto-resolve messages (fate chose, 8 watches unanswered). */
  autoResolved: string[];
}

export interface CrisisResolution {
  ok: boolean;
  messages: string[];
}

export interface CrisisDirector {
  /** Reset with a seed; crises scheduled before `startTick` are considered already spent. */
  reset(seed: number, startTick?: number): void;
  /** One call per simulation tick. Pass the live CrisisContext (needed for auto-resolve). */
  tick(tick: number, paused: boolean, ctx: CrisisContext): CrisisTickResult;
  resolve(crisisId: CrisisId, choiceId: string, ctx: CrisisContext): CrisisResolution;
  snapshot(): CrisisSnapshot;
}

const worstChoiceIdOf = (def: CrisisDef): string =>
  (def.choices.find((c) => c.worst) ?? def.choices[def.choices.length - 1]).id;

export function createCrisisDirector(): CrisisDirector {
  let seed = 0;
  const fired = new Set<number>();
  const resolved = new Set<number>();
  /** The cycle of the crisis currently active (null when idle/telegraphing). */
  let activeCycle: number | null = null;
  let active: CrisisActive | null = null;
  let telegraph: CrisisTelegraph | null = null;
  let lastSnapshotPhase: CrisisPhase = 'idle';

  const defFor = (cycle: number): CrisisDef => CRISIS_DEFS[crisisIdForCycle(seed, cycle)];

  const revealNextMessage = (ctx: CrisisContext) => (cycleIndex: number): string | null => {
    const nextCycle = cycleIndex + 1;
    const nextId = crisisIdForCycle(seed, nextCycle);
    const nextDef = CRISIS_DEFS[nextId];
    const tickGap = crisisTickForCycle(seed, nextCycle) - ctx.world.tick;
    const watches = Math.max(0, Math.ceil(tickGap / 10));
    return `You scout their camp: «${nextDef.title}» is coming — about ${watches} watch${watches === 1 ? '' : 'es'} out.`;
  };

  const reset = (newSeed: number, startTick = 0): void => {
    seed = newSeed >>> 0;
    fired.clear();
    resolved.clear();
    // Retire crises scheduled before the world begins (e.g. loading a late save).
    for (let i = 0; i < 10_000; i += 1) {
      if (crisisTickForCycle(seed, i) >= startTick) break;
      fired.add(i);
      resolved.add(i);
    }
    activeCycle = null;
    active = null;
    telegraph = null;
    lastSnapshotPhase = 'idle';
  };

  const buildActive = (cycle: number, tick: number): CrisisActive => {
    const def = defFor(cycle);
    return {
      crisisId: def.id,
      title: def.title,
      description: def.description,
      severity: def.severity,
      startedTick: tick,
      choices: def.choices.map((c) => ({
        id: c.id,
        label: c.label,
        detail: c.detail,
        requiresOtherVessel: !!c.requiresOtherVessel,
      })),
    };
  };

  const tick = (tickValue: number, paused: boolean, ctx: CrisisContext): CrisisTickResult => {
    const result: CrisisTickResult = { telegraphed: null, activated: null, autoResolved: [] };

    // Auto-resolve after 8 unanswered watches — fate picks the worst choice.
    if (active && activeCycle !== null && tickValue - active.startedTick >= MAX_ACTIVE_TICKS) {
      const cycle = activeCycle;
      const def = defFor(cycle);
      const choiceId = worstChoiceIdOf(def);
      const choice = def.choices.find((c) => c.id === choiceId) ?? def.choices[def.choices.length - 1];
      const messages = applyCrisisEffects(ctx, choice.effects, revealNextMessage(ctx), cycle);
      result.autoResolved = [
        `The crisis passed unanswered. Fate chose: «${choice.label}».`,
        ...messages,
      ];
      resolved.add(cycle);
      active = null;
      activeCycle = null;
      telegraph = null;
      lastSnapshotPhase = 'idle';
      return result;
    }

    if (paused) return result;

    // While a crisis is active, no new telegraph/activation is scheduled on top of it.
    if (active) return result;

    // Find the first cycle not yet fired.
    let pending = 0;
    for (let i = 0; i < 10_000; i += 1) {
      if (!fired.has(i)) {
        pending = i;
        break;
      }
    }

    const dueTick = crisisTickForCycle(seed, pending);
    const def = defFor(pending);

    if (dueTick - tickValue <= TELEGRAPH_LEAD_TICKS && dueTick >= tickValue) {
      const watchesUntil = Math.max(0, Math.ceil((dueTick - tickValue) / 10));
      const nextTelegraph: CrisisTelegraph = { crisisId: def.id, severity: def.severity, watchesUntil };
      const changed =
        !telegraph ||
        telegraph.crisisId !== nextTelegraph.crisisId ||
        telegraph.watchesUntil !== nextTelegraph.watchesUntil;
      telegraph = nextTelegraph;
      if (changed) {
        result.telegraphed = nextTelegraph;
        lastSnapshotPhase = 'telegraph';
      }
    }

    if (tickValue >= dueTick && !fired.has(pending)) {
      fired.add(pending);
      active = buildActive(pending, tickValue);
      activeCycle = pending;
      telegraph = null;
      result.activated = active;
      lastSnapshotPhase = 'active';
    }

    return result;
  };

  const resolve = (crisisId: CrisisId, choiceId: string, ctx: CrisisContext): CrisisResolution => {
    if (!active || activeCycle === null) {
      return { ok: false, messages: ['That crisis has already passed.'] };
    }
    if (active.crisisId !== crisisId) {
      return { ok: false, messages: ['That crisis has already passed.'] };
    }
    const cycle = activeCycle;
    const def = defFor(cycle);
    const choice = def.choices.find((c) => c.id === choiceId);
    if (!choice) {
      return { ok: false, messages: ['No such answer to this crisis.'] };
    }
    if (choice.requiresOtherVessel && ctx.world.vessels.length < 2) {
      return { ok: false, messages: ['You need a second vessel to decant into.'] };
    }

    const messages = applyCrisisEffects(ctx, choice.effects, revealNextMessage(ctx), cycle);
    messages.unshift(`You chose: ${choice.label}.`);

    resolved.add(cycle);
    active = null;
    activeCycle = null;
    telegraph = null;
    lastSnapshotPhase = 'idle';
    return { ok: true, messages };
  };

  const snapshot = (): CrisisSnapshot => ({
    phase: lastSnapshotPhase,
    telegraph: telegraph ? { ...telegraph } : null,
    active: active ? { ...active, choices: active.choices.map((c) => ({ ...c })) } : null,
  });

  return { reset, tick, resolve, snapshot };
}
