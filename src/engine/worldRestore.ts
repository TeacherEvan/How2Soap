import { createWorld, type WorldState } from './world';
import type { SerializedWorldSave } from './persistence';
import { MATERIALS, type VesselMaterialKey } from './chemistry';
import {
  createInitialColonyState,
  type ColonyState,
  type Colonist,
  type ColonistArchetype,
  type ColonistStatus,
  type ActiveStimulantState,
  GRID_SIZE,
} from './colony';
import { createInitialInfluenceState, type InfluenceState } from './campaign/influence';
import { createInitialCorrespondence, type CorrespondenceState } from './campaign/correspondence';
import { createInitialBuiltWorks, type BuiltWorksState } from './campaign/builtWorks';
import { createInitialMissions, type MissionsState } from './campaign/missions';
import { createInitialVictoryState, type CampaignVictoryState } from './campaign/victories';

const VALID_ARCHETYPES: ReadonlySet<string> = new Set([
  'FORAGER',
  'MINER',
  'HERBALIST',
  'APPRENTICE_CHEMIST',
]);
const VALID_STATUSES: ReadonlySet<string> = new Set([
  'IDLE',
  'TRAVELING',
  'GATHERING',
  'RETURNING',
  'STRIKE',
  'RESTING',
]);

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * Repairs a persisted colonist record or drops it. Save data is a trust
 * boundary: a single missing wageContract used to make processPayroll throw on
 * every 10 Hz tick, freezing the visible simulation forever.
 */
function sanitizeColonist(raw: unknown): Colonist | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Colonist> & { wageContract?: Partial<Colonist['wageContract']> };
  if (typeof r.id !== 'string' || r.id.length === 0) return null;
  if (typeof r.name !== 'string') return null;

  const archetype: ColonistArchetype = VALID_ARCHETYPES.has(r.archetype ?? '')
    ? (r.archetype as ColonistArchetype)
    : 'FORAGER';
  const status: ColonistStatus = VALID_STATUSES.has(r.status ?? '')
    ? (r.status as ColonistStatus)
    : 'IDLE';

  const wage: Partial<Colonist['wageContract']> =
    r.wageContract && typeof r.wageContract === 'object' ? r.wageContract : {};
  const commodity = typeof wage.commodity === 'string' && wage.commodity.length > 0
    ? wage.commodity
    : 'BAR_SOAP';

  const position = r.position && typeof r.position === 'object' ? r.position : { x: 0, y: 0 };
  const job = r.assignedJob && typeof r.assignedJob === 'object' ? r.assignedJob : null;
  const assignedJob = job && typeof job.speciesId === 'string' && typeof job.partId === 'string'
    ? {
        speciesId: job.speciesId,
        partId: job.partId,
        workRequired: Math.max(1, finiteOr(job.workRequired, 1)),
        workDone: Math.max(0, finiteOr(job.workDone, 0)),
      }
    : null;

  const stim = r.activeStimulant;
  const activeStimulant: ActiveStimulantState | null = stim && typeof stim === 'object'
    && (stim.phase === 'BOOST' || stim.phase === 'CRASH')
    ? {
        stimulantId: typeof stim.stimulantId === 'string' ? stim.stimulantId : 'WILLOW_TEA',
        phase: stim.phase,
        speedMultiplier: Math.max(0.1, finiteOr(stim.speedMultiplier, 1)),
        durationMinutes: Math.max(0, finiteOr(stim.durationMinutes, 0)),
        crashMinutes: Math.max(0, finiteOr(stim.crashMinutes, 0)),
        crashMultiplier: Math.max(0.1, finiteOr(stim.crashMultiplier, 1)),
        elapsedMinutes: Math.max(0, finiteOr(stim.elapsedMinutes, 0)),
      }
    : null;

  const carriedYields = Array.isArray(r.carriedYields)
    ? (r.carriedYields as unknown[])
        .filter((y): y is Record<string, unknown> =>
          !!y && typeof y === 'object' && typeof (y as Record<string, unknown>).itemId === 'string')
        .map((y) => ({
          itemId: String(y.itemId),
          name: typeof y.name === 'string' ? y.name : String(y.itemId),
          massKg: Math.max(0, finiteOr(y.massKg, 0)),
        }))
    : [];

  return {
    id: r.id,
    name: r.name,
    archetype,
    status,
    position: { x: finiteOr(position.x, 0), y: finiteOr(position.y, 0) },
    velocity: { vx: 0, vy: 0 },
    baseSpeed: finiteOr(r.baseSpeed, 80) > 0 ? finiteOr(r.baseSpeed, 80) : 80,
    morale: Math.max(0, Math.min(100, finiteOr(r.morale, 50))),
    satiety: Math.max(0, Math.min(100, finiteOr(r.satiety, 100))),
    wageContract: { commodity, dailyAmount: Math.max(0, finiteOr(wage.dailyAmount, 1)) },
    activeStimulant,
    assignedJob,
    carriedYields,
    recruitedTick: Math.max(0, finiteOr(r.recruitedTick, 0)),
  };
}


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
    colonists: Array.isArray(save.colony.colonists)
      ? save.colony.colonists
          .map((raw) => sanitizeColonist(raw))
          .filter((c): c is Colonist => c !== null)
      : [],
    ledger: Array.isArray(save.colony.ledger) ? [...save.colony.ledger] : [],
    desirePathGrid,
    nextColonistId: typeof save.colony.nextColonistId === 'number' ? save.colony.nextColonistId : initial.nextColonistId,
    lastDecayTick: save.colony.lastDecayTick,
  };
}

export interface CampaignSlice {
  influence: InfluenceState;
  correspondence: CorrespondenceState;
  builtWorks: BuiltWorksState;
  missions: MissionsState;
  victories: CampaignVictoryState;
}

/**
 * Restores the campaign slice with shape checks. A save with a malformed
 * influence/missions/etc. payload falls back to the initial state instead of
 * crashing the window render or the daily victory step.
 */
export function restoreCampaignFromSave(save: SerializedWorldSave): CampaignSlice {
  const c = save.campaign;
  const influence =
    c?.influence &&
    Array.isArray(c.influence.powers) &&
    typeof c.influence.currentInfluencePool === 'number'
      ? c.influence
      : createInitialInfluenceState(1);
  const correspondence =
    c?.correspondence && Array.isArray(c.correspondence.letters)
      ? c.correspondence
      : createInitialCorrespondence();
  const builtWorks =
    c?.builtWorks &&
    c.builtWorks.works &&
    typeof c.builtWorks.engineeringCanonCount === 'number'
      ? c.builtWorks
      : createInitialBuiltWorks();
  const missions =
    c?.missions && Array.isArray(c.missions.operatives)
      ? c.missions
      : createInitialMissions();
  const victories =
    c?.victories &&
    c.victories.scores &&
    typeof c.victories.scores.dominion === 'number'
      ? c.victories
      : createInitialVictoryState();
  return { influence, correspondence, builtWorks, missions, victories };
}
