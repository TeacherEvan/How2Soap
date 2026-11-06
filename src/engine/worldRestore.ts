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
import { createExperimentQueue, type ExperimentInstance, type ExperimentQueueState } from './campaign/experiments';
import { createRealmState, type RealmState } from './campaign/realm';
import {
  createInitialSettlementsState,
  type BuildingInstance,
  type Settlement,
  type SettlementsState,
  type TownFocus,
} from './campaign/settlements';
import type { DistrictKind, UrbanDistrict } from './campaign/districts';
import type { BlacksmithBatchJob } from './campaign/blacksmith';
import { createBlacksmithState, type BlacksmithState } from './campaign/blacksmith';
import { createPaddock, type DomesticAnimal, type Paddock } from './husbandry';
import type { PlayerMetabolismState } from './metabolism';

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

const clampNum = (value: unknown, lo: number, hi: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(hi, Math.max(lo, value)) : fallback;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const sanitizeItemCounts = (raw: unknown): Array<{ itemId: string; count: number }> => {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ itemId: string; count: number }> = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.itemId !== 'string' || entry.itemId.length === 0) continue;
    out.push({ itemId: entry.itemId, count: Math.max(0, clampNum(entry.count, 0, 1e6, 0)) });
  }
  return out;
};

/**
 * Repairs the persisted player record. `deserializeSave` applies `??` defaults,
 * which do not reject a wrong type, so a string/NaN field used to reach
 * `Object.assign(player, save.player)` and poison the whole metabolic model.
 */
export function sanitizePlayerSave(raw: unknown): Partial<PlayerMetabolismState> {
  const p = isRecord(raw) ? raw : {};
  const conditions = isRecord(p.conditions) ? p.conditions : {};
  return {
    glucoseKcal: clampNum(p.glucoseKcal, 0, 2000, 1200),
    adiposeKcal: clampNum(p.adiposeKcal, 0, 60000, 15000),
    hydrationPct: clampNum(p.hydrationPct, 0, 100, 100),
    coreTempK: clampNum(p.coreTempK, 250, 320, 310.15),
    clothingIclo: clampNum(p.clothingIclo, 0, 4, 0.05),
    conditions: {
      fever: !!conditions.fever,
      systemicInfection: !!conditions.systemicInfection,
      woundContamination: !!conditions.woundContamination,
    },
    dead: p.dead === true,
    woundOnsetSeconds: clampNum(p.woundOnsetSeconds, 0, 1e9, 0),
    sepsisOnsetSeconds: clampNum(p.sepsisOnsetSeconds, 0, 1e9, 0),
  };
}

function sanitizeExperiment(raw: unknown): ExperimentInstance | null {
  if (!isRecord(raw)) return null;
  if (
    typeof raw.id !== 'string' || raw.id.length === 0 ||
    typeof raw.recipeId !== 'string' || raw.recipeId.length === 0 ||
    typeof raw.recipeName !== 'string'
  ) {
    return null;
  }
  return {
    id: raw.id,
    recipeId: raw.recipeId,
    recipeName: raw.recipeName,
    turnsStarted: Math.max(0, Math.floor(clampNum(raw.turnsStarted, 0, 1e9, 0))),
    totalTurns: Math.max(1, Math.floor(clampNum(raw.totalTurns, 1, 1e6, 1))),
    turnsLeft: Math.max(0, Math.floor(clampNum(raw.turnsLeft, 0, 1e6, 1))),
    sour: !!raw.sour,
    sourChance: clampNum(raw.sourChance, 0, 1, 0),
    inputsCommitted: sanitizeItemCounts(raw.inputsCommitted),
    outputsExpected: sanitizeItemCounts(raw.outputsExpected),
  };
}

/** Repairs or replaces the experiment queue (a non-array used to abort End Turn). */
export function sanitizeExperiments(raw: unknown): ExperimentQueueState {
  if (!isRecord(raw) || !Array.isArray(raw.experiments)) return createExperimentQueue();
  return {
    experiments: raw.experiments
      .map(sanitizeExperiment)
      .filter((e): e is ExperimentInstance => e !== null),
    nextExperimentId: Math.max(1, Math.floor(clampNum(raw.nextExperimentId, 1, 1e9, 1))),
    benchBuildingsCount: Math.max(0, Math.floor(clampNum(raw.benchBuildingsCount, 0, 100, 0))),
  };
}

/** Repairs the realm slice; a missing `estates` used to throw in stepRealmTurn. */
export function sanitizeRealm(raw: unknown): RealmState {
  if (!isRecord(raw) || !isRecord(raw.estates)) return createRealmState();
  const initial = createRealmState(typeof raw.countryId === 'string' ? raw.countryId : undefined);
  const e = raw.estates;
  return {
    countryId: initial.countryId,
    turn: Math.max(1, Math.floor(clampNum(raw.turn, 1, 1e9, 1))),
    health: clampNum(raw.health, 0, 100, initial.health),
    safety: clampNum(raw.safety, 0, 100, initial.safety),
    vigor: clampNum(raw.vigor, 0, 100, initial.vigor),
    doseExposure: clampNum(raw.doseExposure, 0, 100, 0),
    doseImmunityTurns: Math.max(0, Math.floor(clampNum(raw.doseImmunityTurns, 0, 1e6, 0))),
    tunicsDeliveredTotal: Math.max(0, Math.floor(clampNum(raw.tunicsDeliveredTotal, 0, 1e9, 0))),
    guardsAssignedTotal: Math.max(0, Math.floor(clampNum(raw.guardsAssignedTotal, 0, 1e9, 0))),
    estates: {
      crown: clampNum(e.crown, 0, 100, 60),
      army: clampNum(e.army, 0, 100, 60),
      public: clampNum(e.public, 0, 100, 60),
      crownWarned25: !!e.crownWarned25,
      crownWarned10: !!e.crownWarned10,
      armyWarned25: !!e.armyWarned25,
      armyWarned10: !!e.armyWarned10,
      publicWarned25: !!e.publicWarned25,
      publicWarned10: !!e.publicWarned10,
    },
    deposal:
      typeof raw.deposal === 'string' && DEPOSAL_TYPES.has(raw.deposal)
        ? (raw.deposal as RealmState['deposal'])
        : null,
  };
}

const DEPOSAL_TYPES = new Set(['DISMISSAL', 'MUTINY', 'PYRE']);
const SETTLEMENT_KINDS = new Set(['CAMP', 'TOWN', 'CITY']);
const TOWN_FOCUSES = new Set(['FARMING', 'MINING', 'TRADE_OUTPOST', 'FORT', 'URBAN_CENTER', 'GROWING']);

const sanitizeYields = (raw: unknown): BuildingInstance['yields'] => {
  if (!isRecord(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return out as BuildingInstance['yields'];
};

const DISTRICT_KINDS = new Set(['CAMP_CENTER', 'CITY_CENTER', 'ACADEMIC', 'METALLURGIC', 'APOTHECARY', 'COMMERCIAL']);

function sanitizeDistrictBuilding(raw: unknown): UrbanDistrict['buildings'][number] | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;
  if (typeof raw.name !== 'string') return null;
  const kind = DISTRICT_KINDS.has(String(raw.districtKind)) ? (raw.districtKind as DistrictKind) : 'CAMP_CENTER';
  return {
    id: raw.id,
    name: raw.name,
    districtKind: kind,
    age: Math.max(1, Math.floor(clampNum(raw.age, 1, 99, 1))),
    yields: sanitizeYields(raw.yields),
    civTag: typeof raw.civTag === 'string' ? raw.civTag : undefined,
  };
}

function sanitizeDistrict(raw: unknown): UrbanDistrict | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id.length === 0) return null;
  const kind = DISTRICT_KINDS.has(String(raw.kind)) ? (raw.kind as DistrictKind) : 'CAMP_CENTER';
  return {
    id: raw.id,
    kind,
    q: clampNum(raw.q, -1e6, 1e6, 0),
    r: clampNum(raw.r, -1e6, 1e6, 0),
    buildings: Array.isArray(raw.buildings)
      ? raw.buildings.map(sanitizeDistrictBuilding).filter((b): b is UrbanDistrict['buildings'][number] => b !== null)
      : [],
    isQuarter: !!raw.isQuarter,
    isUniqueQuarter: !!raw.isUniqueQuarter,
  };
}

function sanitizeBuilding(raw: Record<string, unknown>): BuildingInstance | null {
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  return {
    id: raw.id,
    name: raw.name,
    age: Math.max(1, Math.floor(clampNum(raw.age, 1, 99, 1))),
    yields: sanitizeYields(raw.yields),
    overbuilt: !!raw.overbuilt,
  };
}

function sanitizeSettlement(raw: unknown): Settlement | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  const kind = SETTLEMENT_KINDS.has(String(raw.kind)) ? (raw.kind as Settlement['kind']) : 'CAMP';
  const focus = TOWN_FOCUSES.has(String(raw.focus)) ? (raw.focus as TownFocus) : undefined;
  return {
    id: raw.id,
    name: raw.name,
    kind,
    q: clampNum(raw.q, -1e6, 1e6, 0),
    r: clampNum(raw.r, -1e6, 1e6, 0),
    population: clampNum(raw.population, 0, 1e6, 0),
    growthPool: clampNum(raw.growthPool, 0, 1e6, 0),
    focus,
    isCapital: !!raw.isCapital,
    buildings: Array.isArray(raw.buildings)
      ? raw.buildings.filter(isRecord).map(sanitizeBuilding).filter((b): b is BuildingInstance => b !== null)
      : [],
    districts: Array.isArray(raw.districts)
      ? raw.districts.map(sanitizeDistrict).filter((d): d is UrbanDistrict => d !== null)
      : [],
    workedHexes: Array.isArray(raw.workedHexes) ? raw.workedHexes.filter((h) => typeof h === 'string') : [],
    overbuilt: Array.isArray(raw.overbuilt) ? raw.overbuilt.filter((h) => typeof h === 'string') : [],
    foundedCampaignDay: Math.max(0, Math.floor(clampNum(raw.foundedCampaignDay, 0, 1e9, 0))),
    guardCount: Math.max(0, Math.floor(clampNum(raw.guardCount, 0, 5, 0))),
    clothedPairs: Math.max(0, Math.floor(clampNum(raw.clothedPairs, 0, 1e6, 0))),
    toolsCount: Math.max(0, Math.floor(clampNum(raw.toolsCount, 0, 1e6, 0))),
    toolsWear: Math.max(0, clampNum(raw.toolsWear, 0, 1e9, 0)),
  };
}

/** Repairs the settlements slice; a missing array used to abort day processing. */
export function sanitizeSettlements(raw: unknown): SettlementsState {
  const initial = createInitialSettlementsState();
  if (!isRecord(raw) || !Array.isArray(raw.settlements)) return initial;
  const yields = isRecord(raw.globalYields) ? raw.globalYields : {};
  return {
    settlements: raw.settlements
      .map(sanitizeSettlement)
      .filter((s): s is Settlement => s !== null),
    settlementLimit: Math.max(1, Math.floor(clampNum(raw.settlementLimit, 1, 100, initial.settlementLimit))),
    globalYields: {
      food: clampNum(yields.food, 0, 1e6, 0),
      production: clampNum(yields.production, 0, 1e6, 0),
      trade: clampNum(yields.trade, 0, 1e6, 0),
      discovery: clampNum(yields.discovery, 0, 1e6, 0),
      renown: clampNum(yields.renown, 0, 1e6, 0),
      morale: clampNum(yields.morale, 0, 100, initial.globalYields.morale),
      influence: clampNum(yields.influence, 0, 1e6, 0),
    },
  };
}

function sanitizeBlacksmithJob(raw: unknown): BlacksmithBatchJob | null {
  if (!isRecord(raw)) return null;
  if (
    typeof raw.id !== 'string' || raw.id.length === 0 ||
    typeof raw.recipeId !== 'string' || raw.recipeId.length === 0 ||
    typeof raw.name !== 'string'
  ) {
    return null;
  }
  return {
    id: raw.id,
    recipeId: raw.recipeId,
    name: raw.name,
    batchCount: Math.max(1, Math.floor(clampNum(raw.batchCount, 1, 1e6, 1))),
    totalTurns: Math.max(1, Math.floor(clampNum(raw.totalTurns, 1, 1e6, 1))),
    turnsLeft: Math.max(0, Math.floor(clampNum(raw.turnsLeft, 0, 1e6, 1))),
    outputs: sanitizeItemCounts(raw.outputs),
  };
}

/** Repairs the blacksmith slice. */
export function sanitizeBlacksmith(raw: unknown): BlacksmithState {
  if (!isRecord(raw) || !Array.isArray(raw.jobs)) return createBlacksmithState();
  return {
    jobs: raw.jobs
      .map(sanitizeBlacksmithJob)
      .filter((j): j is BlacksmithBatchJob => j !== null),
    nextJobId: Math.max(1, Math.floor(clampNum(raw.nextJobId, 1, 1e9, 1))),
    toolWearTicks: Math.max(0, Math.floor(clampNum(raw.toolWearTicks, 0, 1e9, 0))),
    maintenanceAlert: !!raw.maintenanceAlert,
  };
}

function sanitizeAnimal(raw: unknown): DomesticAnimal | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.species !== 'string') return null;
  return {
    id: raw.id,
    species: raw.species,
    dailyFeedKg: clampNum(raw.dailyFeedKg, 0, 1000, 0),
    dailyWaterL: clampNum(raw.dailyWaterL, 0, 1000, 0),
    milkLPerDay: clampNum(raw.milkLPerDay, 0, 1000, 0),
    butterfatGramsPerDay: clampNum(raw.butterfatGramsPerDay, 0, 10000, 0),
    manureKgPerDay: clampNum(raw.manureKgPerDay, 0, 1000, 0),
    eggsPerDay: clampNum(raw.eggsPerDay, 0, 1000, 0),
    hungerPct: clampNum(raw.hungerPct, 0, 100, 0),
    thirstPct: clampNum(raw.thirstPct, 0, 100, 0),
  };
}

/** Repairs the paddock slice; a string `animals` used to throw at the next dawn. */
export function sanitizePaddock(raw: unknown): Paddock {
  const initial = createPaddock();
  if (!isRecord(raw) || !Array.isArray(raw.animals)) return initial;
  return {
    id: typeof raw.id === 'string' ? raw.id : initial.id,
    name: typeof raw.name === 'string' ? raw.name : initial.name,
    maxAnimals: Math.max(1, Math.floor(clampNum(raw.maxAnimals, 1, 100, initial.maxAnimals))),
    animals: raw.animals.map(sanitizeAnimal).filter((a): a is DomesticAnimal => a !== null),
    storedFeedKg: clampNum(raw.storedFeedKg, 0, 1e6, initial.storedFeedKg),
    storedWaterL: clampNum(raw.storedWaterL, 0, 1e7, initial.storedWaterL),
    accumulatedManureKg: clampNum(raw.accumulatedManureKg, 0, 1e7, 0),
  };
}
