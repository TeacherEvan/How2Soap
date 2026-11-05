import { createWorld, type WorldState } from './world';
import type { SerializedWorldSave } from './persistence';
import type { VesselMaterialKey } from './chemistry';
import { createInitialColonyState, type ColonyState, GRID_SIZE } from './colony';

/** Rebuild WorldState from a save's vessels array. Fail-loud on bad payloads. */
export function restoreWorldFromSave(save: SerializedWorldSave, labels?: Map<number, string>): WorldState {
  const world = createWorld(save.ambientTempK ?? 288.15);
  world.tick = save.tick ?? 0;
  world.simSeconds = (save.tick ?? 0) * 360; // consistent with SIM_STEP_SECONDS
  for (const raw of (save.vessels as any[]) ?? []) {
    world.vessels.push({
      id: raw.id,
      material: raw.material as VesselMaterialKey,
      capacityL: raw.capacityL,
      headspaceClosed: !!raw.headspaceClosed,
      temperatureK: raw.temperatureK ?? (save.ambientTempK ?? 288.15),
      moles: new Float64Array(raw.moles ?? []),
      precipitated: new Float64Array(raw.precipitated ?? []),
      heaterWatts: raw.heaterWatts ?? 0,
      condenserTargetVesselId: raw.condenserTargetVesselId ?? -1,
      pressureKPa: raw.pressureKPa ?? 101.325,
      ruptured: !!raw.ruptured,
      appliedVolts: raw.appliedVolts ?? 0,
      cellResistanceOhm: raw.cellResistanceOhm ?? 0,
    });
    if (labels && raw.label) {
      labels.set(raw.id, raw.label);
    }
  }
  return world;
}

/** Rebuild ColonyState from save data or fall back to initial state if missing or invalid. */
export function restoreColonyFromSave(save: SerializedWorldSave): ColonyState {
  const initial = createInitialColonyState();
  if (!save.colony) {
    return initial;
  }

  const desirePathGrid = new Uint8Array(GRID_SIZE * GRID_SIZE);
  if (Array.isArray(save.colony.desirePathGrid)) {
    const len = Math.min(desirePathGrid.length, save.colony.desirePathGrid.length);
    for (let i = 0; i < len; i++) {
      desirePathGrid[i] = save.colony.desirePathGrid[i] ?? 0;
    }
  }

  return {
    colonists: Array.isArray(save.colony.colonists) ? [...save.colony.colonists] : [],
    ledger: Array.isArray(save.colony.ledger) ? [...save.colony.ledger] : [],
    desirePathGrid,
    nextColonistId: typeof save.colony.nextColonistId === 'number' ? save.colony.nextColonistId : initial.nextColonistId,
    lastDecayTick: save.colony.lastDecayTick,
  };
}
