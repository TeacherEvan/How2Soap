/**
 * Static chemical species registry.
 *
 * Every species owns a fixed integer index (0..255). The simulation stores
 * moles positionally in a Float64Array, so indices are part of the save
 * format: never reorder existing entries, only append.
 */
export type Phase = 'SOLID' | 'LIQUID' | 'GAS' | 'AQUEOUS';

export interface ChemicalSpecies {
  readonly index: number;
  readonly code: string;
  readonly name: string;
  readonly molarMass: number; // g/mol
  readonly specificHeat: number; // J/(g*K)
  readonly standardPhase: Phase;
  readonly boilingPointK: number; // 0 = not applicable / decomposes
  readonly enthalpyVapJPerMol: number;
  readonly solubilityGPer100gH2O: number; // Infinity = miscible
  /** Net strong-ion charge per dissolved formula unit (SID model). */
  readonly ionChargeZ: number;
  /** Species this precipitates into when solubility is exceeded. */
  readonly precipitateSpeciesIdx?: number;
}

export const SPECIES = {
  H2O: 0,
  K2CO3: 1,
  CAO: 2,
  CA_OH2: 3,
  KOH: 4,
  CACO3: 5,
  TRISTEARIN: 6,
  K_STEARATE: 7,
  GLYCEROL: 8,
  NA_STEARATE: 9,
  NACL: 10,
  CO2: 11,
  O2: 12,
  CARBON: 13,
  H2: 14,
  CL2: 15,
  NAOH: 16,
  SIO2: 17,
  KCL: 18,
} as const;

export type SpeciesCode = keyof typeof SPECIES;
export type SpeciesIndex = (typeof SPECIES)[SpeciesCode];

const definitions: ChemicalSpecies[] = [
  {
    index: 0,
    code: 'H2O',
    name: 'Water',
    molarMass: 18.015,
    specificHeat: 4.184,
    standardPhase: 'LIQUID',
    boilingPointK: 373.15,
    enthalpyVapJPerMol: 40650,
    solubilityGPer100gH2O: Infinity,
    ionChargeZ: 0,
  },
  {
    index: 1,
    code: 'K2CO3',
    name: 'Potassium carbonate (potash)',
    molarMass: 138.205,
    specificHeat: 1.21,
    standardPhase: 'AQUEOUS',
    boilingPointK: 0,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: 111,
    ionChargeZ: 0,
  },
  {
    index: 2,
    code: 'CaO',
    name: 'Quicklime',
    molarMass: 56.077,
    specificHeat: 0.75,
    standardPhase: 'SOLID',
    boilingPointK: 3120,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: 0.13,
    ionChargeZ: 0,
  },
  {
    index: 3,
    code: 'Ca(OH)2',
    name: 'Slaked lime',
    molarMass: 74.093,
    specificHeat: 1.2,
    standardPhase: 'AQUEOUS',
    boilingPointK: 0,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: 0.173,
    ionChargeZ: 2,
    precipitateSpeciesIdx: 3,
  },
  {
    index: 4,
    code: 'KOH',
    name: 'Potassium hydroxide (lye)',
    molarMass: 56.106,
    specificHeat: 1.18,
    standardPhase: 'AQUEOUS',
    boilingPointK: 1593,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: Infinity,
    ionChargeZ: 1,
  },
  {
    index: 5,
    code: 'CaCO3',
    name: 'Calcium carbonate (chalk)',
    molarMass: 100.086,
    specificHeat: 0.83,
    standardPhase: 'SOLID',
    boilingPointK: 0,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: 0.0013,
    ionChargeZ: 0,
    precipitateSpeciesIdx: 5,
  },
  {
    index: 6,
    code: 'C57H110O6',
    name: 'Tristearin (rendered fat)',
    molarMass: 891.5,
    specificHeat: 2.0,
    standardPhase: 'SOLID',
    boilingPointK: 813,
    enthalpyVapJPerMol: 100000,
    solubilityGPer100gH2O: 0,
    ionChargeZ: 0,
  },
  {
    index: 7,
    code: 'C18H35KO2',
    name: 'Potassium stearate (soft soap)',
    molarMass: 322.574,
    specificHeat: 1.8,
    standardPhase: 'AQUEOUS',
    boilingPointK: 0,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: 120,
    ionChargeZ: 0,
  },
  {
    index: 8,
    code: 'C3H8O3',
    name: 'Glycerol',
    molarMass: 92.094,
    specificHeat: 2.43,
    standardPhase: 'LIQUID',
    boilingPointK: 563,
    enthalpyVapJPerMol: 61000,
    solubilityGPer100gH2O: Infinity,
    ionChargeZ: 0,
  },
  {
    index: 9,
    code: 'C18H35NaO2',
    name: 'Sodium stearate (hard soap)',
    molarMass: 306.459,
    specificHeat: 1.8,
    standardPhase: 'SOLID',
    boilingPointK: 0,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: 0.1,
    ionChargeZ: 0,
    precipitateSpeciesIdx: 9,
  },
  {
    index: 10,
    code: 'NaCl',
    name: 'Halite (salt)',
    molarMass: 58.44,
    specificHeat: 0.864,
    standardPhase: 'SOLID',
    boilingPointK: 1738,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: 35.9,
    ionChargeZ: 0,
  },
  {
    index: 11,
    code: 'CO2',
    name: 'Carbon dioxide',
    molarMass: 44.009,
    specificHeat: 0.844,
    standardPhase: 'GAS',
    boilingPointK: 194.7,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: 0.17,
    ionChargeZ: 0,
  },
  {
    index: 12,
    code: 'O2',
    name: 'Oxygen',
    molarMass: 31.998,
    specificHeat: 0.918,
    standardPhase: 'GAS',
    boilingPointK: 90.2,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: 0.0044,
    ionChargeZ: 0,
  },
  {
    index: 13,
    code: 'C',
    name: 'Charcoal carbon',
    molarMass: 12.011,
    specificHeat: 0.71,
    standardPhase: 'SOLID',
    boilingPointK: 3915,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: 0,
    ionChargeZ: 0,
  },
  {
    index: 14,
    code: 'H2',
    name: 'Hydrogen',
    molarMass: 2.016,
    specificHeat: 14.3,
    standardPhase: 'GAS',
    boilingPointK: 20.3,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: 0.00016,
    ionChargeZ: 0,
  },
  {
    index: 15,
    code: 'Cl2',
    name: 'Chlorine',
    molarMass: 70.906,
    specificHeat: 0.479,
    standardPhase: 'GAS',
    boilingPointK: 239.1,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: 0.8,
    ionChargeZ: 0,
  },
  {
    index: 16,
    code: 'NaOH',
    name: 'Sodium hydroxide (caustic soda)',
    molarMass: 39.997,
    specificHeat: 1.41,
    standardPhase: 'AQUEOUS',
    boilingPointK: 1663,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: 109,
    ionChargeZ: 1,
  },
  {
    index: 17,
    code: 'SiO2',
    name: 'Silica (inert ash)',
    molarMass: 60.084,
    specificHeat: 0.74,
    standardPhase: 'SOLID',
    boilingPointK: 3220,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: 0,
    ionChargeZ: 0,
  },
  {
    index: 18,
    code: 'KCl',
    name: 'Potassium chloride',
    molarMass: 74.551,
    specificHeat: 0.69,
    standardPhase: 'AQUEOUS',
    boilingPointK: 1690,
    enthalpyVapJPerMol: 0,
    solubilityGPer100gH2O: 34.2,
    ionChargeZ: 0,
  },
];

export const MAX_DEFINED_SPECIES = definitions.length;

const byIndex = new Map<number, ChemicalSpecies>();
const byCode = new Map<string, ChemicalSpecies>();
for (const species of definitions) {
  byIndex.set(species.index, species);
  byCode.set(species.code, species);
}

export function getSpecies(index: number): ChemicalSpecies {
  const species = byIndex.get(index);
  if (!species) throw new Error(`Unknown chemical species index: ${index}`);
  return species;
}

export function getSpeciesByCode(code: string): ChemicalSpecies {
  const species = byCode.get(code);
  if (!species) throw new Error(`Unknown chemical species code: ${code}`);
  return species;
}

export function speciesIndex(code: SpeciesCode): SpeciesIndex {
  return SPECIES[code];
}

export const SPECIES_BY_INDEX: ReadonlyMap<number, ChemicalSpecies> = byIndex;
