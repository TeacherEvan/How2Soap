import {
  computePH,
  createVessel,
  decant as decantVessel,
  liquidVolumeL,
  MATERIALS,
  skim as skimVessel,
  stepVessel,
  type VesselMaterialKey,
  type VesselState,
} from './chemistry';
import {
  FLAG_BOILING,
  FLAG_CLOSED,
  FLAG_RUPTURED,
  MAX_SPECIES,
  TELEMETRY,
  type SharedWorldView,
} from './memoryLayout';
import { MAX_DEFINED_SPECIES } from '../data/speciesRegistry';

export interface WorldState {
  vessels: VesselState[];
  ambientTempK: number;
  simSeconds: number;
  tick: number;
}

export interface WorldEvent {
  vesselId: number;
  message: string;
}

export function createWorld(ambientTempK = 288.15): WorldState {
  return { vessels: [], ambientTempK, simSeconds: 0, tick: 0 };
}

export function findVessel(world: WorldState, id: number): VesselState | undefined {
  return world.vessels.find((vessel) => vessel.id === id);
}

export function createWorldVessel(
  world: WorldState,
  id: number,
  material: VesselMaterialKey,
  capacityL: number,
  closed = false,
): VesselState {
  const existing = findVessel(world, id);
  if (existing) return existing;
  const vessel = createVessel(id, material, capacityL, closed);
  world.vessels.push(vessel);
  return vessel;
}

export function stepWorld(world: WorldState, dtSeconds: number): WorldEvent[] {
  const events: WorldEvent[] = [];
  for (const vessel of world.vessels) {
    const condenser =
      vessel.condenserTargetVesselId >= 0
        ? findVessel(world, vessel.condenserTargetVesselId) ?? null
        : null;
    const result = stepVessel(vessel, {
      dtSeconds,
      ambientTempK: world.ambientTempK,
      condenser,
    });
    for (const message of result.events) {
      events.push({ vesselId: vessel.id, message });
    }
  }
  world.simSeconds += dtSeconds;
  world.tick += 1;
  return events;
}

/** Copy the authoritative world into the shared buffer under the SeqLock. */
export function syncWorldToShared(world: WorldState, view: SharedWorldView): void {
  view.beginWorkerWrite();
  for (let index = 0; index < world.vessels.length; index += 1) {
    const vessel = world.vessels[index];
    const material = MATERIALS[vessel.material];
    view.setTelemetry(index, TELEMETRY.TEMP_K, vessel.temperatureK);
    view.setTelemetry(index, TELEMETRY.PH, computePH(vessel));
    view.setTelemetry(index, TELEMETRY.PRESSURE_KPA, vessel.pressureKPa);
    view.setTelemetry(index, TELEMETRY.VOLUME_L, liquidVolumeL(vessel));
    view.setTelemetry(index, TELEMETRY.MAX_TEMP_K, material.failureTempK);
    view.setTelemetry(index, TELEMETRY.MAX_PRESSURE_KPA, material.burstPressureKPa);
    view.setTelemetry(index, TELEMETRY.HEATER_W, vessel.heaterWatts);
    let flags = 0;
    if (vessel.headspaceClosed) flags |= FLAG_CLOSED;
    if (vessel.ruptured) flags |= FLAG_RUPTURED;
    if (vessel.temperatureK >= 373.14) flags |= FLAG_BOILING;
    view.setTelemetry(index, TELEMETRY.FLAGS, flags);

    const base = index * MAX_SPECIES;
    for (let species = 0; species < MAX_DEFINED_SPECIES; species += 1) {
      view.vesselMoles[base + species] = vessel.moles[species];
    }
  }
  view.endWorkerWrite(world.tick);
}

export function decantWorld(
  world: WorldState,
  fromId: number,
  toId: number,
  litres: number,
): boolean {
  const source = findVessel(world, fromId);
  const target = findVessel(world, toId);
  if (!source || !target) return false;
  decantVessel(source, target, litres);
  return true;
}

export function skimWorld(
  world: WorldState,
  fromId: number,
  toId: number,
  speciesIdx: number,
): number {
  const source = findVessel(world, fromId);
  const target = findVessel(world, toId);
  if (!source || !target) return 0;
  return skimVessel(source, target, speciesIdx);
}
