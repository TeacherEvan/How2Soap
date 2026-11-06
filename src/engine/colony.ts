/**
 * Colony Engine — Labor, Boids Kinematics, Desire Paths, Multi-Commodity Payroll & Pharmacokinetics
 *
 * Implements Section 2 of Top-Down Strategy & Colony Labor System:
 * - 4 Archetypes: FORAGER, MINER, HERBALIST, APPRENTICE_CHEMIST
 * - Multi-commodity payroll: Food, Metals, Medicines, Stimulants
 * - Desire path grid: 32x32 Uint8Array(1024), mapping [-1600m, +1600m]
 * - Reynolds Boids separation: minimum distance >= 3.5m
 * - Stimulant pharmacokinetics: Boost phase -> Crash phase -> Normal
 */

import type { InventoryContainer, InventorySlot } from './inventory';
import { addItemToContainer, removeItemFromContainer } from './inventory';
import type { BiomeCategoryNode, BiomeSpeciesNode, HarvestablePart, HarvestYieldItem } from '../data/biomeNodes';
import { getSpeciesWorldPosition } from '../data/biomeNodes';
import { ITEM_BY_ID, type StimulantSpec } from '../data/items';

export type ColonistArchetype = 'FORAGER' | 'MINER' | 'HERBALIST' | 'APPRENTICE_CHEMIST';

export type ColonistStatus =
  | 'IDLE'
  | 'TRAVELING'
  | 'GATHERING'
  | 'RETURNING'
  | 'STRIKE'
  | 'RESTING';

export type WageCommodity =
  | 'BAR_SOAP'
  | 'WILLOW_TEA'
  | 'MINT_TONIC'
  | 'NITROUS_TONIC'
  | 'COPPER_INGOT'
  | 'MEAT_RAW'
  | 'FIELD_MUSHROOM'
  | string;

export const WAGE_COMMODITIES: ReadonlyArray<WageCommodity> = [
  'BAR_SOAP',
  'MEAT_RAW',
  'FIELD_MUSHROOM',
  'COPPER_INGOT',
  'WILLOW_TEA',
  'MINT_TONIC',
  'NITROUS_TONIC',
];

export interface WageContract {
  commodity: WageCommodity;
  dailyAmount: number;
}

export interface ActiveStimulantState {
  stimulantId: string;
  phase: 'BOOST' | 'CRASH';
  speedMultiplier: number;
  durationMinutes: number;
  crashMinutes: number;
  crashMultiplier: number;
  elapsedMinutes: number;
}

export interface ColonistJob {
  speciesId: string;
  partId: string;
  workRequired: number;
  workDone: number;
}

export interface Colonist {
  id: string;
  name: string;
  archetype: ColonistArchetype;
  status: ColonistStatus;
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
  baseSpeed: number; // meters per minute (e.g. 80 m/min ~ 1.33 m/s normal walking speed)
  morale: number; // 0 to 100
  wageContract: WageContract;
  activeStimulant: ActiveStimulantState | null;
  assignedJob: ColonistJob | null;
  carriedYields: HarvestYieldItem[];
  recruitedTick: number;
}

export interface ColonyLedgerEntry {
  tick: number;
  colonistId: string;
  commodity: string;
  amount: number;
  paid: boolean;
}

export interface ColonyState {
  colonists: Colonist[];
  ledger: ColonyLedgerEntry[];
  desirePathGrid: Uint8Array; // 32x32 = 1024 bytes
  lastDecayTick?: number;
  nextColonistId: number;
}

export const GRID_SIZE = 32;
export const GRID_HALF_EXTENT = 1600; // [-1600m, +1600m]
export const CELL_SIZE = (GRID_HALF_EXTENT * 2) / GRID_SIZE; // 3200 / 32 = 100 meters per cell
export const MIN_SEPARATION_DISTANCE = 3.5; // meters
export const DEFAULT_BASE_SPEED = 80; // meters per minute (~1.33 m/s)

/**
 * Maps world coordinates (meters) to 32x32 desire path grid (col, row).
 * World coordinates span [-1600m, +1600m].
 */
export function worldToGrid(x: number, y: number): { col: number; row: number } {
  const normX = (x + GRID_HALF_EXTENT) / (GRID_HALF_EXTENT * 2);
  const normY = (y + GRID_HALF_EXTENT) / (GRID_HALF_EXTENT * 2);
  const col = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(normX * GRID_SIZE)));
  const row = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(normY * GRID_SIZE)));
  return { col, row };
}

/**
 * Maps grid cell (col, row) to world coordinates (center of cell in meters).
 */
export function gridToWorld(col: number, row: number): { x: number; y: number } {
  const minX = -GRID_HALF_EXTENT + col * CELL_SIZE;
  const minY = -GRID_HALF_EXTENT + row * CELL_SIZE;
  return {
    x: minX + CELL_SIZE / 2,
    y: minY + CELL_SIZE / 2,
  };
}

/**
 * Creates the initial colony state with 0 colonists and an empty 1024-byte desire path grid.
 */
export function createInitialColonyState(): ColonyState {
  return {
    colonists: [],
    ledger: [],
    desirePathGrid: new Uint8Array(GRID_SIZE * GRID_SIZE),
    nextColonistId: 1,
  };
}

/**
 * Recruits a new colonist at the Camp Hearth (0, 0).
 */
export function recruitColonist(
  state: ColonyState,
  name: string,
  archetype: ColonistArchetype,
  wageContract: WageContract,
  currentTick: number,
): Colonist {
  const id = `colonist_${state.nextColonistId++}`;
  const colonist: Colonist = {
    id,
    name,
    archetype,
    status: 'IDLE',
    position: { x: 0, y: 0 },
    velocity: { vx: 0, vy: 0 },
    baseSpeed: DEFAULT_BASE_SPEED,
    morale: 80,
    wageContract: { ...wageContract },
    activeStimulant: null,
    assignedJob: null,
    carriedYields: [],
    recruitedTick: currentTick,
  };
  state.colonists.push(colonist);
  return colonist;
}

/**
 * Updates a colonist's wage contract.
 */
export function setWageContract(colonist: Colonist, contract: WageContract): void {
  colonist.wageContract = { ...contract };
}

/**
 * Assigns a resource gathering job to a colonist.
 */
export function assignColonistJob(
  colonist: Colonist,
  speciesId: string,
  partId: string,
  workRequired = 10,
): void {
  colonist.assignedJob = {
    speciesId,
    partId,
    workRequired,
    workDone: 0,
  };
  colonist.status = 'TRAVELING';
}

/**
 * Administers a chemical stimulant to a colonist.
 */
export function administerStimulant(colonist: Colonist, stimulantId: string): boolean {
  const item = ITEM_BY_ID[stimulantId];
  if (!item) return false;
  const spec: StimulantSpec | undefined = item.stimulantSpec ?? (item as any).stimulant;
  if (!spec) return false;

  colonist.activeStimulant = {
    stimulantId,
    phase: 'BOOST',
    speedMultiplier: spec.speedMultiplier,
    durationMinutes: spec.durationMinutes,
    crashMinutes: spec.crashMinutes,
    crashMultiplier: spec.crashMultiplier,
    elapsedMinutes: 0,
  };
  return true;
}

/**
 * Finds a species node and harvestable part from the BIOME_DAG.
 */
function findBiomeNodeAndPart(
  biomeDag: ReadonlyArray<BiomeCategoryNode>,
  speciesId: string,
  partId: string,
): { species?: BiomeSpeciesNode; part?: HarvestablePart } {
  for (const cat of biomeDag) {
    for (const sp of cat.species) {
      if (sp.id === speciesId) {
        const part = sp.parts.find(p => p.id === partId);
        return { species: sp, part };
      }
    }
  }
  return {};
}

/**
 * Steps the colony forward in time:
 * - Multi-commodity payroll check at midnight (currentTick % 1440 === 0)
 * - Desire path decay
 * - Colonist pharmacokinetics, Boids kinematics, job progression, desire path erosion
 */
export function stepColony(
  state: ColonyState,
  deltaMinutes: number,
  currentTick: number,
  campStorage: InventoryContainer,
  biomeDag: ReadonlyArray<BiomeCategoryNode>,
): void {
  // 1. Midnight Payroll Check (tick % 240 === 0 or legacy 1440)
  if (currentTick > 0 && (currentTick % 240 === 0 || currentTick % 1440 === 0)) {
    processPayroll(state, currentTick, campStorage);
  }

  // 2. Desire Path Natural Decay: decrement unused cells periodically or over time
  // Every minute (or when deltaMinutes > 0), decay slowly
  if (currentTick > 0 && currentTick % 10 === 0) {
    decayDesirePaths(state, 1);
  }

  // 3. Update each colonist
  for (let i = 0; i < state.colonists.length; i++) {
    const colonist = state.colonists[i];

    // Strike status: halts work
    if (colonist.status === 'STRIKE') {
      continue;
    }

    // Update Stimulant Pharmacokinetics
    updateStimulant(colonist, deltaMinutes);

    // Kinematics and Job Execution
    updateColonistJobAndMovement(
      colonist,
      state,
      deltaMinutes,
      biomeDag,
      campStorage,
    );
  }

  // 4. Boids Separation Enforcement
  applyBoidsSeparation(state.colonists);
}

function processPayroll(
  state: ColonyState,
  currentTick: number,
  campStorage: InventoryContainer,
): void {
  for (const colonist of state.colonists) {
    const { commodity, dailyAmount } = colonist.wageContract;
    let paid = false;

    // Check if campStorage has enough of the commodity
    let foundCount = 0;
    for (const slot of campStorage.slots) {
      if (slot && slot.itemId === commodity) {
        foundCount += slot.count;
      }
    }

    if (foundCount >= dailyAmount && dailyAmount > 0) {
      const removed = removeItemFromContainer(campStorage, commodity, dailyAmount);
      if (removed) {
        paid = true;
        // Morale boost on timely payment
        colonist.morale = Math.min(100, colonist.morale + 5);
        if (colonist.status === 'STRIKE' && colonist.morale >= 20) {
          colonist.status = 'IDLE';
        }
      }
    }

    if (!paid) {
      colonist.morale = Math.max(0, colonist.morale - 25);
      if (colonist.morale < 20) {
        colonist.status = 'STRIKE';
      }
    }

    state.ledger.push({
      tick: currentTick,
      colonistId: colonist.id,
      commodity,
      amount: dailyAmount,
      paid,
    });
    if (state.ledger.length > 100) {
      state.ledger.splice(0, state.ledger.length - 100);
    }
  }
}

function decayDesirePaths(state: ColonyState, deltaMinutes: number): void {
  // Overgrowth slowly decays desire paths
  // E.g., decay rate: 1 level per 10 minutes of simulation time
  const decayAmount = Math.max(1, Math.floor(deltaMinutes / 2));
  for (let i = 0; i < state.desirePathGrid.length; i++) {
    if (state.desirePathGrid[i] > 0) {
      state.desirePathGrid[i] = Math.max(0, state.desirePathGrid[i] - decayAmount);
    }
  }
}

function updateStimulant(colonist: Colonist, deltaMinutes: number): void {
  if (!colonist.activeStimulant) return;

  const stim = colonist.activeStimulant;
  stim.elapsedMinutes += deltaMinutes;

  if (stim.phase === 'BOOST') {
    if (stim.elapsedMinutes >= stim.durationMinutes) {
      // Transition to crash phase
      stim.phase = 'CRASH';
      stim.speedMultiplier = stim.crashMultiplier;
      colonist.morale = Math.max(0, colonist.morale - 8);
      if (colonist.morale < 20) {
        colonist.status = 'STRIKE';
      }
    }
  } else if (stim.phase === 'CRASH') {
    const totalDuration = stim.durationMinutes + stim.crashMinutes;
    if (stim.elapsedMinutes >= totalDuration) {
      // Stimulant wore off
      colonist.activeStimulant = null;
    }
  }
}

function updateColonistJobAndMovement(
  colonist: Colonist,
  state: ColonyState,
  deltaMinutes: number,
  biomeDag: ReadonlyArray<BiomeCategoryNode>,
  campStorage: InventoryContainer,
): void {
  if (colonist.status === 'IDLE' || colonist.status === 'RESTING') {
    return;
  }

  // Calculate current effective speed
  const gridPos = worldToGrid(colonist.position.x, colonist.position.y);
  const cellIdx = gridPos.row * GRID_SIZE + gridPos.col;
  const pathLevel = state.desirePathGrid[cellIdx];
  const desirePathSpeedMultiplier = 1.0 + 0.2 * (pathLevel / 255);
  const stimulantMultiplier = colonist.activeStimulant ? colonist.activeStimulant.speedMultiplier : 1.0;
  const effectiveSpeed = colonist.baseSpeed * desirePathSpeedMultiplier * stimulantMultiplier; // meters / minute

  if (colonist.status === 'TRAVELING') {
    if (!colonist.assignedJob) {
      colonist.status = 'IDLE';
      return;
    }

    const targetPos = getSpeciesWorldPosition(colonist.assignedJob.speciesId);
    const arrived = moveTowards(state, colonist, targetPos, effectiveSpeed * deltaMinutes);

    recordFootstep(state, colonist.position.x, colonist.position.y);

    if (arrived) {
      colonist.status = 'GATHERING';
    }
  } else if (colonist.status === 'GATHERING') {
    if (!colonist.assignedJob) {
      colonist.status = 'IDLE';
      return;
    }

    // Accumulate work
    const workRate = 1.0 * stimulantMultiplier;
    colonist.assignedJob.workDone += workRate * deltaMinutes;

    if (colonist.assignedJob.workDone >= colonist.assignedJob.workRequired) {
      // Completed gathering, collect yield
      const { part } = findBiomeNodeAndPart(
        biomeDag,
        colonist.assignedJob.speciesId,
        colonist.assignedJob.partId,
      );

      if (part && part.yields) {
        let mult = 1.0;
        if (colonist.archetype === 'FORAGER' && (colonist.assignedJob.partId.includes('DEADFALL') || colonist.assignedJob.partId.includes('BERRIES') || colonist.assignedJob.partId.includes('CLAY'))) {
          mult = 1.35;
        } else if (colonist.archetype === 'MINER' && (colonist.assignedJob.partId.includes('SEAM') || colonist.assignedJob.partId.includes('VEIN') || colonist.assignedJob.partId.includes('HALITE') || colonist.assignedJob.partId.includes('SULFUR'))) {
          mult = 1.45;
        } else if (colonist.archetype === 'HERBALIST' && (colonist.assignedJob.partId.includes('BARK') || colonist.assignedJob.partId.includes('MINT') || colonist.assignedJob.partId.includes('MUSHROOM'))) {
          mult = 1.40;
        } else if (colonist.archetype === 'APPRENTICE_CHEMIST') {
          mult = 1.30;
        }
        colonist.carriedYields = part.yields.map(y => ({
          ...y,
          massKg: y.massKg * mult,
        }));
      } else {
        colonist.carriedYields = [];
      }

      colonist.status = 'RETURNING';
    }
  } else if (colonist.status === 'RETURNING') {
    const hearthPos = { x: 0, y: 0 };
    const arrived = moveTowards(state, colonist, hearthPos, effectiveSpeed * deltaMinutes);

    recordFootstep(state, colonist.position.x, colonist.position.y);

    if (arrived) {
      // Deposit carried yields into camp storage
      for (const yieldItem of colonist.carriedYields) {
        const slot: InventorySlot = {
          itemId: yieldItem.itemId,
          count: 1,
          massKg: yieldItem.massKg,
          label: yieldItem.name,
        };
        addItemToContainer(campStorage, slot);
      }
      colonist.carriedYields = [];
      // Loop gathering trips continuously until unassigned
      colonist.status = 'TRAVELING';
    }
  }
}

export function getApprenticeChemistMultiplier(colony: ColonyState): number {
  let bonus = 1.0;
  for (const c of colony.colonists) {
    if (c.archetype === 'APPRENTICE_CHEMIST' && c.status !== 'STRIKE') {
      bonus += 0.15;
    }
  }
  return bonus;
}

function moveTowards(
  state: ColonyState,
  colonist: Colonist,
  target: { x: number; y: number },
  maxDist: number,
): boolean {
  const dx = target.x - colonist.position.x;
  const dy = target.y - colonist.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= 0.5 || dist <= maxDist) {
    colonist.position.x = target.x;
    colonist.position.y = target.y;
    colonist.velocity = { vx: 0, vy: 0 };
    return true;
  }

  const step = Math.min(dist, maxDist);
  const vx = (dx / dist) * step;
  const vy = (dy / dist) * step;

  const startX = colonist.position.x;
  const startY = colonist.position.y;
  colonist.position.x += vx;
  colonist.position.y += vy;
  colonist.velocity = { vx, vy };

  // Sub-step footsteps along path every 50 meters
  const subSteps = Math.max(1, Math.floor(step / 50));
  for (let s = 1; s <= subSteps; s++) {
    const frac = s / subSteps;
    recordFootstep(state, startX + vx * frac, startY + vy * frac);
  }
  return false;
}

function recordFootstep(state: ColonyState, x: number, y: number): void {
  const gridPos = worldToGrid(x, y);
  const cellIdx = gridPos.row * GRID_SIZE + gridPos.col;
  // Increment desire path wear, up to 255
  state.desirePathGrid[cellIdx] = Math.min(255, state.desirePathGrid[cellIdx] + 8);
}

function applyBoidsSeparation(colonists: Colonist[]): void {
  const n = colonists.length;
  if (n < 2) return;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const c1 = colonists[i];
      const c2 = colonists[j];

      const dx = c2.position.x - c1.position.x;
      const dy = c2.position.y - c1.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < MIN_SEPARATION_DISTANCE) {
        // Compute repulsion force
        const overlap = MIN_SEPARATION_DISTANCE - dist;
        let nx = dx / (dist || 0.001);
        let ny = dy / (dist || 0.001);
        if (dist === 0) {
          // If perfectly overlapping, push along arbitrary axis
          nx = 1;
          ny = 0;
        }

        const push = Math.max(0.5, overlap * 0.5);
        c1.position.x -= nx * push;
        c1.position.y -= ny * push;
        c2.position.x += nx * push;
        c2.position.y += ny * push;
      }
    }
  }
}
