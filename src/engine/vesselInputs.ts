import { liquidVolumeL, type VesselState } from './chemistry';
import { SPECIES } from '../data/speciesRegistry';

export interface VesselInputNeed {
  speciesIdx: number | null;
  minMoles: number;
  minLiquidL?: number;
  consume: 'all' | 'none';
}

export const VESSEL_INPUTS: Readonly<Record<string, VesselInputNeed>> = {
  WATER_VESSEL: { speciesIdx: null, minMoles: 0, minLiquidL: 1.0, consume: 'none' },
  HARDWOOD_ASH_WATER: { speciesIdx: SPECIES.K2CO3, minMoles: 0.05, minLiquidL: 0.5, consume: 'none' },
  ETHANOL_BROTH: { speciesIdx: SPECIES.ETHANOL, minMoles: 0.5, consume: 'all' },
  PENICILLIN_BROTH: { speciesIdx: SPECIES.PENICILLIN, minMoles: 0.001, consume: 'all' },
  SALICYLIC_ACID: { speciesIdx: SPECIES.SALICYLIC_ACID, minMoles: 0.001, consume: 'all' },
  SULFURIC_ACID: { speciesIdx: SPECIES.H2SO4, minMoles: 0.5, consume: 'all' },
  MOLTEN_KOH: { speciesIdx: SPECIES.KOH, minMoles: 1.0, consume: 'all' },
  MOLTEN_NAOH: { speciesIdx: SPECIES.NAOH, minMoles: 1.0, consume: 'all' },
};

export interface VesselInputPlan {
  vesselId: number;
  speciesIdx: number | null;
  consume: 'all' | 'none';
}

export interface VesselInputResult {
  ok: boolean;
  shortfall?: string[];
  plan?: VesselInputPlan[];
}

export function satisfyVesselInputs(
  worldVessels: readonly VesselState[],
  ids: readonly string[],
): VesselInputResult {
  const plan: VesselInputPlan[] = [];
  const shortfall: string[] = [];

  for (const id of ids) {
    const need = VESSEL_INPUTS[id];
    if (!need) continue;

    let found = false;
    for (const vessel of worldVessels) {
      let ok = false;
      if (need.speciesIdx === null) {
        // Liquid volume check (water, ash water)
        if (liquidVolumeL(vessel) >= (need.minLiquidL ?? 0)) ok = true;
      } else {
        // Species moles check
        if (vessel.moles[need.speciesIdx] >= need.minMoles) ok = true;
      }
      if (ok) {
        plan.push({ vesselId: vessel.id, speciesIdx: need.speciesIdx, consume: need.consume });
        found = true;
        break;
      }
    }
    if (!found) {
      shortfall.push(needLabel(id));
    }
  }

  if (shortfall.length > 0) return { ok: false, shortfall };
  return { ok: true, plan };
}

function needLabel(id: string): string {
  const labels: Record<string, string> = {
    WATER_VESSEL: 'Water (≥ 1 L)',
    HARDWOOD_ASH_WATER: 'Weak ash water (≥ 0.5 L)',
    ETHANOL_BROTH: 'Ethanol broth (≥ 0.5 mol)',
    PENICILLIN_BROTH: 'Penicillin broth (≥ 0.001 mol)',
    SALICYLIC_ACID: 'Salicylic acid (≥ 0.001 mol)',
    SULFURIC_ACID: 'Sulfuric acid (≥ 0.5 mol)',
    MOLTEN_KOH: 'Molten KOH (≥ 1.0 mol)',
    MOLTEN_NAOH: 'Molten NaOH (≥ 1.0 mol)',
  };
  return labels[id] ?? id;
}

export function applyVesselConsumption(
  worldVessels: VesselState[],
  plan: VesselInputPlan[],
): void {
  for (const step of plan) {
    if (step.consume === 'all' && step.speciesIdx !== null) {
      const vessel = worldVessels.find(v => v.id === step.vesselId);
      if (vessel) vessel.moles[step.speciesIdx] = 0;
    }
    // 'none' consumes nothing — presence check only
  }
}