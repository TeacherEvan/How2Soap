import { addHardwoodAsh, addWaterLiters, type VesselMaterialKey, type VesselState } from './chemistry';
import { findVessel } from './world';
import { SharedWorldView, SAB_BYTE_LENGTH, MAX_VESSELS } from './memoryLayout';
import {
  createWorld,
  createWorldVessel,
  decantWorld,
  skimWorld,
  stepWorld,
  syncWorldToShared,
  type WorldEvent,
  type WorldState,
} from './world';
import {
  createPlayerMetabolism,
  stepPlayerMetabolism,
  type PlayerMetabolismState,
  consumeFood,
  applySalicylicAcid,
  applyPenicillin,
} from './metabolism';
import {
  createInventoryState,
  unlockBackpack,
  addItemToContainer,
  addItemToAnyContainer,
  removeItemFromAnyContainer,
  canFitItemsInInventory,
  cloneInventoryState,
  type InventoryState,
} from './inventory';
import {
  createPaddock,
  stepPaddockDay,
  captureAnimal,
  type Paddock,
} from './husbandry';
import { applyHarvest } from './harvest';
import { createSeededRng } from './rng';
import { BIOME_DAG } from '../data/biomeNodes';
import { ITEM_BY_ID } from '../data/items';
import { FABRICATION_RECIPES, RECIPE_EFFECTS, METALLURGY_TOOLS, resolveToolItem } from './fabrication';
import { satisfyVesselInputs, applyVesselConsumption, type VesselInputResult, VESSEL_INPUTS } from './vesselInputs';
import { SIM_STEP_SECONDS, WORKER_HZ } from './time';
import { SPECIES, SPECIES_BY_INDEX } from '../data/speciesRegistry';
import { escalateConditions } from './conditions';
import {
  createInitialColonyState,
  recruitColonist,
  assignColonistJob,
  administerStimulant,
  setWageContract,
  stepColony,
  getApprenticeChemistMultiplier,
  type ColonyState,
  type ColonistArchetype,
  type WageContract,
} from './colony';
import {
  createExperimentQueue,
  stepExperiments,
  type ExperimentQueueState,
} from './campaign/experiments';
import {
  createRealmState,
  stepRealmTurn,
  applyDistributeStimulants,
  applyDistributeClothes,
  applyDistributeWeapons,
  type RealmState,
} from './campaign/realm';
import {
  createInitialSettlementsState,
  foundSettlement,
  recomputeSettlementYields,
  type SettlementsState,
} from './campaign/settlements';
import {
  createBlacksmithState,
  startBatchJob,
  stepBlacksmith,
  type BlacksmithState,
} from './campaign/blacksmith';
import {
  placeDistrict,
} from './campaign/districts';
import {
  createInitialInfluenceState,
  executePowerAction,
  type InfluenceState,
  type PowerAction,
} from './campaign/influence';
import {
  createInitialCorrespondence,
  markLetterRead,
  type CorrespondenceState,
} from './campaign/correspondence';
import {
  createInitialBuiltWorks,
  constructBuiltWork,
  type BuiltWorksState,
} from './campaign/builtWorks';
import {
  createInitialMissions,
  executeMission,
  type MissionsState,
  type MissionVerb,
} from './campaign/missions';
import {
  createInitialVictoryState,
  updateVictoryScores,
  type CampaignVictoryState,
  type UndertowStance,
} from './campaign/victories';
import {
  restoreCampaignFromSave,
  restoreColonyFromSave,
  restoreWorldFromSave,
  sanitizeBlacksmith,
  sanitizeExperiments,
  sanitizePaddock,
  sanitizePlayerSave,
  sanitizeRealm,
  sanitizeSettlements,
} from './worldRestore';
import {
  createCrisisDirector,
  type CrisisContext,
  type CrisisId,
} from './crisis';
import { createTimedRequestManager, type TimedRequestManager } from './timedRequests';
import {
  createInitialLedger,
  stepLedgerDay,
  fulfillSlot,
  acceptSlot,
  getDayWellSpentBonus,
  type LedgerState,
} from './campaign/ledger';
import {
  computeCouplingEffects,
  createCouplingRng,
  type CouplingConfig,
  type CouplingEffects,
} from './campaign/couplings';

export interface FullSimState {
  world: WorldState;
  player: PlayerMetabolismState;
  inventory: InventoryState;
  paddock: Paddock;
}

type Command =
  | {
      type: 'INIT';
      sab: SharedArrayBuffer;
      featureFlags?: { colonyChemistryLink?: boolean };
    }
  | { type: 'LOAD_WORLD'; sab: SharedArrayBuffer; save: any }
  | {
      type: 'CREATE_VESSEL';
      id: number;
      material: VesselMaterialKey;
      capacityL: number;
      closed?: boolean;
      label?: string;
    }
  | { type: 'ADD_SPECIES'; vesselId: number; speciesIdx: number; moles: number }
  | { type: 'ADD_WATER'; vesselId: number; litres: number }
  | { type: 'ADD_ASH'; vesselId: number; grams: number }
  | { type: 'SET_HEATER'; vesselId: number; watts: number }
  | { type: 'SET_CONDENSER'; vesselId: number; targetId: number }
  | { type: 'SET_VOLTS'; vesselId: number; volts: number; resistanceOhm?: number }
  | { type: 'SET_CLOSED'; vesselId: number; closed: boolean }
  | { type: 'CHARGE_ITEM'; vesselId: number; itemId: string; count: number }
  | { type: 'DECANT'; fromId: number; toId: number; litres: number }
  | { type: 'SKIM'; fromId: number; toId: number; speciesIdx: number }
  | { type: 'ADVANCE'; hours: number }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'HARVEST_PART'; partId: string; speciesId: string; carriedMassKg: number; toolSlot: string; distanceMeters: number }
  | { type: 'FABRICATE'; recipeId: string }
  | { type: 'EQUIP_TOOL'; slot: string; toolId?: string; itemId?: string }
  | { type: 'EAT_FOOD'; itemId: string }
  | { type: 'APPLY_TREATMENT'; itemId: string }
  | { type: 'FEED_PADDOCK'; massKg: number }
  | { type: 'WATER_PADDOCK'; liters: number }
  | { type: 'CAPTURE_ANIMAL'; species?: 'GOAT' | 'RED_JUNGLE_FOWL' | 'AUROCHS' }
  | { type: 'RECRUIT_COLONIST'; name: string; archetype: ColonistArchetype; wageContract: WageContract }
  | { type: 'ASSIGN_COLONIST_JOB'; colonistId: string; speciesId: string; partId: string; workRequired?: number }
  | { type: 'ADMINISTER_STIMULANT'; colonistId: string; stimulantId: string }
  | { type: 'SET_WAGE_CONTRACT'; colonistId: string; wageContract: WageContract }
  | { type: 'GRANT_TUTORIAL_REAGENTS'; items?: Array<{ itemId: string; count?: number; massKg?: number }>; vesselSpecies?: Array<{ speciesId: string; moles: number }>; vesselTempK?: number }
  | { type: 'CRISIS_CHOICE'; crisisId: CrisisId; choiceId: string }
  | { type: 'FULFILL_REQUEST'; slot: number }
  | { type: 'DISTRIBUTE_STIMULANTS'; commodity: 'WILLOW_TEA' | 'MINT_TONIC' | 'NITROUS_TONIC'; crates: number }
  | { type: 'DISTRIBUTE_CLOTHES'; tunics: number }
  | { type: 'DISTRIBUTE_WEAPONS'; weaponsCount: number }
  | { type: 'FOUND_SETTLEMENT'; name: string; q: number; r: number }
  | { type: 'SET_TOWN_FOCUS'; settlementId: string; focus: import('./campaign/settlements').TownFocus }
  | { type: 'START_BLACKSMITH_BATCH'; recipeId: string; name: string; batchCount: number; turns: number; outputs: Array<{ itemId: string; count: number }> }
  | { type: 'PLACE_DISTRICT'; settlementId: string; kind: import('./campaign/districts').DistrictKind; q: number; r: number }
  | { type: 'POWER_ACTION'; powerId: string; action: PowerAction }
  | { type: 'CONSTRUCT_BUILT_WORK'; workId: string }
  | { type: 'EXECUTE_MISSION'; operativeId: string; verb: MissionVerb }
  | { type: 'MARK_LETTER_READ'; letterId: string }
  | { type: 'SET_UNDERTOW_STANCE'; stance: UndertowStance }
  | { type: 'ACCEPT_LEDGER_SLOT'; slotId: string }
  | { type: 'FULFILL_LEDGER_SLOT'; slotId: string }
  | { type: 'REQUEST_LEDGER_SYNC' };

interface WorkerCtx {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent<Command>) => void) | null;
}

const ctx = self as unknown as WorkerCtx;

/**
 * Compile-time exhaustiveness guard: if a new Command union member is added
 * without a handler case, `default` receives it typed `never` — this function
 * stops compiling. At runtime (hostile/buggy posters) an unknown command is
 * surfaced as an EVENTS message instead of being silently swallowed.
 */
function assertNeverCommand(command: never): void {
  void command;
  ctx.postMessage({
    type: 'EVENTS',
    events: [{ vesselId: -1, message: 'Unknown simulation command — UI and worker out of sync.' }],
  });
}

let world: WorldState | null = null;
let player: PlayerMetabolismState | null = null;
let inventory: InventoryState | null = null;
let paddock: Paddock | null = null;
let colony: ColonyState = createInitialColonyState();
let experiments: ExperimentQueueState = createExperimentQueue();
let realm: RealmState = createRealmState();
let settlements: SettlementsState = createInitialSettlementsState();
let blacksmith: BlacksmithState = createBlacksmithState();
let view: SharedWorldView | null = null;
let paused = false;
let timer: ReturnType<typeof setInterval> | null = null;
let consecutiveTickErrors = 0;
const labels = new Map<number, string>();

let rngSeed = 0;
let rng = createSeededRng(rngSeed);
const crisis = createCrisisDirector();
let lastCrisisSync = '';
const timedRequests: TimedRequestManager = createTimedRequestManager();
let ledger: LedgerState = createInitialLedger(rngSeed);
let influence: InfluenceState = createInitialInfluenceState(1);
let correspondence: CorrespondenceState = createInitialCorrespondence();
let builtWorks: BuiltWorksState = createInitialBuiltWorks();
let missions: MissionsState = createInitialMissions();
let victories: CampaignVictoryState = createInitialVictoryState();

// ES-3 Colony ↔ Chemistry Couplings
let couplingConfig: CouplingConfig = { enabled: false, rngSeed: 0 };
let couplingEffects: CouplingEffects = {
  laborQuality: null,
  unrestSpoilage: null,
  crashClumsiness: null,
};
let couplingRng: (() => number) | null = null;

function postVessels(): void {
  if (!world) return;
  ctx.postMessage({
    type: 'VESSELS',
    vessels: world.vessels.map((vessel) => ({
      id: vessel.id,
      material: vessel.material,
      capacityL: vessel.capacityL,
      closed: vessel.headspaceClosed,
      label: labels.get(vessel.id) ?? `Vessel ${vessel.id}`,
      condenserTargetVesselId: vessel.condenserTargetVesselId,
      appliedVolts: vessel.appliedVolts,
      cellResistanceOhm: vessel.cellResistanceOhm,
    })),
  });
}

function postPlayerAndInventory(): void {
  if (!player || !inventory || !world) return;
  if (paddock && paddock.animals.length > 0) {
    // paddock tracking
  }
  const items: Array<{ id: string; count: number; massKg: number }> = [];
  for (const slot of inventory.bareHands.slots) if (slot) items.push({ id: slot.itemId, count: slot.count, massKg: slot.massKg });
  for (const slot of inventory.backpack.slots) if (slot) items.push({ id: slot.itemId, count: slot.count, massKg: slot.massKg });
  for (const slot of inventory.campCache.slots) if (slot) items.push({ id: slot.itemId, count: slot.count, massKg: slot.massKg });
  const aggregated = new Map<string, { count: number; massKg: number }>();
  for (const it of items) {
    const existing = aggregated.get(it.id);
    if (existing) { existing.count += it.count; existing.massKg += it.massKg; }
    else aggregated.set(it.id, { count: it.count, massKg: it.massKg });
  }
  const itemsOut = Array.from(aggregated.entries()).map(([id, v]) => ({ id, count: v.count, massKg: v.massKg }));
  const day = 1 + Math.floor(world.tick / 240);
  ctx.postMessage({
    type: 'PLAYER_SYNC',
    player: {
      glucoseKcal: Math.round(player.glucoseKcal),
      adiposeKcal: Math.round(player.adiposeKcal),
      hydrationPct: Math.round(player.hydrationPct),
      coreTempC: ((player.coreTempK - 273.15)).toFixed(1),
      clothingIclo: player.clothingIclo,
      conditions: { ...player.conditions, dead: player.dead },
      dead: player.dead,
      day,
      ambientTempK: Math.round(world.ambientTempK * 100) / 100,
    },
    inventory: {
      backpackUnlocked: inventory.backpack.unlocked,
      bareHands: inventory.bareHands.slots,
      backpack: inventory.backpack.slots,
      campCache: inventory.campCache.slots,
      tools: inventory.tools,
      items: itemsOut,
    },
    paddock: paddock
      ? {
          animals: paddock.animals,
          animalsCount: paddock.animals.length,
          storedFeedKg: paddock.storedFeedKg,
          storedWaterL: paddock.storedWaterL,
          accumulatedManureKg: paddock.accumulatedManureKg,
          feedKg: paddock.storedFeedKg,
          waterL: paddock.storedWaterL,
          manureKg: paddock.accumulatedManureKg,
        }
      : undefined,
  });
}

let lastDesireGridChecksum = -1;

/** FNV-1a over the 1,024-cell wear grid; ~1k integer ops is far cheaper than
 *  boxing the grid into a JS array and structured-cloning it every 100 ms. */
function desireGridChecksum(grid: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < grid.length; i += 1) {
    hash ^= grid[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

function postColonySync(): void {
  if (!colony) return;
  const checksum = desireGridChecksum(colony.desirePathGrid);
  // First sync is always full; after that, keyframe every 100 ticks (10 s) in
  // case a checksum ever collides.
  const firstSync = lastDesireGridChecksum === -1;
  const keyframe = !!world && world.tick > 0 && world.tick % 100 === 0;
  const includeGrid = firstSync || keyframe || checksum !== lastDesireGridChecksum;
  lastDesireGridChecksum = checksum;
  ctx.postMessage({
    type: 'COLONY_SYNC',
    colony: {
      colonists: colony.colonists,
      ledger: colony.ledger,
      // Transfer the typed array directly (structured clone supports it), and
      // only when the wear pattern actually changed.
      desirePathGrid: includeGrid ? colony.desirePathGrid : undefined,
      nextColonistId: colony.nextColonistId,
      lastDecayTick: colony.lastDecayTick,
    },
  });
}

function postCampaignSync(): void {
  ctx.postMessage({
    type: 'EXPERIMENTS_SYNC',
    experiments,
  });
  ctx.postMessage({
    type: 'REALM_SYNC',
    realm,
  });
  ctx.postMessage({
    type: 'SETTLEMENTS_SYNC',
    settlements,
  });
  ctx.postMessage({
    type: 'BLACKSMITH_SYNC',
    blacksmith,
  });
  ctx.postMessage({
    type: 'LEDGER_SYNC',
    ledger,
    couplingEffects,
    couplingSpoilageSeed: couplingConfig.enabled ? couplingConfig.rngSeed + 0x1234567 : 0,
  });
  ctx.postMessage({
    type: 'CAMPAIGN_SYNC',
    influence,
    correspondence,
    builtWorks,
    missions,
    victories,
  });
}

/** Posts CRISIS_SYNC only when the crisis snapshot changed (dirty compare). */
function postCrisisSync(): void {
  const snap = crisis.snapshot();
  const payload = JSON.stringify({ telegraph: snap.telegraph, active: snap.active });
  if (payload === lastCrisisSync) return;
  lastCrisisSync = payload;
  ctx.postMessage({ type: 'CRISIS_SYNC', telegraph: snap.telegraph, active: snap.active });
}

let lastRequestSync = '';

function postRequestSync(): void {
  const payload = JSON.stringify(timedRequests.slots);
  if (payload === lastRequestSync) return;
  lastRequestSync = payload;
  ctx.postMessage({
    type: 'REQUEST_SYNC',
    slots: timedRequests.slots,
  });
}

const emittedSpeciesMilestones = new Set<string>();

function checkAndEmitSpeciesObjectives(): void {
  if (!world) return;
  for (const vessel of world.vessels) {
    for (let s = 0; s < vessel.moles.length; s++) {
      const amount = vessel.moles[s]; // vessel.moles already includes total moles
      if (amount >= 0.005) {
        const spec = SPECIES_BY_INDEX.get(s);
        if (spec) {
          // Find matching SPECIES enum key
          const enumKey = String((Object.keys(SPECIES) as Array<keyof typeof SPECIES>).find(k => SPECIES[k] === s) ?? spec.code);
          const milestoneKey = `${enumKey}:${Math.floor(amount * 10)}`;
          if (!emittedSpeciesMilestones.has(milestoneKey)) {
            emittedSpeciesMilestones.add(milestoneKey);
            ctx.postMessage({
              type: 'OBJECTIVE',
              kind: 'species',
              target: enumKey,
              amount,
            });
          }
        }
      }
    }
  }
}

function stepSingleTick(activitySeconds: number = SIM_STEP_SECONDS): WorldEvent[] {
  if (!world || !player) return [];
  const events: WorldEvent[] = [];
  events.push(...stepWorld(world, activitySeconds));
  stepPlayerMetabolism(player, {
    dtSeconds: activitySeconds,
    ambientTempK: world.ambientTempK,
  });
  const condEvents = escalateConditions(player, activitySeconds / 3600);
  for (const ev of condEvents) events.push({ vesselId: -1, message: ev.message });
  if (inventory) {
    stepColony(colony, activitySeconds / 60, world.tick, inventory.campCache, BIOME_DAG);
  }
  if (world.tick > 0 && world.tick % 240 === 0 && paddock && paddock.animals.length > 0) {
    const yields = stepPaddockDay(paddock);
    if (yields.butterfatGrams > 0 && inventory) {
      const butterfatSlot = {
        itemId: 'RAW_ADIPOSE_FAT',
        count: 1,
        massKg: yields.butterfatGrams / 1000,
        quality: 1.0,
        label: 'Rendered Butterfat',
      };
      addItemToAnyContainer(inventory, butterfatSlot);
    }
    if (yields.eggs > 0 && inventory) {
      const eggSlot = { itemId: 'FIELD_MUSHROOM', count: yields.eggs, massKg: yields.eggs * 0.05, label: 'Fresh Egg' };
      addItemToAnyContainer(inventory, eggSlot);
    }
    events.push({ vesselId: -1, message: `Paddock yields: ${yields.milkL.toFixed(1)} L milk, ${yields.butterfatGrams.toFixed(0)} g butterfat, ${yields.eggs} eggs, ${yields.manureKg.toFixed(2)} kg manure.` });
  }
  checkAndEmitSpeciesObjectives();
  if (inventory) {
    const crisisContext: CrisisContext = { world, player, inventory, colony, rng };
    const crisisEvents = crisis.tick(world.tick, paused, crisisContext);
    if (crisisEvents.activated) {
      events.push({ vesselId: -1, message: `⚠ Crisis: ${crisisEvents.activated.title}.` });
    }
    for (const msg of crisisEvents.autoResolved) {
      events.push({ vesselId: -1, message: msg });
    }
    if (batchDepth === 0) postCrisisSync();

    timedRequests.step(world.tick, (expiredReq) => {
      events.push({ vesselId: -1, message: `⌛ Request expired: ${expiredReq.title}` });
    });
    if (batchDepth === 0) postRequestSync();
  }
  return events;
}

let batchDepth = 0;

const CHARGEABLE_REAGENTS: Record<string, (vessel: VesselState, count: number) => void> = {
  CHARCOAL: (v, count) => { v.moles[SPECIES.CARBON] += count * (50 / 12.011); },
  LIMESTONE_ROCK: (v, count) => { v.moles[SPECIES.CACO3] += count * (200 / 100.086); },
  HALITE_SALT: (v, count) => { v.moles[SPECIES.NACL] += count * (50 / 58.44); },
  RAW_ADIPOSE_FAT: (v, count) => { v.moles[SPECIES.TRISTEARIN] += count * (150 / 891.5); },
  MALACHITE_ORE: (v, count) => { v.moles[SPECIES.MALACHITE] += count * (100 / 221.12); },
  CASSITERITE_ORE: (v, count) => { v.moles[SPECIES.CASSITERITE] += count * (100 / 150.71); },
  SPHALERITE_ORE: (v, count) => { v.moles[SPECIES.SPHALERITE] += count * (100 / 97.47); },
  PYRITE_ORE: (v, count) => { v.moles[SPECIES.PYRITE] += count * (100 / 119.98); },
  SALTPETER_CRYSTALS: (v, count) => { v.moles[SPECIES.KNO3] += count * (50 / 101.1); },
  WILLOW_BARK: (v, count) => { v.moles[SPECIES.SALICIN] += count * (25 / 286.28); },
};

function advance(hours: number): WorldEvent[] {
  if (!world || !player) return [];
  if (player.dead) return [];
  const steps = Math.max(1, Math.round(hours * WORKER_HZ));
  const events: WorldEvent[] = [];
  const startDay = 1 + Math.floor(world.tick / 240);
  batchDepth++;
  try {
    for (let step = 0; step < steps; step += 1) {
      events.push(...stepSingleTick(SIM_STEP_SECONDS));
    }
  } finally {
    batchDepth--;
    postCrisisSync();
    postRequestSync();
  }
  const endDay = 1 + Math.floor(world.tick / 240);
  const daysAdvanced = Math.max(0, endDay - startDay);

  const benchLedger: Array<{ label: string; turnsLeft: number; done: boolean }> = [];
  if (daysAdvanced > 0) {
    for (let d = 0; d < daysAdvanced; d++) {
      const expRes = stepExperiments(experiments, startDay + d);
      for (const comp of expRes.completed) {
        benchLedger.push({ label: comp.recipeName || comp.recipeId, turnsLeft: 0, done: true });
        events.push({ vesselId: -1, message: `Finished experiment: ${comp.recipeName || comp.recipeId}` });
      }
      for (const q of experiments.experiments) {
        benchLedger.push({ label: q.recipeName || q.recipeId, turnsLeft: q.turnsLeft, done: false });
      }

      const realmRes = stepRealmTurn(realm, () => rng.next());
      for (const warn of realmRes.warnings) {
        events.push({ vesselId: -1, message: warn });
      }
      if (realmRes.deposalOccurred) {
        events.push({ vesselId: -1, message: `DEPOSAL ENDGAME: Mandate collapsed (${realmRes.deposalOccurred}).` });
      }

      // Step Crown's Ledger
      stepLedgerDay(ledger);
      // Check for "Day Well Spent" bonus after step
      const dayWellSpent = getDayWellSpentBonus(ledger);
      if (dayWellSpent) {
        events.push({ vesselId: -1, message: dayWellSpent.message });
        if (colony) {
          // Apply +6 morale to all colonists
          for (const c of colony.colonists) {
            c.morale = Math.min(100, c.morale + dayWellSpent.moraleBonus);
          }
        }
      }

      // Recompute ES-3 Colony ↔ Chemistry Couplings after day advancement
      if (couplingConfig.enabled && couplingRng) {
        couplingEffects = computeCouplingEffects(couplingConfig, colony);
      }

      // Step Blacksmith tool wear and batch jobs
      const smithRes = stepBlacksmith(blacksmith);
      for (const bJob of smithRes.completedJobs) {
        events.push({ vesselId: -1, message: `Blacksmith completed: ${bJob.name} (x${bJob.batchCount})` });
        if (inventory) {
          for (const out of bJob.outputs) {
            addItemToContainer(inventory.campCache, {
              itemId: out.itemId,
              count: out.count,
              massKg: out.count * 0.5,
              label: bJob.name,
            });
          }
        }
      }
      if (smithRes.toolDegraded) {
        events.push({ vesselId: -1, message: `⚠ Tool wear threshold reached. Maintenance required at the Forge.` });
      }

      // Recompute settlement yields
      recomputeSettlementYields(settlements);

      // Cross-age victory scores and built-work health infrastructure.
      updateVictoryScores(victories, {
        settlements,
        realm,
        builtWorks,
        currentAge: 1,
      });
      if (builtWorks.activeHealthBonusPerTurn > 0) {
        realm.health = Math.min(100, realm.health + builtWorks.activeHealthBonusPerTurn);
      }
    }

    ctx.postMessage({
      type: 'TURN_RECAP',
      turn: endDay,
      events,
      benchLedger,
    });
  }

  if (view) syncWorldToShared(world, view);
  postPlayerAndInventory();
  postColonySync();
  postCampaignSync();
  return events;
}

function tick(): void {
  if (!world || !view || !player || paused) return;
  if (player.dead) return;
  try {
    const events = stepSingleTick(SIM_STEP_SECONDS);
    syncWorldToShared(world, view);
    if (events.length > 0) ctx.postMessage({ type: 'EVENTS', events });
    postPlayerAndInventory();
    postColonySync();
    consecutiveTickErrors = 0;
  } catch (err) {
    consecutiveTickErrors += 1;
    const message = err instanceof Error ? err.message : String(err);
    if (consecutiveTickErrors >= 3) {
      paused = true;
      ctx.postMessage({ type: 'SIM_FATAL', message });
      return;
    }
    ctx.postMessage({
      type: 'SIM_ERROR',
      command: 'tick',
      message,
    });
  }
}

ctx.onmessage = (event: MessageEvent<Command>) => {
  const command = event.data;
  try {
    handleCommand(command);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A failed load on a fresh worker has no fallback state: surface it as a
    // typed error so the UI can restart instead of waiting for a READY that
    // will never arrive.
    if (command?.type === 'LOAD_WORLD') {
      ctx.postMessage({ type: 'LOAD_ERROR', message });
    }
    ctx.postMessage({
      type: 'SIM_ERROR',
      command: command?.type,
      message,
    });
  }
};

function handleCommand(command: Command): void {
  switch (command.type) {
    case 'INIT': {
      if (command.sab.byteLength !== SAB_BYTE_LENGTH) {
        throw new Error(`Bad SAB size ${command.sab.byteLength}`);
      }
      view = new SharedWorldView(command.sab);
      world = createWorld();
      player = createPlayerMetabolism(0.05);
      inventory = createInventoryState();
      paddock = createPaddock();
      rngSeed = (Math.random() * 0xffffffff) >>> 0;
      rng = createSeededRng(rngSeed);
      crisis.reset(rngSeed, 0);
      colony = createInitialColonyState();
      lastDesireGridChecksum = -1;
      lastRequestSync = '';
      influence = createInitialInfluenceState(1);
      correspondence = createInitialCorrespondence();
      builtWorks = createInitialBuiltWorks();
      missions = createInitialMissions();
      victories = createInitialVictoryState();

      // Initialize ES-3 Colony ↔ Chemistry Couplings from the single UI-owned
      // feature flag (defaults on for callers that omit it, e.g. tests).
      couplingConfig = {
        enabled: command.featureFlags?.colonyChemistryLink ?? true,
        rngSeed: rngSeed + 0x9e3779b9,
      };
      couplingRng = createCouplingRng(couplingConfig.rngSeed);
      couplingEffects = computeCouplingEffects(couplingConfig, colony);

      syncWorldToShared(world, view);
      if (timer === null) timer = setInterval(tick, 1000 / WORKER_HZ);
      ctx.postMessage({ type: 'READY', rngSeed });
      postPlayerAndInventory();
      postColonySync();
      postCampaignSync();
      postCrisisSync();
      break;
    }
    case 'LOAD_WORLD': {
      const save = command.save;
      if (!command.sab || command.sab.byteLength !== SAB_BYTE_LENGTH) {
        throw new Error(`Bad SAB size ${(command as any).sab?.byteLength}`);
      }
      const restoredLabels = new Map<number, string>();
      const restoredWorld = restoreWorldFromSave(save, restoredLabels);
      const newView = new SharedWorldView(command.sab);

      // Mutate state only after successful restore & validation
      labels.clear();
      for (const [k, v] of restoredLabels) labels.set(k, v);
      world = restoredWorld;
      view = newView;
      player = createPlayerMetabolism();
      Object.assign(player, sanitizePlayerSave(save.player));
      if (save.inventory && (save.inventory as any).bareHands && Array.isArray((save.inventory as any).bareHands.slots)) {
        inventory = save.inventory;
      } else if (save.inventory) {
        inventory = createInventoryState();
        const normalizeSlots = (rawSlots: any[], container: any) => {
          if (!Array.isArray(rawSlots)) return;
          for (const item of rawSlots) {
            if (!item) continue;
            const itemId = item.itemId || item.id;
            if (!itemId) continue;
            const count = item.count ?? 1;
            const massKg = item.massKg ?? 0.1;
            const quality = item.quality ?? 1.0;
            const label = item.label;
            for (let i = 0; i < container.slots.length; i++) {
              if (!container.slots[i]) {
                container.slots[i] = { itemId, count, massKg, quality, label };
                break;
              }
            }
          }
        };
        const rawInv = save.inventory as any;
        normalizeSlots(rawInv.bareHands, inventory.bareHands);
        normalizeSlots(rawInv.backpack, inventory.backpack);
        normalizeSlots(rawInv.campCache, inventory.campCache);
        if (rawInv.tools) {
          Object.assign(inventory.tools, rawInv.tools);
        }
        if (rawInv.backpackUnlocked !== undefined) {
          inventory.backpack.unlocked = !!rawInv.backpackUnlocked;
        }
      } else {
        inventory = createInventoryState();
      }
      rngSeed = save.rngSeed ?? ((Math.random() * 0xffffffff) >>> 0);
      rng = createSeededRng(rngSeed);
      crisis.reset(rngSeed, save.tick ?? 0);
      paddock = sanitizePaddock(save.paddock);
      colony = restoreColonyFromSave(save);
      lastDesireGridChecksum = -1;
      lastRequestSync = '';

      const campaignSlice = restoreCampaignFromSave(save);
      influence = campaignSlice.influence;
      correspondence = campaignSlice.correspondence;
      builtWorks = campaignSlice.builtWorks;
      missions = campaignSlice.missions;
      victories = campaignSlice.victories;

      // Initialize ES-3 Colony ↔ Chemistry Couplings
      couplingConfig = {
        enabled: save.featureFlags?.colonyChemistryLink ?? true,
        rngSeed: rngSeed + 0x9e3779b9, // Different seed for coupling RNG
      };
      couplingRng = createCouplingRng(couplingConfig.rngSeed);
      // Initialize coupling effects based on current colony state
      couplingEffects = computeCouplingEffects(couplingConfig, colony);

      if (Array.isArray(save.timedRequests)) {
        timedRequests.restore(save.timedRequests);
      }
      experiments = sanitizeExperiments(save.experiments);
      realm = sanitizeRealm(save.realm);
      settlements = sanitizeSettlements(save.settlements);
      blacksmith = sanitizeBlacksmith(save.blacksmith);

      syncWorldToShared(world, view);
      if (timer === null) timer = setInterval(tick, 1000 / WORKER_HZ);
      ctx.postMessage({ type: 'READY', rngSeed });
      postVessels();
      postPlayerAndInventory();
      postColonySync();
      postCampaignSync();
      postCrisisSync();
      break;
    }
    case 'CREATE_VESSEL': {
      if (!world) return;
      if (world.vessels.length >= MAX_VESSELS) {
        ctx.postMessage({
          type: 'EVENTS',
          events: [{ vesselId: command.id, message: `Cannot create vessel: maximum limit of ${MAX_VESSELS} reached.` }],
        });
        break;
      }
      createWorldVessel(
        world,
        command.id,
        command.material,
        command.capacityL,
        command.closed ?? false,
      );
      labels.set(command.id, command.label ?? `Vessel ${command.id}`);
      postVessels();
      break;
    }
    case 'ADD_SPECIES': {
      const vessel = world && findVessel(world, command.vesselId);
      if (!vessel) return;
      vessel.moles[command.speciesIdx] += command.moles;
      break;
    }
    case 'ADD_WATER': {
      const vessel = world && findVessel(world, command.vesselId);
      if (vessel) addWaterLiters(vessel, command.litres);
      break;
    }
    case 'ADD_ASH': {
      const vessel = world && findVessel(world, command.vesselId);
      if (vessel) addHardwoodAsh(vessel, command.grams);
      break;
    }
    case 'SET_HEATER': {
      const vessel = world && findVessel(world, command.vesselId);
      if (vessel) vessel.heaterWatts = Math.max(0, command.watts);
      break;
    }
    case 'SET_CONDENSER': {
      const vessel = world && findVessel(world, command.vesselId);
      if (vessel) {
        vessel.condenserTargetVesselId = command.targetId;
        postVessels();
      }
      break;
    }
    case 'SET_VOLTS': {
      const vessel = world && findVessel(world, command.vesselId);
      if (vessel) {
        vessel.appliedVolts = Math.max(0, command.volts);
        if (command.resistanceOhm !== undefined) {
          vessel.cellResistanceOhm = Math.max(0.01, command.resistanceOhm);
        }
        postVessels();
      }
      break;
    }
    case 'SET_CLOSED': {
      const vessel = world && findVessel(world, command.vesselId);
      if (vessel) {
        vessel.headspaceClosed = command.closed;
        postVessels();
      }
      break;
    }
    case 'CHARGE_ITEM': {
      const vessel = world && findVessel(world, command.vesselId);
      if (!vessel || !inventory) break;
      const count = command.count || 1;
      const chargeFn = CHARGEABLE_REAGENTS[command.itemId];
      if (!chargeFn) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: command.vesselId, message: `${command.itemId} cannot be charged as a chemical reagent.` }] });
        break;
      }
      const removed = removeItemFromAnyContainer(inventory, command.itemId, count);
      if (!removed) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: command.vesselId, message: `No ${command.itemId} in inventory to charge!` }] });
        break;
      }

      chargeFn(vessel, count);
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: command.vesselId, message: `Charged ${count}x ${command.itemId} into Vessel #${command.vesselId}` }] });
      postPlayerAndInventory();
      break;
    }
    case 'DECANT': {
      if (world) decantWorld(world, command.fromId, command.toId, command.litres);
      break;
    }
    case 'SKIM': {
      if (world) {
        const skimmedMoles = skimWorld(world, command.fromId, command.toId, command.speciesIdx);
        if (skimmedMoles > 0 && command.speciesIdx === SPECIES.NA_STEARATE && inventory) {
          // 1 bar of soap is roughly 0.3 moles Na-stearate (~92g)
          const barsToAdd = Math.max(1, Math.floor(skimmedMoles / 0.3));
          const soapSlot = {
            itemId: 'BAR_SOAP',
            label: 'Bar Soap',
            count: barsToAdd,
            massKg: barsToAdd * 0.1,
          };
          if (!addItemToAnyContainer(inventory, soapSlot)) {
            ctx.postMessage({
              type: 'EVENTS',
              events: [{ vesselId: command.fromId, message: `Skimmed soap, but containers full! Output lost.` }],
            });
          } else {
            ctx.postMessage({
              type: 'EVENTS',
              events: [{ vesselId: command.fromId, message: `Skimmed and formed ${barsToAdd} Bar Soap!` }],
            });
            ctx.postMessage({ type: 'OBJECTIVE', kind: 'item_acquired', target: 'BAR_SOAP' });
            postPlayerAndInventory();
          }
        }
      }
      break;
    }
    case 'ADVANCE': {
      if (!world || !view) return;
      const events = advance(command.hours);
      if (events.length > 0) ctx.postMessage({ type: 'EVENTS', events });
      syncWorldToShared(world, view);
      postPlayerAndInventory();
      break;
    }
    case 'SET_PAUSED': {
      paused = command.paused;
      break;
    }
    case 'HARVEST_PART': {
      if (!player || !inventory || !world) return;
      const speciesNode = BIOME_DAG.flatMap(c => c.species).find(s => s.id === command.speciesId);
      const part = speciesNode?.parts.find(p => p.id === command.partId);
      if (!part || !speciesNode) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Unknown part: ${command.partId}` }] });
        return;
      }
      const toolSlot = command.toolSlot as import('./fabrication').ToolSlotKey;
      const tool = inventory.tools[toolSlot] ?? null;
      const result = applyHarvest(player, inventory, part, speciesNode.baseDistanceMeters, toolSlot as any, tool, rng);
      if (!result.ok) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Too exhausted to forage (need ≈ ${Math.round(result.kcalCost)} kcal)` }] });
      } else {
        for (const added of result.added) {
          ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Harvested ${added.count}× ${added.itemId} (to ${added.container})` }] });
        }
        if (result.overflowKg > 0) {
          ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Overflow: ${result.overflowKg.toFixed(1)} kg left behind` }] });
        }
        if (result.wound) {
          ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `The boar's tusk opens your forearm. The wound festers.` }] });
        }
        ctx.postMessage({ type: 'OBJECTIVE', kind: 'harvest', target: command.partId });
      }
      postPlayerAndInventory();
      break;
    }
    case 'FABRICATE': {
      if (!inventory || !player || !world) return;
      const recipe = FABRICATION_RECIPES.find(r => r.id === command.recipeId);
      if (!recipe) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Unknown recipe: ${command.recipeId}` }] });
        return;
      }
      const containerInputs = recipe.inputs.filter(i => !VESSEL_INPUTS[i.itemId]);
      const vesselInputIds = recipe.inputs.filter(i => VESSEL_INPUTS[i.itemId]).map(i => i.itemId);

      // Check tool requirement if defined
      if (recipe.requiredToolSlot && !inventory.tools[recipe.requiredToolSlot]) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Requires tool in slot: ${recipe.requiredToolSlot}` }] });
        return;
      }

      // Check player glucose energy cost
      const toolMA = recipe.requiredToolSlot && inventory.tools[recipe.requiredToolSlot] ? inventory.tools[recipe.requiredToolSlot]!.mechanicalAdvantage : 1.0;
      const apprenticeMult = colony ? getApprenticeChemistMultiplier(colony) : 1.0;
      const energyCost = Math.max(1, (recipe.energyCostKcal / Math.max(1.0, toolMA)) / apprenticeMult);
      if (player.glucoseKcal < energyCost) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Exhausted: requires ${energyCost.toFixed(0)} kcal glucose` }] });
        return;
      }
      const needMap = new Map<string, number>();
      for (const inp of containerInputs) needMap.set(inp.itemId, (needMap.get(inp.itemId) ?? 0) + inp.count);
      const missing: string[] = [];
      for (const [itemId, need] of needMap) {
        let have = 0;
        for (const s of inventory.bareHands.slots) if (s && s.itemId === itemId) have += s.count;
        for (const s of inventory.backpack.slots) if (s && s.itemId === itemId) have += s.count;
        for (const s of inventory.campCache.slots) if (s && s.itemId === itemId) have += s.count;
        if (have < need) missing.push(`${need - have}× ${ITEM_BY_ID[itemId]?.name ?? itemId}`);
      }
      let vesselResult: VesselInputResult = { ok: true, plan: [] };
      if (vesselInputIds.length > 0) {
        vesselResult = satisfyVesselInputs(world.vessels, vesselInputIds);
        if (!vesselResult.ok) missing.push(...vesselResult.shortfall!.map(s => `(bench) ${s}`));
      }
      if (missing.length > 0) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Missing: ${missing.join(', ')}` }] });
        return;
      }

      // Check output capacity plan before deducting items
      const outputSlots = recipe.outputs.map(out => ({
        itemId: out.itemId,
        count: out.count,
        massKg: 0.1,
        label: out.label,
      }));
      if (!canFitItemsInInventory(inventory, outputSlots)) {
        ctx.postMessage({
          type: 'EVENTS',
          events: [{ vesselId: -1, message: `Cannot fabricate ${recipe.name}: inventory and camp storage full!` }],
        });
        return;
      }

      for (const [itemId, need] of needMap) {
        let remaining = need;
        for (let i = 0; i < inventory.bareHands.slots.length && remaining > 0; i++) {
          const s = inventory.bareHands.slots[i];
          if (s && s.itemId === itemId) { const take = Math.min(s.count, remaining); s.count -= take; remaining -= take; if (s.count === 0) inventory.bareHands.slots[i] = null; }
        }
        for (let i = 0; i < inventory.backpack.slots.length && remaining > 0; i++) {
          const s = inventory.backpack.slots[i];
          if (s && s.itemId === itemId) { const take = Math.min(s.count, remaining); s.count -= take; remaining -= take; if (s.count === 0) inventory.backpack.slots[i] = null; }
        }
        for (let i = 0; i < inventory.campCache.slots.length && remaining > 0; i++) {
          const s = inventory.campCache.slots[i];
          if (s && s.itemId === itemId) { const take = Math.min(s.count, remaining); s.count -= take; remaining -= take; if (s.count === 0) inventory.campCache.slots[i] = null; }
        }
      }
      if (vesselResult.ok && vesselResult.plan) applyVesselConsumption(world.vessels, vesselResult.plan);
      player.glucoseKcal = Math.max(0, player.glucoseKcal - energyCost);
      for (const out of recipe.outputs) {
        const slot = { itemId: out.itemId, count: out.count, massKg: 0.1, label: out.label };
        if (!addItemToContainer(inventory.bareHands, slot)) if (!addItemToContainer(inventory.backpack, slot)) addItemToContainer(inventory.campCache, slot);
      }
      const effect = RECIPE_EFFECTS[command.recipeId];
      if (effect?.onFabricate === 'unlock_backpack') {
        unlockBackpack(inventory);
        if (player) player.clothingIclo = 1.15;
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: '🎉 Crafted Vegetable-Tanned Leather Backpack! 24-slot inventory unlocked (I_clo = 1.15).' }] });
      } else if (effect?.onFabricate === 'equip_eating_utensil' && player) {
        inventory.tools.EATING_UTENSIL = METALLURGY_TOOLS.BRONZE_FORK;
      } else if (effect?.onFabricate === 'equip_weapon' && player) {
        inventory.tools.CUTTING_SKINNING = METALLURGY_TOOLS.BRONZE_SPEAR;
      } else if (effect?.onFabricate === 'equip_axe' && player) {
        inventory.tools.CHOPPING_CARVING = METALLURGY_TOOLS.BRONZE_AXE;
      }
      ctx.postMessage({ type: 'OBJECTIVE', kind: 'recipe', target: command.recipeId });
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Fabricated ${recipe.name}` }] });
      postPlayerAndInventory();
      break;
    }
    case 'EQUIP_TOOL': {
      if (!inventory) return;
      const slot = command.slot as import('./fabrication').ToolSlotKey;
      const toolId = command.itemId ?? command.toolId;
      if (!toolId) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: 'No tool ID specified to equip' }] });
        return;
      }
      const tool = resolveToolItem(toolId);
      if (!tool) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Unknown tool: ${toolId}` }] });
        return;
      }

      // Check if tool is present in containers
      let foundContainer: typeof inventory.bareHands | null = null;
      let foundIndex = -1;
      for (const container of [inventory.bareHands, inventory.backpack, inventory.campCache]) {
        for (let i = 0; i < container.slots.length; i++) {
          const s = container.slots[i];
          if (s && s.itemId === toolId) {
            foundContainer = container;
            foundIndex = i;
            break;
          }
        }
        if (foundContainer) break;
      }
      if (!foundContainer || foundIndex < 0) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Tool not in inventory: ${toolId}` }] });
        return;
      }

      // If replacing an existing equipped tool, ensure there is room to unequip it
      const prev = inventory.tools[slot];
      if (prev) {
        // Test transaction on simulated copy
        const sim = cloneInventoryState(inventory);
        const simContainer =
          foundContainer.id === sim.bareHands.id ? sim.bareHands :
          foundContainer.id === sim.backpack.id ? sim.backpack : sim.campCache;
        const s = simContainer.slots[foundIndex];
        if (s) {
          s.count--;
          if (s.count <= 0) simContainer.slots[foundIndex] = null;
        }
        const prevSlot = { itemId: prev.id, count: 1, massKg: 0.5, label: prev.name };
        if (!addItemToAnyContainer(sim, prevSlot)) {
          ctx.postMessage({
            type: 'EVENTS',
            events: [{ vesselId: -1, message: `Cannot swap tool: no storage room for ${prev.name}!` }],
          });
          return;
        }
      }

      // Execute equip transaction
      const targetSlot = foundContainer.slots[foundIndex]!;
      targetSlot.count--;
      if (targetSlot.count <= 0) foundContainer.slots[foundIndex] = null;

      if (prev) {
        const prevSlot = { itemId: prev.id, count: 1, massKg: 0.5, label: prev.name };
        addItemToAnyContainer(inventory, prevSlot);
      }
      inventory.tools[slot] = tool;
      postPlayerAndInventory();
      break;
    }
    case 'EAT_FOOD': {
      if (!player || !inventory) return;
      const item = ITEM_BY_ID[command.itemId];
      if (!item || !item.foodKcal) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Not edible: ${command.itemId}` }] });
        return;
      }
      let removed = false;
      for (const container of [inventory.bareHands, inventory.backpack, inventory.campCache]) {
        for (let i = 0; i < container.slots.length; i++) {
          const s = container.slots[i];
          if (s && s.itemId === command.itemId) {
            s.count--;
            if (s.count <= 0) container.slots[i] = null;
            removed = true;
            break;
          }
        }
        if (removed) break;
      }
      if (!removed) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `No ${item.name} to eat` }] });
        return;
      }
      const result = consumeFood(player, item.foodKcal, { hasCleanUtensil: !!inventory.tools.EATING_UTENSIL });
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `+${Math.round(result.absorbedKcal)} kcal absorbed${result.bonusKcal > 0 ? ' (fork bonus +15%)' : ''}` }] });
      ctx.postMessage({ type: 'OBJECTIVE', kind: 'eat', target: command.itemId });
      postPlayerAndInventory();
      break;
    }
    case 'APPLY_TREATMENT': {
      if (!player || !inventory) return;
      const item = ITEM_BY_ID[command.itemId];
      if (!item) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Unknown item: ${command.itemId}` }] });
        return;
      }

      // Check condition first before consuming valuable medical items
      let needed = false;
      if (command.itemId === 'SALINE_RINSE' || command.itemId === 'ETHANOL_DISINFECTANT') {
        needed = !!player.conditions.woundContamination;
      } else if (command.itemId === 'SALICYLIC_ACID_TINCTURE') {
        needed = !!player.conditions.fever;
      } else if (command.itemId === 'PENICILLIN_DOSE') {
        needed = !!player.conditions.systemicInfection;
      }

      if (!needed) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `No active condition requiring ${item.name}.` }] });
        return;
      }

      // Check item presence first across all containers before altering conditions
      let removed = false;
      for (const container of [inventory.bareHands, inventory.backpack, inventory.campCache]) {
        for (let i = 0; i < container.slots.length; i++) {
          const s = container.slots[i];
          if (s && s.itemId === command.itemId) {
            s.count--;
            if (s.count <= 0) container.slots[i] = null;
            removed = true;
            break;
          }
        }
        if (removed) break;
      }
      if (!removed) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `No ${item.name} available to treat with` }] });
        return;
      }

      let message = '';
      let treatKind = '';
      if (command.itemId === 'SALINE_RINSE' || command.itemId === 'ETHANOL_DISINFECTANT') {
        if (player.conditions.woundContamination) {
          player.conditions.woundContamination = false;
          (player as any).woundOnsetSeconds = 0;
          message = 'Wound cleaned and disinfected.';
          treatKind = 'antiseptic';
        } else {
          message = 'No wound to treat.';
        }
      } else if (command.itemId === 'SALICYLIC_ACID_TINCTURE') {
        if (player.conditions.fever) {
          const r = applySalicylicAcid(player);
          message = `Fever reduced by ${r.tempDropC} °C.`;
          treatKind = 'tincture';
        } else {
          message = 'No fever to treat.';
        }
      } else if (command.itemId === 'PENICILLIN_DOSE') {
        if (player.conditions.systemicInfection) {
          applyPenicillin(player);
          message = 'Sepsis cured — the infection retreats.';
          treatKind = 'penicillin';
        } else {
          message = 'No systemic infection to cure.';
        }
      } else {
        message = `Cannot treat with ${item.name}.`;
      }

      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message }] });
      if (treatKind) ctx.postMessage({ type: 'OBJECTIVE', kind: 'treat', target: treatKind });
      postPlayerAndInventory();
      break;
    }
    case 'FEED_PADDOCK': {
      if (!paddock) return;
      paddock.storedFeedKg += command.massKg;
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Refilled paddock feeder (+${command.massKg} kg)` }] });
      postPlayerAndInventory();
      break;
    }
    case 'WATER_PADDOCK': {
      if (!paddock) return;
      paddock.storedWaterL += command.liters;
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Refilled paddock water trough (+${command.liters} L)` }] });
      postPlayerAndInventory();
      break;
    }
    case 'CAPTURE_ANIMAL': {
      if (!paddock) paddock = createPaddock();
      if (paddock.animals.length >= paddock.maxAnimals) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Paddock is full (max ${paddock.maxAnimals})!` }] });
        break;
      }
      const animal = captureAnimal(command.species || 'GOAT');
      paddock.animals.push(animal);
      if (player) {
        // Animal capture takes stamina/glucose
        player.glucoseKcal = Math.max(50, player.glucoseKcal - 120);
      }
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Captured ${animal.species} for paddock (-120 kcal)` }] });
      postPlayerAndInventory();
      break;
    }
    case 'RECRUIT_COLONIST': {
      const currentTick = world ? world.tick : 0;
      const c = recruitColonist(colony, command.name, command.archetype, command.wageContract, currentTick);
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Recruited ${c.name} (${c.archetype})` }] });
      postColonySync();
      break;
    }
    case 'ASSIGN_COLONIST_JOB': {
      const c = colony.colonists.find(col => col.id === command.colonistId);
      if (c) {
        assignColonistJob(c, command.speciesId, command.partId, command.workRequired);
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Assigned ${c.name} to gather ${command.partId}` }] });
        postColonySync();
      }
      break;
    }
    case 'ADMINISTER_STIMULANT': {
      const c = colony.colonists.find(col => col.id === command.colonistId);
      if (c && inventory) {
        // Find stimulant in inventory first before removing
        let foundContainer = null;
        let foundSlotIndex = -1;
        for (const container of [inventory.bareHands, inventory.backpack, inventory.campCache]) {
          for (let i = 0; i < container.slots.length; i++) {
            const s = container.slots[i];
            if (s && s.itemId === command.stimulantId) {
              foundContainer = container;
              foundSlotIndex = i;
              break;
            }
          }
          if (foundContainer) break;
        }

        if (!foundContainer || foundSlotIndex === -1) {
          ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `No ${command.stimulantId} in inventory to administer` }] });
          return;
        }

        const ok = administerStimulant(c, command.stimulantId);
        if (ok) {
          const s = foundContainer.slots[foundSlotIndex]!;
          s.count--;
          if (s.count <= 0) foundContainer.slots[foundSlotIndex] = null;
          ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Administered ${command.stimulantId} to ${c.name}` }] });
        } else {
          ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Failed to administer stimulant ${command.stimulantId}` }] });
        }
        postPlayerAndInventory();
        postColonySync();
      }
      break;
    }
    case 'SET_WAGE_CONTRACT': {
      const c = colony.colonists.find(col => col.id === command.colonistId);
      if (c) {
        setWageContract(c, command.wageContract);
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Updated wage contract for ${c.name}` }] });
        postColonySync();
      }
      break;
    }
    case 'GRANT_TUTORIAL_REAGENTS': {
      if (!inventory) return;
      const cmd = command as any;
      if (cmd.items && Array.isArray(cmd.items)) {
        for (const it of cmd.items) {
          const slot = { itemId: it.itemId, count: it.count ?? 1, massKg: it.massKg ?? 0.5, quality: 1.0, label: it.itemId };
          if (!addItemToContainer(inventory.campCache, slot)) {
            addItemToContainer(inventory.bareHands, slot);
          }
        }
      }
      if (world && cmd.vesselSpecies && Array.isArray(cmd.vesselSpecies)) {
        const v0 = world.vessels[0];
        if (v0) {
          for (const sp of cmd.vesselSpecies) {
            let specIdx: number | undefined = (SPECIES as Record<string, number>)[sp.speciesId];
            if (specIdx === undefined) {
              for (const [idx, spec] of SPECIES_BY_INDEX.entries()) {
                if (spec.code === sp.speciesId || (spec as any).id === sp.speciesId) {
                  specIdx = idx;
                  break;
                }
              }
            }
            if (specIdx !== undefined) {
              v0.moles[specIdx] = (v0.moles[specIdx] ?? 0) + sp.moles;
            }
          }
          if (cmd.vesselTempK) {
            v0.temperatureK = cmd.vesselTempK;
          }
        }
      }
      if (world && view) {
        syncWorldToShared(world, view);
      }
      postPlayerAndInventory();
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: 'Granted tutorial lesson reagents to camp cache.' }] });
      break;
    }
    case 'CRISIS_CHOICE': {
      if (!world || !player || !inventory) break;
      const result = crisis.resolve(command.crisisId, command.choiceId, {
        world,
        player,
        inventory,
        colony,
        rng,
      });
      for (const message of result.messages) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message }] });
      }
      if (view) syncWorldToShared(world, view);
      postPlayerAndInventory();
      postColonySync();
      postCrisisSync();
      break;
    }
    case 'FULFILL_REQUEST': {
      if (!world || !inventory) break;
      const flatInv: Record<string, number> = {};
      const tally = (cont: any) => {
        if (!cont) return;
        for (const slot of cont.slots) {
          if (slot) flatInv[slot.itemId] = (flatInv[slot.itemId] ?? 0) + slot.count;
        }
      };
      tally(inventory.bareHands);
      tally(inventory.backpack);
      tally(inventory.campCache);

      const res = timedRequests.fulfill(command.slot, flatInv, world.tick);
      if (res && res.success) {
        ctx.postMessage({
          type: 'EVENTS',
          events: [{ vesselId: -1, message: `Delivered town request! (+${res.rewardRenown} Renown, ${res.speedMultiplier}x Speed)` }],
        });
        postPlayerAndInventory();
        postRequestSync();
      } else {
        ctx.postMessage({
          type: 'EVENTS',
          events: [{ vesselId: -1, message: 'Cannot fulfill request — missing required items.' }],
        });
      }
      break;
    }
    case 'DISTRIBUTE_STIMULANTS': {
      const res = applyDistributeStimulants(realm, command.commodity, command.crates);
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: res.message }] });
      postCampaignSync();
      break;
    }
    case 'DISTRIBUTE_CLOTHES': {
      const res = applyDistributeClothes(realm, command.tunics);
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: res.message }] });
      postCampaignSync();
      break;
    }
    case 'DISTRIBUTE_WEAPONS': {
      const res = applyDistributeWeapons(realm, command.weaponsCount);
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: res.message }] });
      postCampaignSync();
      break;
    }
    case 'FOUND_SETTLEMENT': {
      const day = 1 + Math.floor((world?.tick ?? 0) / 240);
      const res = foundSettlement(settlements, { name: command.name, q: command.q, r: command.r, currentDay: day });
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: res.message }] });
      postCampaignSync();
      break;
    }
    case 'SET_TOWN_FOCUS': {
      const s = settlements.settlements.find((item) => item.id === command.settlementId);
      if (s) {
        s.focus = command.focus;
        recomputeSettlementYields(settlements);
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `${s.name} focus shifted to ${command.focus}.` }] });
        postCampaignSync();
      }
      break;
    }
    case 'START_BLACKSMITH_BATCH': {
      const job = startBatchJob(blacksmith, {
        recipeId: command.recipeId,
        name: command.name,
        batchCount: command.batchCount,
        turns: command.turns,
        outputs: command.outputs,
      });
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Forging batch: ${job.name} (x${job.batchCount}) queued.` }] });
      postCampaignSync();
      break;
    }
    case 'PLACE_DISTRICT': {
      const s = settlements.settlements.find((item) => item.id === command.settlementId);
      if (!s) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: 'Settlement not found for district placement.' }] });
        break;
      }
      const res = placeDistrict(s.districts, command.kind, { q: command.q, r: command.r });
      if (!res.ok) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Cannot place district: ${res.error}` }] });
      } else {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Founded ${command.kind} district at (${command.q}, ${command.r}).` }] });
        recomputeSettlementYields(settlements);
        postCampaignSync();
      }
      break;
    }
    case 'POWER_ACTION': {
      const res = executePowerAction(influence, command.powerId, command.action);
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: res.message }] });
      postCampaignSync();
      break;
    }
    case 'CONSTRUCT_BUILT_WORK': {
      const res = constructBuiltWork(builtWorks, command.workId);
      builtWorks = res.state;
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: res.message }] });
      postCampaignSync();
      break;
    }
    case 'EXECUTE_MISSION': {
      const res = executeMission(missions, command.operativeId, command.verb, rng.next());
      realm.estates.crown = Math.max(0, Math.min(100, realm.estates.crown + res.estateDeltas.crown));
      realm.estates.army = Math.max(0, Math.min(100, realm.estates.army + res.estateDeltas.army));
      realm.estates.public = Math.max(0, Math.min(100, realm.estates.public + res.estateDeltas.public));
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: res.message }] });
      postCampaignSync();
      break;
    }
    case 'MARK_LETTER_READ': {
      markLetterRead(correspondence, command.letterId);
      postCampaignSync();
      break;
    }
    case 'SET_UNDERTOW_STANCE': {
      victories.undertowStance = command.stance;
      ctx.postMessage({
        type: 'EVENTS',
        events: [{ vesselId: -1, message: `The Undertow stance is now ${command.stance}.` }],
      });
      postCampaignSync();
      break;
    }
    case 'ACCEPT_LEDGER_SLOT': {      const ok = acceptSlot(ledger, command.slotId);
      if (ok) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: 'Dispatch accepted. Complete it before day\'s end.' }] });
      } else {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: 'Cannot accept — slot not available.' }] });
      }
      postCampaignSync();
      break;
    }
    case 'FULFILL_LEDGER_SLOT': {
      const ok = fulfillSlot(ledger, command.slotId);
      if (ok) {
        const slot = ledger.slots.find(s => s.id === command.slotId);
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Dispatch fulfilled! +${slot?.rewardRenown ?? 0} Renown.` }] });
      } else {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: 'Cannot fulfill — slot not accepted or already done.' }] });
      }
      postCampaignSync();
      break;
    }
    case 'REQUEST_LEDGER_SYNC': {
      postCampaignSync();
      break;
    }
    default:
      assertNeverCommand(command);
  }
}