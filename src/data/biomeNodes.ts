/**
 * Hierarchical Biome DAG Resource Registry
 *
 * Implements Section 4.2 of the Master Technical Specification:
 * - 4 Top-Level Categories: TREES, ROCKS_MINERALS, MUSHROOMS_FLORA, ANIMALS
 * - 3-Level Collapsible DAG: Category -> Species/Deposit -> Harvestable Part
 * - Mohs Hardness, Fracture Energy W_fracture, Moisture %, Chemical Outputs
 * - Radial Foraging Transport Cost:
 *   E_haul(d) = ((m_player + m_carried) * g * c_terrain * 2d) / (eta_human * 4184)
 */

export type BiomeCategoryKey = 'TREES' | 'ROCKS_MINERALS' | 'MUSHROOMS_FLORA' | 'ANIMALS';

export interface HarvestYieldItem {
  readonly itemId: string;
  readonly name: string;
  readonly massKg: number;
  readonly speciesIdx?: number;       // Chemistry species registry index if applicable
  readonly chemicalFormula?: string;
  readonly molesYield?: number;
}

export interface HarvestablePart {
  readonly id: string;
  readonly name: string;
  readonly baseWorkJoules: number;    // W_fracture
  readonly requiredToolSlot: string;  // e.g. CHOPPING_CARVING, PERCUSSION_MINING, CUTTING_SKINNING
  readonly minMohs: number;
  readonly targetMohs: number;
  readonly moisturePct: number;
  readonly harvestTimeTicks: number;  // 1 tick = 1 hr
  readonly yields: ReadonlyArray<HarvestYieldItem>;
  readonly description: string;
}

export interface BiomeSpeciesNode {
  readonly id: string;
  readonly name: string;
  readonly scientificName?: string;
  readonly subtype: string;
  readonly baseDistanceMeters: number; // d0 nominal distance
  readonly parts: ReadonlyArray<HarvestablePart>;
}

export interface BiomeCategoryNode {
  readonly key: BiomeCategoryKey;
  readonly title: string;
  readonly icon: string;
  readonly species: ReadonlyArray<BiomeSpeciesNode>;
}

export const BIOME_DAG: ReadonlyArray<BiomeCategoryNode> = [
  {
    key: 'TREES',
    title: 'Trees & Woodlands',
    icon: '🌲',
    species: [
      {
        id: 'TREE_WHITE_OAK',
        name: 'White Oak',
        scientificName: 'Quercus alba',
        subtype: 'Hardwood',
        baseDistanceMeters: 50,
        parts: [
          {
            id: 'OAK_HEARTWOOD_LOG',
            name: 'Heartwood Log (5 kg)',
            baseWorkJoules: 180000, // 180 kJ
            requiredToolSlot: 'CHOPPING_CARVING',
            minMohs: 5.0,
            targetMohs: 3.5,
            moisturePct: 45,
            harvestTimeTicks: 1,
            yields: [
              { itemId: 'LOG_WHITE_OAK', name: 'White Oak Log', massKg: 5.0, chemicalFormula: 'Cellulose/Lignin' },
            ],
            description: 'Seasoning and pyrolysis yields hardwood ash (18% K2CO3, 32% CaO).',
          },
          {
            id: 'OAK_OUTER_BARK',
            name: 'Oak Bark (2 kg)',
            baseWorkJoules: 35000,
            requiredToolSlot: 'CUTTING_SKINNING',
            minMohs: 3.0,
            targetMohs: 2.0,
            moisturePct: 20,
            harvestTimeTicks: 1,
            yields: [
              { itemId: 'WHITE_OAK_BARK', name: 'White Oak Bark', massKg: 2.0, chemicalFormula: 'C76H52O46 (Tannin)' },
            ],
            description: 'Contains 14% Tannic Acid for vegetable leather tanning.',
          },
        ],
      },
      {
        id: 'TREE_SCOTS_PINE',
        name: 'Scots Pine',
        scientificName: 'Pinus sylvestris',
        subtype: 'Softwood',
        baseDistanceMeters: 40,
        parts: [
          {
            id: 'PINE_TRUNK',
            name: 'Softwood Trunk (4 kg)',
            baseWorkJoules: 95000,
            requiredToolSlot: 'CHOPPING_CARVING',
            minMohs: 4.0,
            targetMohs: 1.8,
            moisturePct: 35,
            harvestTimeTicks: 1,
            yields: [
              { itemId: 'LOG_SCOTS_PINE', name: 'Pine Softwood Log', massKg: 4.0 },
            ],
            description: 'Low density softwood, easily carved into wooden buckets or tanning troughs.',
          },
          {
            id: 'PINE_DEADFALL',
            name: 'Pine Deadfall & Resin',
            baseWorkJoules: 25000,
            requiredToolSlot: 'BARE_HANDS',
            minMohs: 1.0,
            targetMohs: 1.5,
            moisturePct: 15,
            harvestTimeTicks: 1,
            yields: [
              { itemId: 'PINE_DEADFALL_WOOD', name: 'Dry Pine Kindling', massKg: 2.0 },
              { itemId: 'OLEORESIN', name: 'Pine Oleoresin', massKg: 0.2 },
            ],
            description: 'Readily burnable kindling and adhesive resin.',
          },
        ],
      },
      {
        id: 'TREE_WHITE_WILLOW',
        name: 'White Willow',
        scientificName: 'Salix alba',
        subtype: 'Soft Hardwood',
        baseDistanceMeters: 75,
        parts: [
          {
            id: 'WILLOW_PHLOEM_BARK',
            name: 'Inner Phloem Bark',
            baseWorkJoules: 40000,
            requiredToolSlot: 'CUTTING_SKINNING',
            minMohs: 3.0,
            targetMohs: 2.0,
            moisturePct: 30,
            harvestTimeTicks: 1,
            yields: [
              { itemId: 'WILLOW_BARK', name: 'Willow Bark', massKg: 1.0, chemicalFormula: 'C13H18O7 (Salicin)' },
            ],
            description: 'Contains Salicin; precursor to Salicylic Acid antipyretic medicine.',
          },
        ],
      },
    ],
  },
  {
    key: 'ROCKS_MINERALS',
    title: 'Rocks & Outcrops',
    icon: '⛏️',
    species: [
      {
        id: 'ROCK_CHERT_FLINT',
        name: 'Chert & Flint Nodules',
        subtype: 'Silicates',
        baseDistanceMeters: 60,
        parts: [
          {
            id: 'FLINT_NODULE_HARVEST',
            name: 'Flint Nodule',
            baseWorkJoules: 67000, // ~16 kcal
            requiredToolSlot: 'PERCUSSION_MINING',
            minMohs: 6.0,
            targetMohs: 7.0,
            moisturePct: 0,
            harvestTimeTicks: 1,
            yields: [
              { itemId: 'FLINT_NODULE', name: 'Flint Nodule', massKg: 1.5, chemicalFormula: 'SiO2' },
            ],
            description: 'Cryptocrystalline silica, knaps into scalpel-sharp blades and adzes.',
          },
        ],
      },
      {
        id: 'ROCK_KAOLIN_CLAY',
        name: 'Kaolinite Clay Bed',
        subtype: 'Silicates',
        baseDistanceMeters: 90,
        parts: [
          {
            id: 'KAOLIN_CLAY_HARVEST',
            name: 'Raw Kaolin Clay (5 kg)',
            baseWorkJoules: 92000, // ~22 kcal
            requiredToolSlot: 'BARE_HANDS',
            minMohs: 1.0,
            targetMohs: 2.0,
            moisturePct: 25,
            harvestTimeTicks: 1,
            yields: [
              { itemId: 'RAW_KAOLIN_CLAY', name: 'Raw Kaolin Clay', massKg: 5.0, chemicalFormula: 'Al2Si2O5(OH)4' },
            ],
            description: 'Fires at 1373 K into ceramic pots and crucibles.',
          },
        ],
      },
      {
        id: 'ROCK_LIMESTONE',
        name: 'Limestone Outcrop',
        subtype: 'Carbonates',
        baseDistanceMeters: 120,
        parts: [
          {
            id: 'LIMESTONE_CHUNKS',
            name: 'Limestone Chunks (3 kg)',
            baseWorkJoules: 125000, // ~30 kcal
            requiredToolSlot: 'PERCUSSION_MINING',
            minMohs: 4.5,
            targetMohs: 3.0,
            moisturePct: 1,
            harvestTimeTicks: 1,
            yields: [
              { itemId: 'LIMESTONE_ROCK', name: 'Limestone Rock', massKg: 3.0, chemicalFormula: 'CaCO3' },
            ],
            description: 'Thermal calcination above 1100 K yields Quicklime (CaO).',
          },
        ],
      },
      {
        id: 'ROCK_HALITE',
        name: 'Halite & Natron Beds',
        subtype: 'Evaporites',
        baseDistanceMeters: 150,
        parts: [
          {
            id: 'HALITE_SALT_HARVEST',
            name: 'Halite Mineral Salt',
            baseWorkJoules: 100000, // ~24 kcal
            requiredToolSlot: 'PERCUSSION_MINING',
            minMohs: 3.0,
            targetMohs: 2.5,
            moisturePct: 0,
            harvestTimeTicks: 1,
            yields: [
              { itemId: 'HALITE_SALT', name: 'Mined Halite Salt', massKg: 1.0, chemicalFormula: 'NaCl' },
            ],
            description: 'Essential for salting out hard bar soap (Sodium Stearate).',
          },
        ],
      },
      {
        id: 'ROCK_MALACHITE',
        name: 'Malachite Outcrop',
        subtype: 'Carbonates',
        baseDistanceMeters: 180,
        parts: [
          {
            id: 'MALACHITE_ORE_HARVEST',
            name: 'Malachite Ore (2 kg)',
            baseWorkJoules: 110000,
            requiredToolSlot: 'PERCUSSION_MINING',
            minMohs: 4.5,
            targetMohs: 3.5,
            moisturePct: 0,
            harvestTimeTicks: 1,
            yields: [
              { itemId: 'MALACHITE_ORE', name: 'Malachite Ore', massKg: 2.0, speciesIdx: 19, chemicalFormula: 'Cu2CO3(OH)2' },
            ],
            description: 'Basic copper carbonate ore. Smelts with carbon/charcoal in high-temperature forge into metallic copper.',
          },
        ],
      },
      {
        id: 'ROCK_CASSITERITE',
        name: 'Cassiterite Vein',
        subtype: 'Oxides',
        baseDistanceMeters: 220,
        parts: [
          {
            id: 'CASSITERITE_ORE_HARVEST',
            name: 'Cassiterite Ore (2 kg)',
            baseWorkJoules: 140000,
            requiredToolSlot: 'PERCUSSION_MINING',
            minMohs: 6.5,
            targetMohs: 6.0,
            moisturePct: 0,
            harvestTimeTicks: 1,
            yields: [
              { itemId: 'CASSITERITE_ORE', name: 'Cassiterite Ore', massKg: 2.0, speciesIdx: 20, chemicalFormula: 'SnO2' },
            ],
            description: 'Tin dioxide ore. Reduced with charcoal at 1200 K to yield metallic tin for bronze alloying.',
          },
        ],
      },
      {
        id: 'ROCK_SOAPSTONE',
        name: 'Soapstone Deposit',
        subtype: 'Silicates',
        baseDistanceMeters: 140,
        parts: [
          {
            id: 'SOAPSTONE_BLOCK_HARVEST',
            name: 'Soapstone Block (3 kg)',
            baseWorkJoules: 50000,
            requiredToolSlot: 'PERCUSSION_MINING',
            minMohs: 2.0,
            targetMohs: 1.5,
            moisturePct: 0,
            harvestTimeTicks: 1,
            yields: [
              { itemId: 'SOAPSTONE_BLOCK', name: 'Soapstone Block', massKg: 3.0, chemicalFormula: 'Mg3Si4O10(OH)2' },
            ],
            description: 'Soft talc-schist rock (Mohs 1.5), easily carved into refractory casting molds and crucibles.',
          },
        ],
      },
    ],
  },
  {
    key: 'MUSHROOMS_FLORA',
    title: 'Mushrooms & Flora',
    icon: '🍄',
    species: [
      {
        id: 'FLORA_FIELD_MUSHROOM',
        name: 'Field Mushroom',
        scientificName: 'Agaricus bisporus',
        subtype: 'Fungi',
        baseDistanceMeters: 30,
        parts: [
          {
            id: 'MUSHROOM_CAPS',
            name: 'Fresh Mushroom Caps',
            baseWorkJoules: 8000,
            requiredToolSlot: 'BARE_HANDS',
            minMohs: 1.0,
            targetMohs: 1.0,
            moisturePct: 90,
            harvestTimeTicks: 1,
            yields: [
              { itemId: 'FIELD_MUSHROOM', name: 'Edible Mushroom', massKg: 0.5 },
            ],
            description: 'Safe edible fungus: 22 kcal/100g raw, 38 kcal/100g cooked.',
          },
        ],
      },
    ],
  },
  {
    key: 'ANIMALS',
    title: 'Animals & Fauna',
    icon: '🦌',
    species: [
      {
        id: 'ANIMAL_WILD_BOAR',
        name: 'Wild Boar',
        scientificName: 'Sus scrofa',
        subtype: 'Medium Animal',
        baseDistanceMeters: 180,
        parts: [
          {
            id: 'BOAR_HUNT',
            name: 'Hunt Wild Boar (Lethal)',
            baseWorkJoules: 670000, // ~160 kcal
            requiredToolSlot: 'CUTTING_SKINNING',
            minMohs: 4.0,
            targetMohs: 3.0,
            moisturePct: 60,
            harvestTimeTicks: 2,
            yields: [
              { itemId: 'RAW_MEDIUM_HIDE', name: 'Medium Raw Hide', massKg: 4.0 },
              { itemId: 'RAW_ADIPOSE_FAT', name: 'Raw Adipose Fat', massKg: 2.5 },
              { itemId: 'MEAT_RAW', name: 'Fresh Game Meat', massKg: 14.0 },
              { itemId: 'DEER_SINEW', name: 'Animal Sinew Cordage', massKg: 0.3 },
              { itemId: 'ANIMAL_BONE', name: 'Heavy Femur Bone', massKg: 1.5 },
            ],
            description: 'Yields collagen hide for leather backpack and fat for soap making.',
          },
        ],
      },
    ],
  },
];

/**
 * Calculates radial foraging transport energy cost in kcal.
 * Formula from Section 4.1:
 * E_haul(d) = ((m_player + m_carried) * g * c_terrain * 2d) / (eta_human * 4184)
 */
export function calculateRadialHaulCostKcal(
  distanceMeters: number,
  carriedMassKg: number,
  playerMassKg = 70.0,
  terrainFactor = 1.2, // c_terrain
): number {
  const g = 9.80665;
  const etaHuman = 0.22;
  const joulesPerKcal = 4184.0;
  const totalMass = playerMassKg + carriedMassKg;
  const roundTripMeters = 2 * distanceMeters;
  const workJoules = totalMass * g * terrainFactor * roundTripMeters;
  return workJoules / (etaHuman * joulesPerKcal);
}

/**
 * Calculates total harvest energy cost in kcal, taking into account
 * tool mechanical advantage and Mohs hardness ratio.
 * Formula: E_harvest = (W_fracture / MA_tool) * (Mohs_target / Mohs_tool)^2 + E_haul(d)
 */
export function calculateHarvestTotalCostKcal(
  baseWorkJoules: number,
  toolMohs: number,
  targetMohs: number,
  toolMechanicalAdvantage: number,
  distanceMeters: number,
  carriedMassKg: number,
): number {
  const effectiveMohs = Math.max(1.0, toolMohs);
  const mohsRatio = targetMohs / effectiveMohs;
  const scaling = Math.pow(mohsRatio, 2);
  const fractureWorkJoules = (baseWorkJoules / Math.max(1.0, toolMechanicalAdvantage)) * scaling;
  const fractureKcal = fractureWorkJoules / (0.22 * 4184.0);
  const haulKcal = calculateRadialHaulCostKcal(distanceMeters, carriedMassKg);
  return fractureKcal + haulKcal;
}
