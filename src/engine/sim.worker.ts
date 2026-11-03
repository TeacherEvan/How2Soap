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
  type InventoryState,
} from './inventory';
import {
  createPaddock,
  type Paddock,
} from './husbandry';
import { applyHarvest } from './harvest';
import { createSeededRng } from './rng';
import { BIOME_DAG } from '../data/biomeNodes';
import { ITEM_BY_ID } from '../data/items';
import { FABRICATION_RECIPES, RECIPE_EFFECTS, METALLURGY_TOOLS } from './fabrication';
import { satisfyVesselInputs, applyVesselConsumption, type VesselInputResult, VESSEL_INPUTS } from './vesselInputs';

/** One simulation step = 6 simulated minutes; 10 steps = 1 game hour. */
const SIM_STEP_SECONDS = 360;
const WORKER_HZ = 10;

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
  | { type: 'DECANT'; fromId: number; toId: number; litres: number }
  | { type: 'SKIM'; fromId: number; toId: number; speciesIdx: number }
  | { type: 'ADVANCE'; hours: number }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'HARVEST_PART'; partId: string; speciesId: string; carriedMassKg: number; toolSlot: string; distanceMeters: number }
  | { type: 'FABRICATE'; recipeId: string }
  | { type: 'EQUIP_TOOL'; slot: string; toolId: string }
  | { type: 'EAT_FOOD'; itemId: string }
  | { type: 'APPLY_TREATMENT'; itemId: string };

interface WorkerCtx {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent<Command>) => void) | null;
}

const ctx = self as unknown as WorkerCtx;

let world: WorldState | null = null;
let player: PlayerMetabolismState | null = null;
let inventory: InventoryState | null = null;
let paddock: Paddock | null = null;
let view: SharedWorldView | null = null;
let paused = false;
let timer: ReturnType<typeof setInterval> | null = null;
const labels = new Map<number, string>();

let rngSeed = 0;
let rng = createSeededRng(rngSeed);

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
      conditions: player.conditions,
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
  });
}

function advance(hours: number): WorldEvent[] {
  if (!world || !player) return [];
  if (player.dead) return [];
  const steps = Math.max(1, Math.round(hours * WORKER_HZ));
  const events: WorldEvent[] = [];
  for (let step = 0; step < steps; step += 1) {
    events.push(...stepWorld(world, SIM_STEP_SECONDS));
    stepPlayerMetabolism(player, {
      dtSeconds: SIM_STEP_SECONDS,
      ambientTempK: world.ambientTempK,
    });
  }
  return events;
}

function tick(): void {
  if (!world || !view || !player || paused) return;
  if (player.dead) return;
  const events = stepWorld(world, SIM_STEP_SECONDS);
  stepPlayerMetabolism(player, {
    dtSeconds: SIM_STEP_SECONDS,
    ambientTempK: world.ambientTempK,
  });
  syncWorldToShared(world, view);
  if (events.length > 0) ctx.postMessage({ type: 'EVENTS', events });
  postPlayerAndInventory();
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

      syncWorldToShared(world, view);
      if (timer === null) timer = setInterval(tick, 1000 / WORKER_HZ);
      ctx.postMessage({ type: 'READY' });
      postPlayerAndInventory();
      break;
    }
    case 'LOAD_WORLD': {
      const save = command.save;
      view = new SharedWorldView(command.sab);
      world = createWorld(save.ambientTempK ?? 288.15);
      world.tick = save.tick ?? 0;
      world.simSeconds = (save.tick ?? 0) * SIM_STEP_SECONDS;
      for (const raw of (save.vessels as any[]) ?? []) {
        world.vessels.push({
          id: raw.id,
          material: raw.material,
          capacityL: raw.capacityL,
          headspaceClosed: !!raw.headspaceClosed,
          temperatureK: raw.temperatureK,
          moles: new Float64Array(raw.moles ?? []),
          precipitated: new Float64Array(raw.precipitated ?? []),
          heaterWatts: raw.heaterWatts ?? 0,
          condenserTargetVesselId: raw.condenserTargetVesselId ?? -1,
          pressureKPa: raw.pressureKPa ?? 101.325,
          ruptured: !!raw.ruptured,
          appliedVolts: raw.appliedVolts ?? 0,
          cellResistanceOhm: raw.cellResistanceOhm ?? 0,
        });
      }
      player = createPlayerMetabolism(save.player?.clothingIclo ?? 0.05);
      Object.assign(player, save.player);
      inventory = save.inventory ?? createInventoryState();
      rngSeed = save.rngSeed ?? ((Math.random() * 0xffffffff) >>> 0);
      rng = createSeededRng(rngSeed);
      paddock = save.paddock ?? createPaddock();

      syncWorldToShared(world, view);
      if (timer === null) timer = setInterval(tick, 1000 / WORKER_HZ);
      ctx.postMessage({ type: 'READY' });
      postPlayerAndInventory();
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
    case 'DECANT': {
      if (world) decantWorld(world, command.fromId, command.toId, command.litres);
      break;
    }
    case 'SKIM': {
      if (world) skimWorld(world, command.fromId, command.toId, command.speciesIdx);
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
      const toolId = command.toolId;
      const tool = METALLURGY_TOOLS[toolId as keyof typeof METALLURGY_TOOLS];
      if (!tool) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Unknown tool: ${toolId}` }] });
        return;
      }
      let found = false;
      for (const container of [inventory.bareHands, inventory.backpack, inventory.campCache]) {
        for (let i = 0; i < container.slots.length; i++) {
          const s = container.slots[i];
          if (s && s.itemId === toolId) {
            container.slots[i] = null;
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
        if (!addItemToContainer(inventory.bareHands, prevSlot)) addItemToContainer(inventory.backpack, prevSlot);
      }
      inventory.tools[slot] = tool;
      postPlayerAndInventory();
      break;;
    }
    case 'EAT_FOOD': {
      if (!player || !inventory) return;
      const item = ITEM_BY_ID[command.itemId];
      if (!item || !item.foodKcal) {
        ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message: `Not edible: ${command.itemId}` }] });
        return;
      }
      let removed = false;
      for (const container of [inventory.bareHands, inventory.backpack]) {
        for (let i = 0; i < container.slots.length; i++) {
          const s = container.slots[i];
          if (s && s.itemId === command.itemId) {
            s.count--;
            if (s.count === 0) container.slots[i] = null;
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
      for (const container of [inventory.bareHands, inventory.backpack]) {
        for (let i = 0; i < container.slots.length; i++) {
          const s = container.slots[i];
          if (s && s.itemId === command.itemId) {
            s.count--;
            if (s.count === 0) container.slots[i] = null;
            break;
          }
        }
      }
      ctx.postMessage({ type: 'EVENTS', events: [{ vesselId: -1, message }] });
      if (treatKind) ctx.postMessage({ type: 'OBJECTIVE', kind: 'treat', target: treatKind });
      postPlayerAndInventory();
      break;
    }
    default:
      break;
  }
};