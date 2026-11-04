import {
  getSpecies,
  MAX_DEFINED_SPECIES,
  SPECIES,
  SPECIES_BY_INDEX,
  type ChemicalSpecies,
} from '../data/speciesRegistry';
import {
  ELECTROLYSIS_RULES,
  REACTIONS,
  type ElectrolysisRule,
  type ReactionRule,
} from '../data/reactionRules';
import { MAX_SPECIES } from './memoryLayout';

export const R_GAS = 8.314462618; // J/(mol*K)
export const FARADAY = 96485.33212; // C/mol
export const KW = 1.0e-14; // water auto-ionization at 298.15 K

export type VesselMaterialKey =
  | 'WOOD'
  | 'RAW_CLAY'
  | 'FIRED_CERAMIC'
  | 'COPPER'
  | 'BOROSILICATE';

export interface VesselMaterial {
  readonly conductivityWPerMK: number;
  readonly baseHeatCapacityJPerK: number;
  readonly failureTempK: number;
  readonly burstPressureKPa: number;
}

export const MATERIALS: Record<VesselMaterialKey, VesselMaterial> = {
  WOOD: {
    conductivityWPerMK: 0.15,
    baseHeatCapacityJPerK: 850,
    failureTempK: 523,
    burstPressureKPa: 180,
  },
  RAW_CLAY: {
    conductivityWPerMK: 0.8,
    baseHeatCapacityJPerK: 700,
    failureTempK: 1273,
    burstPressureKPa: 250,
  },
  FIRED_CERAMIC: {
    conductivityWPerMK: 1.5,
    baseHeatCapacityJPerK: 900,
    failureTempK: 1473,
    burstPressureKPa: 400,
  },
  COPPER: {
    conductivityWPerMK: 398,
    baseHeatCapacityJPerK: 400,
    failureTempK: 1358,
    burstPressureKPa: 1200,
  },
  BOROSILICATE: {
    conductivityWPerMK: 1.2,
    baseHeatCapacityJPerK: 750,
    failureTempK: 1200,
    burstPressureKPa: 600,
  },
};

const WALL_AREA_M2 = 0.12;
const WALL_THICKNESS_M = 0.015;
const AIR_FILM_W_PER_M2K = 10;

export interface VesselState {
  id: number;
  material: VesselMaterialKey;
  capacityL: number;
  headspaceClosed: boolean;
  temperatureK: number;
  /** Total moles per species (dissolved/suspended + settled solids). */
  moles: Float64Array;
  /** Settled solid phase per species; excluded from decanting. */
  precipitated: Float64Array;
  heaterWatts: number;
  /** -1 = vapour vents to atmosphere; otherwise receiving vessel id. */
  condenserTargetVesselId: number;
  pressureKPa: number;
  ruptured: boolean;
  appliedVolts: number;
  cellResistanceOhm: number;
}

export interface StepResult {
  events: string[];
  reactionExtents: Map<string, number>;
}

export function createVessel(
  id: number,
  material: VesselMaterialKey,
  capacityL: number,
  headspaceClosed = false,
): VesselState {
  return {
    id,
    material,
    capacityL,
    headspaceClosed,
    temperatureK: 293.15,
    moles: new Float64Array(MAX_SPECIES),
    precipitated: new Float64Array(MAX_SPECIES),
    heaterWatts: 0,
    condenserTargetVesselId: -1,
    pressureKPa: 101.325,
    ruptured: false,
    appliedVolts: 0,
    cellResistanceOhm: 2,
  };
}

const LIQUID_MOLAR_VOLUME_L: Partial<Record<number, number>> = {
  [SPECIES.H2O]: 0.01805,
  [SPECIES.GLYCEROL]: 0.073,
  [SPECIES.KOH]: 0.03,
  [SPECIES.K_STEARATE]: 0.32,
  [SPECIES.NA_STEARATE]: 0.33,
};

export function dissolvedMoles(vessel: VesselState, speciesIdx: number): number {
  return Math.max(0, vessel.moles[speciesIdx] - vessel.precipitated[speciesIdx]);
}

/** Approximate liquid volume in litres from dissolved liquid/aqueous species. */
export function liquidVolumeL(vessel: VesselState): number {
  let litres = 0;
  for (let idx = 0; idx < MAX_DEFINED_SPECIES; idx += 1) {
    const species = SPECIES_BY_INDEX.get(idx);
    if (!species) continue;
    if (species.standardPhase !== 'LIQUID' && species.standardPhase !== 'AQUEOUS') {
      continue;
    }
    const n = dissolvedMoles(vessel, idx);
    if (n <= 0) continue;
    const molarVolume = LIQUID_MOLAR_VOLUME_L[idx] ?? 0.05;
    litres += n * molarVolume;
  }
  return litres;
}

export function totalHeatCapacityJPerK(vessel: VesselState): number {
  const material = MATERIALS[vessel.material];
  let capacity = material.baseHeatCapacityJPerK;
  for (let idx = 0; idx < MAX_DEFINED_SPECIES; idx += 1) {
    const species = SPECIES_BY_INDEX.get(idx);
    if (!species) continue;
    const n = vessel.moles[idx];
    if (n <= 0) continue;
    capacity += n * species.molarMass * species.specificHeat;
  }
  return capacity;
}

/**
 * Strong-ion-difference pH model.
 *
 * SID = sum(z_i * [i]) over dissolved species. The master spec prints
 * [H+] = (SID + sqrt(SID^2 + 4Kw)) / 2, which is sign-inverted: it returns
 * pH ~0.3 for 0.5 M KOH, contradicting its own walkthrough result (13.71).
 * We implement the chemically correct root:
 *   [H+] = (-SID + sqrt(SID^2 + 4Kw)) / 2.
 */
export function computePH(vessel: VesselState): number {
  const volume = Math.max(liquidVolumeL(vessel), 1e-6);
  let sid = 0;
  for (let idx = 0; idx < MAX_DEFINED_SPECIES; idx += 1) {
    const species = SPECIES_BY_INDEX.get(idx);
    if (!species || species.ionChargeZ === 0) continue;
    sid += species.ionChargeZ * dissolvedMoles(vessel, idx);
  }
  sid /= volume;
  const hPlus = (-sid + Math.sqrt(sid * sid + 4 * KW)) / 2;
  return -Math.log10(Math.max(hPlus, 1e-15));
}

export function applyHeat(vessel: VesselState, joules: number): void {
  if (joules === 0) return;
  const capacity = totalHeatCapacityJPerK(vessel);
  vessel.temperatureK += joules / capacity;
}

export function addSpecies(vessel: VesselState, speciesIdx: number, moles: number): void {
  if (moles <= 0) return;
  vessel.moles[speciesIdx] += moles;
}

export function addWaterLiters(vessel: VesselState, litres: number): void {
  addSpecies(vessel, SPECIES.H2O, (litres * 1000) / 18.015);
}

export interface StepOptions {
  dtSeconds: number;
  ambientTempK: number;
  reactions?: ReadonlyArray<ReactionRule>;
  electrolysisRules?: ReadonlyArray<ElectrolysisRule>;
  condenser?: VesselState | null;
}

export function stepVessel(vessel: VesselState, options: StepOptions): StepResult {
  const events: string[] = [];
  const reactionExtents = new Map<string, number>();
  const reactions = options.reactions ?? REACTIONS;
  const electrolysisRules = options.electrolysisRules ?? ELECTROLYSIS_RULES;
  const dt = options.dtSeconds;
  if (vessel.ruptured) return { events, reactionExtents };

  const phBefore = computePH(vessel);
  let reactionHeatJ = 0;

  // 1. Arrhenius reaction kinetics.
  for (const rule of reactions) {
    if (rule.minTempK !== undefined && vessel.temperatureK < rule.minTempK) continue;
    if (rule.minpH !== undefined && phBefore < rule.minpH) continue;
    if (rule.maxpH !== undefined && phBefore > rule.maxpH) continue;

    let limitingExtent = Infinity;
    for (const reactant of rule.reactants) {
      const available = vessel.moles[reactant.speciesIdx];
      limitingExtent = Math.min(limitingExtent, available / reactant.stoich);
    }
    if (!Number.isFinite(limitingExtent) || limitingExtent <= 1e-9) continue;

    const k = rule.preExponentialA * Math.exp(-rule.activationEnergyJ / (R_GAS * vessel.temperatureK));
    const extent = Math.min(limitingExtent, limitingExtent * (1 - Math.exp(-k * dt)));
    if (extent <= 1e-12) continue;

    for (const reactant of rule.reactants) {
      vessel.moles[reactant.speciesIdx] = Math.max(
        0,
        vessel.moles[reactant.speciesIdx] - extent * reactant.stoich,
      );
    }
    for (const product of rule.products) {
      vessel.moles[product.speciesIdx] += extent * product.stoich;
    }
    reactionHeatJ += -rule.enthalpyJPerMol * extent;
    reactionExtents.set(rule.id, extent);
    events.push(`reaction:${rule.id}:${extent.toFixed(6)}`);
  }

  // 2. Calorimetry: reaction heat + heater - Newtonian loss.
  //    Wall conduction is in series with an external air film; without the
  //    film term, high-conductivity vessels (copper) lose thousands of watts
  //    and can never be heated, which is unphysical for an open pot.
  const material = MATERIALS[vessel.material];
  const conductionWPerK = (material.conductivityWPerMK * WALL_AREA_M2) / WALL_THICKNESS_M;
  const airFilmWPerK = AIR_FILM_W_PER_M2K * WALL_AREA_M2;
  const lossCoefficientWPerK = 1 / (1 / conductionWPerK + 1 / airFilmWPerK);
  const lossWatts = lossCoefficientWPerK * (vessel.temperatureK - options.ambientTempK);
  const netHeatJ = reactionHeatJ + (vessel.heaterWatts - lossWatts) * dt;
  applyHeat(vessel, netHeatJ);

  // 3. Electrolysis (Faraday), if a pile is connected.
  if (vessel.appliedVolts > 0) {
    for (const rule of electrolysisRules) {
      if (rule.minTempK !== undefined && vessel.temperatureK < rule.minTempK) continue;
      if (vessel.appliedVolts <= rule.minDecompositionVolts) continue;
      const current =
        (vessel.appliedVolts - rule.minDecompositionVolts) /
        Math.max(vessel.cellResistanceOhm, 0.01);
      const extentMax = (current * dt) / (FARADAY * rule.electronsZ);
      const available = vessel.moles[rule.electrolyteSpeciesIdx] / rule.electrolyteStoich;
      const extent = Math.min(extentMax, available);
      if (extent <= 1e-12) continue;
      vessel.moles[rule.electrolyteSpeciesIdx] = Math.max(
        0,
        vessel.moles[rule.electrolyteSpeciesIdx] - extent * rule.electrolyteStoich,
      );
      vessel.moles[rule.anodeProductIdx] += extent * rule.anodeStoich;
      vessel.moles[rule.cathodeProductIdx] += extent * rule.cathodeStoich;
      for (const co of rule.coProducts ?? []) {
        vessel.moles[co.speciesIdx] = Math.max(
          0,
          vessel.moles[co.speciesIdx] + extent * co.stoich,
        );
      }
      events.push(`electrolysis:${rule.id}:${extent.toFixed(6)}`);
    }
  }

  // 4. Latent heat: clamp at the lowest boiling liquid, vaporize the excess.
  const boil = stepBoiling(vessel, options.condenser ?? null);
  if (boil) events.push(...boil);

  // 5. Solubility-product precipitation.
  const precipitates = stepPrecipitation(vessel);
  if (precipitates.length > 0) events.push(...precipitates);

  // 6. Pressure and material limits.
  updatePressure(vessel);
  if (vessel.temperatureK > material.failureTempK) {
    vessel.temperatureK = material.failureTempK;
    events.push('material_failure');
  }
  if (vessel.headspaceClosed && vessel.pressureKPa > material.burstPressureKPa) {
    vessel.ruptured = true;
    vessel.headspaceClosed = false;
    vessel.pressureKPa = 101.325;
    events.push('vessel_rupture');
  }

  return { events, reactionExtents };
}

function stepBoiling(vessel: VesselState, condenser: VesselState | null): string[] {
  let boilingSpecies: ChemicalSpecies | null = null;
  let lowestBoilingPoint = Infinity;
  for (let idx = 0; idx < MAX_DEFINED_SPECIES; idx += 1) {
    const species = SPECIES_BY_INDEX.get(idx);
    if (!species) continue;
    if (species.standardPhase === 'GAS') continue;
    if (species.boilingPointK <= 0 || species.enthalpyVapJPerMol <= 0) continue;
    if (dissolvedMoles(vessel, idx) <= 0.01) continue;
    if (species.boilingPointK < lowestBoilingPoint) {
      lowestBoilingPoint = species.boilingPointK;
      boilingSpecies = species;
    }
  }
  if (!boilingSpecies || vessel.temperatureK <= lowestBoilingPoint) return [];

  const excessJ = (vessel.temperatureK - lowestBoilingPoint) * totalHeatCapacityJPerK(vessel);
  vessel.temperatureK = lowestBoilingPoint;
  let vaporMoles = excessJ / boilingSpecies.enthalpyVapJPerMol;
  const available = Math.max(0, dissolvedMoles(vessel, boilingSpecies.index));
  vaporMoles = Math.min(vaporMoles, available);
  if (vaporMoles <= 1e-12) return [];

  vessel.moles[boilingSpecies.index] -= vaporMoles;
  const events = [`boil:${boilingSpecies.code}:${vaporMoles.toFixed(6)}`];

  if (condenser) {
    condenser.moles[boilingSpecies.index] += vaporMoles;
    applyHeat(condenser, vaporMoles * boilingSpecies.enthalpyVapJPerMol);
    events.push(`condense:${boilingSpecies.code}:${vaporMoles.toFixed(6)}`);
  }
  return events;
}

function stepPrecipitation(vessel: VesselState): string[] {
  const events: string[] = [];
  const litres = liquidVolumeL(vessel);
  if (litres <= 1e-9) return events;
  for (let idx = 0; idx < MAX_DEFINED_SPECIES; idx += 1) {
    const species = SPECIES_BY_INDEX.get(idx);
    if (!species || species.precipitateSpeciesIdx === undefined) continue;
    if (!Number.isFinite(species.solubilityGPer100gH2O)) continue;
    const dissolved = dissolvedMoles(vessel, idx);
    if (dissolved <= 0) continue;
    // g/100 g water -> mol/L (1 L water = 1000 g = 10 x 100 g)
    const maxDissolvedMoles =
      (species.solubilityGPer100gH2O * litres * 10) / species.molarMass;
    if (dissolved > maxDissolvedMoles + 1e-12) {
      const excess = dissolved - maxDissolvedMoles;
      vessel.precipitated[idx] += excess;
      events.push(`precipitate:${species.code}:${excess.toFixed(6)}`);
    }
  }
  return events;
}

function updatePressure(vessel: VesselState): void {
  const liquid = liquidVolumeL(vessel);
  const headspaceL = Math.max(vessel.capacityL - liquid, 0.05);
  let gasMoles = 0;
  for (let idx = 0; idx < MAX_DEFINED_SPECIES; idx += 1) {
    const species = SPECIES_BY_INDEX.get(idx);
    if (species?.standardPhase === 'GAS') gasMoles += vessel.moles[idx];
  }
  const volumeM3 = headspaceL * 1e-3;
  const pascal = (gasMoles * R_GAS * vessel.temperatureK) / volumeM3;
  vessel.pressureKPa = 101.325 + pascal / 1000;
}

/** Decant supernatant liquid; settled precipitates stay behind. */
export function decant(source: VesselState, target: VesselState, volumeL: number): void {
  const available = liquidVolumeL(source);
  if (available <= 1e-9 || volumeL <= 0) return;
  const fraction = Math.min(1, volumeL / available);
  for (let idx = 0; idx < MAX_DEFINED_SPECIES; idx += 1) {
    const dissolved = dissolvedMoles(source, idx);
    if (dissolved <= 0) continue;
    const transferred = dissolved * fraction;
    source.moles[idx] -= transferred;
    target.moles[idx] += transferred;
  }
}

/** Predict steady-state equilibrium temperature (K) for a vessel under given heater wattage. */
export function predictEquilibriumTempK(
  materialKey: VesselMaterialKey,
  heaterWatts: number,
  ambientTempK: number = 288.15,
): number {
  if (heaterWatts <= 0) return ambientTempK;
  const material = MATERIALS[materialKey] ?? MATERIALS.WOOD;
  const conductionWPerK = (material.conductivityWPerMK * WALL_AREA_M2) / WALL_THICKNESS_M;
  const airFilmWPerK = AIR_FILM_W_PER_M2K * WALL_AREA_M2;
  const lossCoefficientWPerK = 1 / (1 / conductionWPerK + 1 / airFilmWPerK);
  return ambientTempK + heaterWatts / lossCoefficientWPerK;
}

/** Skim settled/floating solids (e.g. soap curds) into another vessel. */
export function skim(source: VesselState, target: VesselState, speciesIdx: number): number {
  const amount = source.precipitated[speciesIdx];
  if (amount <= 0) return 0;
  source.precipitated[speciesIdx] = 0;
  source.moles[speciesIdx] = Math.max(0, source.moles[speciesIdx] - amount);
  target.moles[speciesIdx] += amount;
  return amount;
}

export function addHardwoodAsh(vessel: VesselState, grams: number): void {
  addSpecies(
    vessel,
    SPECIES.K2CO3,
    (grams * 0.18) / getSpecies(SPECIES.K2CO3).molarMass,
  );
  addSpecies(vessel, SPECIES.CAO, (grams * 0.32) / getSpecies(SPECIES.CAO).molarMass);
  addSpecies(vessel, SPECIES.SIO2, (grams * 0.5) / getSpecies(SPECIES.SIO2).molarMass);
}
