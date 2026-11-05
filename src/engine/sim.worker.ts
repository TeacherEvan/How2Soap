import { addHardwoodAsh, addWaterLiters, type VesselMaterialKey } from './chemistry';
import { findVessel } from './world';
import { SharedWorldView, SAB_BYTE_LENGTH } from './memoryLayout';
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
  removeItemFromContainer,
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
import { restoreColonyFromSave, restoreWorldFromSave } from './worldRestore';
import {
  createCrisisDirector,
  type CrisisContext,
  type CrisisId,
} from './crisis';
import { createTimedRequestManager, type TimedRequestManager } from './timedRequests';

export interface FullSimState {
  world: WorldState;
  player: PlayerMetabolismState;
  inventory: InventoryState;
  paddock: Paddock;
}

type Command =
  | { type: 'INIT'; sab: SharedArrayBuffer }
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
  | { type: 'PLACE_DISTRICT'; settlementId: string; kind: import('./campaign/districts').DistrictKind; q: number; r: number };

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
const labels = new Map<number, string>();

let rngSeed = 0;
let rng = createSeededRng(rngSeed);
const crisis = createCrisisDirector();
let lastCrisisSync = '';
const timedRequests: TimedRequestManager = createTimedRequestManager();

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

function postColonySync(): void {
  if (!colony) return;
  ctx.postMessage({
    type: 'COLONY_SYNC',
    colony: {
      colonists: colony.colonists,
      ledger: colony.ledger,
      desirePathGrid: Array.from(colony.desirePathGrid),
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
}

/** Posts CRISIS_SYNC only when the crisis snapshot changed (dirty compare). */
function postCrisisSync(): void {
  const snap = crisis.snapshot();
  const payload = JSON.stringify({ telegraph: snap.telegraph, active: snap.active });
  if (payload === lastCrisisSync) return;
  lastCrisisSync = payload;
  ctx.postMessage({ type: 'CRISIS_SYNC', telegraph: snap.telegraph, active: snap.active });
}

function postRequestSync(): void {
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
    if (yields.butterfatGrams > 0) {
      const butterfatSlot = {
        itemId: 'RAW_ADIPOSE_FAT',
        count: 1,
        massKg: yields.butterfatGrams / 1000,
        quality: 1.0,
        label: 'Rendered Butterfat',
      };
      if (!addItemToContainer(inventory?.bareHands ?? null as any, butterfatSlot)) {
        if (!addItemToContainer(inventory?.backpack ?? null as any, butterfatSlot)) {
          if (inventory?.campCache) addItemToContainer(inventory.campCache, butterfatSlot);
        }
      }
    }
    if (yields.eggs > 0) {
      const eggSlot = { itemId: 'FIELD_MUSHROOM', count: yields.eggs, massKg: yields.eggs * 0.05, label: 'Fresh Egg' };
      if (!addItemToContainer(inventory?.bareHands ?? null as any, eggSlot)) {
        if (!addItemToContainer(inventory?.backpack ?? null as any, eggSlot)) {
          if (inventory?.campCache) addItemToContainer(inventory.campCache, eggSlot);
        }
      }
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
    postCrisisSync();

    timedRequests.step(world.tick, (expiredReq) => {
      events.push({ vesselId: -1, message: `⌛ Request expired: ${expiredReq.title}` });
    });
    postRequestSync();
  }
  return events;
}

function advance(hours: number): WorldEvent[] {
  if (!world || !player) return [];
  if (player.dead) return [];
  const steps = Math.max(1, Math.round(hours * WORKER_HZ));
  const events: WorldEvent[] = [];
  const startDay = 1 + Math.floor(world.tick / 240);
  for (let step = 0; step < steps; step += 1) {
    events.push(...stepSingleTick(SIM_STEP_SECONDS));
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
  const events = stepSingleTick(SIM_STEP_SECONDS);
  syncWorldToShared(world, view);
  if (events.length > 0) ctx.postMessage({ type: 'EVENTS', events });
  postPlayerAndInventory();
  postColonySync();
}

ctx.onmessage = (event: MessageEvent<Command>) => {
  const command = event.data;
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

      syncWorldToShared(world, view);
      if (timer === null) timer = setInterval(tick, 1000 / WORKER_HZ);
      ctx.postMessage({ type: 'READY', rngSeed });
      postPlayerAndInventory();
      postColonySync();
      postCrisisSync();
      break;
    }
    case 'LOAD_WORLD': {
      const save = command.save;
      view = new SharedWorldView(command.sab);
      world = restoreWorldFromSave(save, labels);
      player = createPlayerMetabolism(save.player?.clothingIclo ?? 0.05);
      Object.assign(player, save.player);
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
      paddock = save.paddock ?? createPaddock();
      colony = restoreColonyFromSave(save);
      if (Array.isArray(save.timedRequests)) {
        timedRequests.restore(save.timedRequests);
      }
      if (save.experiments) {
        experiments = save.experiments;
      }
      if (save.realm) {
        realm = save.realm;
      }
      if (save.settlements) {
        settlements = save.settlements;
      }
      if (save.blacksmith) {
        blacksmith = save.blacksmith;
      }

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
      if (vessel) vessel.condenserTargetVesselId = command.targetId;
      break;
    }
    case 'SET_VOLTS': {
      const vessel = world && findVessel(world, command.vesselId);
      if (vessel) {
        vessel.appliedVolts = Math.max(0, command.volts);
        if (command.resistanceOhm !== undefined) {
          vessel.cellResistanceOhm = Math.max(0.01, command.resistanceOhm);
        }
      }
      break;
    }
    case 'SET_CLOSED': {
      const vessel = world && findVessel(world, command.vesselId);
      if (vessel) {
        vessel.headspaceClosed = command.closed;
      }
      break;
    }
    case 'CHARGE_ITEM': {
      const vessel = world && findVessel(world, command.vesselId);
      if (!vessel || !inventory) break;
      const count = command.count || 1;
      const removed =
        removeItemFromContainer(inventory.backpack, command.itemId, count) ||
        removeItemFromContainer(inventory.bareHands, command.itemId, count);
      if (!removed) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: command.vesselId, message: `No ${command.itemId} in inventory to charge!` }] });
        break;
      }

      // Convert solid reagent items into corresponding vessel moles
      if (command.itemId === 'CHARCOAL') {
        vessel.moles[SPECIES.CARBON] += count * (50 / 12.011); // ~50g C per piece
      } else if (command.itemId === 'LIMESTONE_ROCK') {
        vessel.moles[SPECIES.CACO3] += count * (200 / 100.086); // ~200g
      } else if (command.itemId === 'HALITE_SALT') {
        vessel.moles[SPECIES.NACL] += count * (50 / 58.44); // ~50g
      } else if (command.itemId === 'RAW_ADIPOSE_FAT') {
        vessel.moles[SPECIES.TRISTEARIN] += count * (150 / 891.5); // ~150g
      } else if (command.itemId === 'MALACHITE_ORE') {
        vessel.moles[SPECIES.MALACHITE] += count * (100 / 221.12);
      } else if (command.itemId === 'CASSITERITE_ORE') {
        vessel.moles[SPECIES.CASSITERITE] += count * (100 / 150.71);
      } else if (command.itemId === 'SPHALERITE_ORE') {
        vessel.moles[SPECIES.SPHALERITE] += count * (100 / 97.47);
      } else if (command.itemId === 'PYRITE_ORE') {
        vessel.moles[SPECIES.PYRITE] += count * (100 / 119.98);
      } else if (command.itemId === 'SALTPETER_CRYSTALS') {
        vessel.moles[SPECIES.KNO3] += count * (50 / 101.1);
      } else if (command.itemId === 'WILLOW_BARK') {
        vessel.moles[SPECIES.SALICIN] += count * (25 / 286.28);
      } else {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: command.vesselId, message: `Charged ${count}x ${command.itemId}` }] });
      }

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
          addItemToContainer(inventory.backpack, {
            itemId: 'BAR_SOAP',
            label: 'Bar Soap',
            count: barsToAdd,
            massKg: barsToAdd * 0.1,
          });
          ctx.postMessage({
            type: 'EVENTS',
            events: [{ vesselId: command.fromId, message: `Skimmed and formed ${barsToAdd} Bar Soap!` }],
          });
          ctx.postMessage({ type: 'OBJECTIVE', kind: 'item_acquired', target: 'BAR_SOAP' });
          postPlayerAndInventory();
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
      let found = false;
      for (const container of [inventory.bareHands, inventory.backpack, inventory.campCache]) {
        for (let i = 0; i < container.slots.length; i++) {
          const s = container.slots[i];
          if (s && s.itemId === toolId) {
            s.count--;
            if (s.count <= 0) container.slots[i] = null;
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Tool not in inventory: ${toolId}` }] });
        return;
      }
      const prev = inventory.tools[slot];
      if (prev) {
        const prevSlot = { itemId: prev.id, count: 1, massKg: 0.5, label: prev.name };
        if (!addItemToContainer(inventory.bareHands, prevSlot)) {
          if (!addItemToContainer(inventory.backpack, prevSlot)) {
            addItemToContainer(inventory.campCache, prevSlot);
          }
        }
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
        // Deduct stimulant item from inventory
        let removed = false;
        for (const container of [inventory.bareHands, inventory.backpack, inventory.campCache]) {
          for (let i = 0; i < container.slots.length; i++) {
            const s = container.slots[i];
            if (s && s.itemId === command.stimulantId) {
              s.count--;
              if (s.count <= 0) container.slots[i] = null;
              removed = true;
              break;
            }
          }
          if (removed) break;
        }

        if (!removed) {
          ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `No ${command.stimulantId} in inventory to administer` }] });
          return;
        }

        const ok = administerStimulant(c, command.stimulantId);
        if (ok) {
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
            let specIdx: number | undefined;
            for (const [idx, spec] of SPECIES_BY_INDEX.entries()) {
              if (spec.code === sp.speciesId || (spec as any).id === sp.speciesId) {
                specIdx = idx;
                break;
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
    default:
      assertNeverCommand(command);
  }
};