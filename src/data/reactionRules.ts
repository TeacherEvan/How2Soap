import { SPECIES } from './speciesRegistry';

export interface ReactionStoich {
  readonly speciesIdx: number;
  readonly stoich: number;
}

export interface ReactionRule {
  readonly id: string;
  readonly label: string;
  readonly reactants: ReadonlyArray<ReactionStoich>;
  readonly products: ReadonlyArray<ReactionStoich>;
  readonly activationEnergyJ: number; // Ea (J/mol)
  readonly preExponentialA: number; // frequency factor (1/s)
  readonly enthalpyJPerMol: number; // dH: negative exothermic
  readonly minpH?: number;
  readonly maxpH?: number;
  /** Below this temperature the reaction is kinetically frozen. */
  readonly minTempK?: number;
}

export interface ElectrolysisRule {
  readonly id: string;
  readonly label: string;
  readonly electrolyteSpeciesIdx: number;
  readonly electrolyteStoich: number;
  readonly anodeProductIdx: number;
  readonly anodeStoich: number;
  readonly cathodeProductIdx: number;
  readonly cathodeStoich: number;
  readonly coProducts?: ReadonlyArray<ReactionStoich>;
  readonly minDecompositionVolts: number; // E_rev + overpotential
  readonly electronsZ: number;
}

export const REACTIONS: ReadonlyArray<ReactionRule> = [
  {
    id: 'cao_hydration',
    label: 'CaO + H2O -> Ca(OH)2',
    reactants: [
      { speciesIdx: SPECIES.CAO, stoich: 1 },
      { speciesIdx: SPECIES.H2O, stoich: 1 },
    ],
    products: [{ speciesIdx: SPECIES.CA_OH2, stoich: 1 }],
    activationEnergyJ: 15000,
    preExponentialA: 1.0e8,
    enthalpyJPerMol: -63700,
    minTempK: 273,
  },
  {
    id: 'causticization',
    label: 'K2CO3 + Ca(OH)2 -> 2 KOH + CaCO3',
    reactants: [
      { speciesIdx: SPECIES.K2CO3, stoich: 1 },
      { speciesIdx: SPECIES.CA_OH2, stoich: 1 },
    ],
    products: [
      { speciesIdx: SPECIES.KOH, stoich: 2 },
      { speciesIdx: SPECIES.CACO3, stoich: 1 },
    ],
    activationEnergyJ: 45000,
    preExponentialA: 5.0e5,
    enthalpyJPerMol: -17000,
    minTempK: 273,
  },
  {
    id: 'saponification',
    label: 'C57H110O6 + 3 KOH -> 3 C18H35KO2 + C3H8O3',
    reactants: [
      { speciesIdx: SPECIES.TRISTEARIN, stoich: 1 },
      { speciesIdx: SPECIES.KOH, stoich: 3 },
    ],
    products: [
      { speciesIdx: SPECIES.K_STEARATE, stoich: 3 },
      { speciesIdx: SPECIES.GLYCEROL, stoich: 1 },
    ],
    activationEnergyJ: 58200,
    preExponentialA: 1.4e6,
    enthalpyJPerMol: -100000,
    minTempK: 318, // fat must be molten / warm for practical saponification
  },
  {
    id: 'salting_out',
    label: 'C18H35KO2 + NaCl -> C18H35NaO2 + KCl',
    reactants: [
      { speciesIdx: SPECIES.K_STEARATE, stoich: 1 },
      { speciesIdx: SPECIES.NACL, stoich: 1 },
    ],
    products: [
      { speciesIdx: SPECIES.NA_STEARATE, stoich: 1 },
      { speciesIdx: SPECIES.KCL, stoich: 1 },
    ],
    activationEnergyJ: 30000,
    preExponentialA: 1.0e5,
    enthalpyJPerMol: -8000,
    minTempK: 300,
  },
  {
    id: 'malachite_reduction',
    label: 'Cu2CO3(OH)2 + C -> 2 Cu + 2 CO2 + H2O',
    reactants: [
      { speciesIdx: SPECIES.MALACHITE, stoich: 1 },
      { speciesIdx: SPECIES.CARBON, stoich: 1 },
    ],
    products: [
      { speciesIdx: SPECIES.COPPER, stoich: 2 },
      { speciesIdx: SPECIES.CO2, stoich: 2 },
      { speciesIdx: SPECIES.H2O, stoich: 1 },
    ],
    activationEnergyJ: 120000,
    preExponentialA: 2.0e7,
    enthalpyJPerMol: 180000,
    minTempK: 1200,
  },
  {
    id: 'cassiterite_reduction',
    label: 'SnO2 + C -> Sn + CO2',
    reactants: [
      { speciesIdx: SPECIES.CASSITERITE, stoich: 1 },
      { speciesIdx: SPECIES.CARBON, stoich: 1 },
    ],
    products: [
      { speciesIdx: SPECIES.TIN, stoich: 1 },
      { speciesIdx: SPECIES.CO2, stoich: 1 },
    ],
    activationEnergyJ: 140000,
    preExponentialA: 1.5e7,
    enthalpyJPerMol: 190000,
    minTempK: 1200,
  },
  {
    id: 'bronze_alloying',
    label: '22 Cu + 3 Sn -> 25 Bronze',
    reactants: [
      { speciesIdx: SPECIES.COPPER, stoich: 22 },
      { speciesIdx: SPECIES.TIN, stoich: 3 },
    ],
    products: [{ speciesIdx: SPECIES.BRONZE, stoich: 25 }],
    activationEnergyJ: 50000,
    preExponentialA: 1.0e6,
    enthalpyJPerMol: -10000,
    minTempK: 1250,
  },
];

export const ELECTROLYSIS_RULES: ReadonlyArray<ElectrolysisRule> = [
  {
    id: 'brine_electrolysis',
    label: '2 NaCl + 2 H2O -> Cl2 + H2 + 2 NaOH',
    electrolyteSpeciesIdx: SPECIES.NACL,
    electrolyteStoich: 2,
    anodeProductIdx: SPECIES.CL2,
    anodeStoich: 1,
    cathodeProductIdx: SPECIES.H2,
    cathodeStoich: 1,
    coProducts: [
      { speciesIdx: SPECIES.NAOH, stoich: 2 },
      { speciesIdx: SPECIES.H2O, stoich: -2 },
    ],
    minDecompositionVolts: 2.19,
    electronsZ: 2,
  },
  {
    id: 'water_electrolysis',
    label: '2 H2O -> O2 + 2 H2',
    electrolyteSpeciesIdx: SPECIES.H2O,
    electrolyteStoich: 2,
    anodeProductIdx: SPECIES.O2,
    anodeStoich: 1,
    cathodeProductIdx: SPECIES.H2,
    cathodeStoich: 2,
    minDecompositionVolts: 1.73,
    electronsZ: 2,
  },
];

/** Hardwood ash composition by mass fraction (seasoned oak, 1050 K). */
export const HARDWOOD_ASH = {
  k2co3MassFraction: 0.18,
  caoMassFraction: 0.32,
  sio2MassFraction: 0.5,
} as const;

export const MOLAR_MASS = {
  K2CO3: 138.205,
  CAO: 56.077,
  SIO2: 60.084,
} as const;
