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
} from './metabolism';
import {
  createInventoryState,
  unlockBackpack,
  type InventoryState,
} from './inventory';
import {
  createPaddock,
  type Paddock,
} from './husbandry';

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
  | { type: 'HARVEST_PART'; partId: string; carriedMassKg: number; toolSlot: string; distanceMeters: number }
  | { type: 'FABRICATE'; recipeId: string }
  | { type: 'EQUIP_TOOL'; slot: string; toolItem: any };

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
  if (!player || !inventory) return;
  if (paddock && paddock.animals.length > 0) {
    // paddock tracking
  }
  ctx.postMessage({
    type: 'PLAYER_SYNC',
    player: {
      glucoseKcal: Math.round(player.glucoseKcal),
      adiposeKcal: Math.round(player.adiposeKcal),
      hydrationPct: Math.round(player.hydrationPct),
      coreTempC: ((player.coreTempK - 273.15)).toFixed(1),
      clothingIclo: player.clothingIclo,
    },
    inventory: {
      backpackUnlocked: inventory.backpack.unlocked,
      bareHands: inventory.bareHands.slots,
      backpack: inventory.backpack.slots,
      tools: inventory.tools,
    },
  });
}

function advance(hours: number): WorldEvent[] {
  if (!world || !player) return [];
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
    case 'FABRICATE': {
      if (!inventory) return;
      if (command.recipeId === 'RECIPE_STITCH_BACKPACK') {
        unlockBackpack(inventory);
        if (player) player.clothingIclo = 1.15; // Equipping backpack tunic raises insulation
        ctx.postMessage({
          type: 'EVENTS',
          events: [{ vesselId: -1, message: '🎉 Crafted Vegetable-Tanned Leather Backpack! 24-slot inventory unlocked (I_clo = 1.15).' }],
        });
      }
      postPlayerAndInventory();
      break;
    }
    default:
      break;
  }
};
