import { createWorld, type WorldState } from './world';
import type { SerializedWorldSave } from './persistence';
import type { VesselMaterialKey } from './chemistry';

/** Rebuild WorldState from a save's vessels array. Fail-loud on bad payloads. */
export function restoreWorldFromSave(save: SerializedWorldSave): WorldState {
  const world = createWorld(save.ambientTempK);
  world.tick = save.tick;
  world.simSeconds = save.tick * 360; // consistent with SIM_STEP_SECONDS
  for (const raw of save.vessels as any[]) {
    world.vessels.push({
      id: raw.id,
      material: raw.material as VesselMaterialKey,
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
  return world;
}