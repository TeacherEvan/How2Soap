import { createWorld, type WorldState } from './world';
import type { SerializedWorldSave } from './persistence';
import { MATERIALS, type VesselMaterialKey } from './chemistry';
import { createInitialColonyState, type ColonyState, GRID_SIZE } from './colony';

/** Rebuild WorldState from a save's vessels array. Fail-loud on bad payloads. */
export function restoreWorldFromSave(save: SerializedWorldSave, labels?: Map<number, string>): WorldState {
  if (!save || typeof save !== 'object') {
    throw new Error('Malformed save: root object expected');
  }
  const world = createWorld(save.ambientTempK ?? 288.15);
  world.tick = save.tick ?? 0;
  world.simSeconds = (save.tick ?? 0) * 360; // consistent with SIM_STEP_SECONDS
  for (const raw of (save.vessels as any[]) ?? []) {
    if (!raw) continue;
    if (typeof raw.id !== 'number' || !Number.isFinite(raw.id)) {
      throw new Error(`Malformed save: invalid vessel id ${raw.id}`);
    }
    const materialKey = raw.material as VesselMaterialKey;
    if (!MATERIALS[materialKey]) {
      throw new Error(`Malformed save: unknown vessel material ${raw.material}`);
    }
    const isClosed = raw.headspaceClosed !== undefined ? !!raw.headspaceClosed : !!raw.closed;
    const tempK = typeof raw.temperatureK === 'number' && Number.isFinite(raw.temperatureK) && raw.temperatureK > 0
      ? raw.temperatureK
      : (save.ambientTempK ?? 288.15);
    const pressure = typeof raw.pressureKPa === 'number' && Number.isFinite(raw.pressureKPa) && raw.pressureKPa > 0
      ? raw.pressureKPa
      : 101.325;
    const heater = typeof raw.heaterWatts === 'number' && Number.isFinite(raw.heaterWatts) && raw.heaterWatts >= 0
      ? raw.heaterWatts
      : 0;
    const volts = typeof raw.appliedVolts === 'number' && Number.isFinite(raw.appliedVolts) && raw.appliedVolts >= 0
      ? raw.appliedVolts
      : 0;
    const resistance = typeof raw.cellResistanceOhm === 'number' && Number.isFinite(raw.cellResistanceOhm) && raw.cellResistanceOhm > 0
      ? raw.cellResistanceOhm
      : 2;

    world.vessels.push({
      id: raw.id,
      material: materialKey,
      capacityL: typeof raw.capacityL === 'number' && Number.isFinite(raw.capacityL) ? raw.capacityL : 5,
      headspaceClosed: isClosed,
      temperatureK: tempK,
      moles: new Float64Array(raw.moles ?? []),
      precipitated: new Float64Array(raw.precipitated ?? []),
      heaterWatts: heater,
      condenserTargetVesselId: typeof raw.condenserTargetVesselId === 'number' ? raw.condenserTargetVesselId : -1,
      pressureKPa: pressure,
      ruptured: !!raw.ruptured,
      appliedVolts: volts,
      cellResistanceOhm: resistance,
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
