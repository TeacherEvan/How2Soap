/**
 * Shared application state & pure snapshot helpers.
 * Kept dependency-light so UI modules can import it without cycles.
 */
import { MAX_SPECIES } from '../engine/memoryLayout';
import type { WorkbenchTab } from '../ui/WorkbenchCanvas';
import type { SharedWorldView } from '../engine/memoryLayout';
import type { StrategyMapCanvas } from '../ui/StrategyMapCanvas';
import type { ToolAndInventoryState } from '../ui/ToolAndInventoryPanel';
import type { LabBench3DCanvas } from '../ui/gl/LabBench3DCanvas';
import type { TutorialController } from '../ui/TutorialController';
import { initialProgression } from '../engine/progression';
import type { CrisisSnapshot } from '../engine/crisis';

interface VesselMeta {
  id: number;
  material: string;
  capacityL: number;
  closed: boolean;
  label: string;
}

export interface Snapshot {
  tick: number;
  telemetry: Float64Array;
  moles: Float64Array;
}

interface PlayerState {
  glucoseKcal: number;
  adiposeKcal: number;
  hydrationPct: number;
  coreTempC: string;
  clothingIclo: number;
  day: number;
  ambientTempK: number;
  conditions: { fever: boolean; systemicInfection: boolean; woundContamination: boolean; dead: boolean };
}

export const MATERIAL_LABEL: Record<string, string> = {
  WOOD: 'Wood',
  RAW_CLAY: 'Raw clay',
  FIRED_CERAMIC: 'Fired ceramic',
  COPPER: 'Copper',
  BOROSILICATE: 'Borosilicate',
};

export const state = {
  worker: null as Worker | null,
  view: null as SharedWorldView | null,
  snapshot: null as Snapshot | null,
  vessels: [] as VesselMeta[],
  selected: 0,
  activeTab: 'REACTIONS' as WorkbenchTab,
  ever: {
    ash: false,
    lye: false,
    fat: false,
    soap: false,
    barSoap: false,
    backpack: false,
    bronzeFork: false,
    medicine: false,
    voltaicPile: false,
  },
  log: [] as string[],
  paused: false,
  deathModalShown: false,
  player: {
    glucoseKcal: 1200,
    adiposeKcal: 15000,
    hydrationPct: 100,
    coreTempC: '37.0',
    clothingIclo: 0.05,
    day: 1,
    ambientTempK: 288.15,
    conditions: { fever: false, systemicInfection: false, woundContamination: false, dead: false },
  } as PlayerState,
  inventory: {
    backpackUnlocked: false,
    bareHands: [null, null],
    backpack: new Array(24).fill(null),
    tools: {
      CUTTING_SKINNING: null,
      CHOPPING_CARVING: null,
      PERCUSSION_MINING: { name: 'River Hammerstone', slot: 'PERCUSSION_MINING', mohs: 6.5 },
      THERMAL_HANDLING: null,
      STITCHING_MEDICAL: null,
      EATING_UTENSIL: null,
    },
  } as ToolAndInventoryState,
  paddock: {
    animalsCount: 0,
    animals: [] as import('../engine/husbandry').DomesticAnimal[],
    storedFeedKg: 0,
    storedWaterL: 0,
    accumulatedManureKg: 0,
    feedKg: 0,
    waterL: 0,
    manureKg: 0,
  },
  items: [] as Array<{ id: string; count: number; massKg: number }>,
  progression: initialProgression(),
  colony: null as any,
  crisis: null as CrisisSnapshot | null,
  strategyMap: null as StrategyMapCanvas | null,
  tutorial: null as TutorialController | null,
  bench3d: null as LabBench3DCanvas | null,
};

export function selectedIndex(): number {
  return Math.min(state.selected, Math.max(0, state.vessels.length - 1));
}

export function speciesMoles(snapshot: Snapshot, vesselIndex: number, speciesIdx: number): number {
  return snapshot.moles[vesselIndex * MAX_SPECIES + speciesIdx];
}

export function formatClock(snapshot: Snapshot): string {
  const seconds = snapshot.tick * 360;
  const day = Math.floor(seconds / 86400) + 1;
  const hour = Math.floor((seconds % 86400) / 3600);
  return `Day ${day} · ${String(hour).padStart(2, '0')}:00`;
}

export function send(command: unknown): void {
  state.worker?.postMessage(command);
}
