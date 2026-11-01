/**
 * Mechanical Fabrication Engine & Tool System
 *
 * Implements Section 5 of the Master Technical Specification:
 * - 6 Dedicated Tool Slots:
 *   1. CUTTING_SKINNING (Flint Flake Blade, Bronze Knife)
 *   2. CHOPPING_CARVING (Flint Adze, Stone Axe)
 *   3. PERCUSSION_MINING (River Hammerstone, Antler Pick)
 *   4. THERMAL_HANDLING (Wooden Tongs, Ceramic Crucible Tongs)
 *   5. STITCHING_MEDICAL (Bone Awl, Bronze Needle)
 *   6. EATING_UTENSIL (Wooden Spoon, Bronze Fork)
 *
 * - Step-by-Step Leather Backpack Unlock Pipeline:
 *   1. Knap Flint Nodule + River Hammerstone -> Flint Flake Blade + Flint Adze Head.
 *   2. Lash Adze to Branch -> Carve Softwood Log into 5L Wooden Bucket or 10L Trough.
 *   3. Hunt & Skin Medium Animal -> Raw Medium Hide (4kg) + Adipose Fat + Deer Sinew.
 *   4. Alkaline Dehairing: Soak raw hide in ash water (pH 11.2) for 12 ticks -> Dehaired Hide.
 *   5. Vegetable Tanning: Steep White Oak Bark in water (0.08 M Tannic Acid, pH 4.2) for 48 ticks -> Vegetable Tanned Leather.
 *   6. Carve Bone Awl + Stitch Vegetable Tanned Leather with Sinew -> Leather Backpack (24 slots, 40 kg cap).
 */

export type ToolSlotKey =
  | 'CUTTING_SKINNING'
  | 'CHOPPING_CARVING'
  | 'PERCUSSION_MINING'
  | 'THERMAL_HANDLING'
  | 'STITCHING_MEDICAL'
  | 'EATING_UTENSIL';

export interface ToolItem {
  readonly id: string;
  readonly name: string;
  readonly slot: ToolSlotKey;
  readonly mohs: number;
  readonly mechanicalAdvantage: number;
  durability: number;     // 0 .. 100 %
  maxDurability: number;
}

export interface FabricationRecipe {
  readonly id: string;
  readonly name: string;
  readonly inputs: ReadonlyArray<{ itemId: string; count: number; label: string }>;
  readonly outputs: ReadonlyArray<{ itemId: string; count: number; label: string }>;
  readonly requiredToolSlot?: ToolSlotKey;
  readonly energyCostKcal: number;
  readonly workTicks: number;
  readonly description: string;
}

export const FABRICATION_RECIPES: ReadonlyArray<FabricationRecipe> = [
  {
    id: 'RECIPE_KNAP_FLINT',
    name: 'Knap Flint Tools',
    inputs: [
      { itemId: 'FLINT_NODULE', count: 1, label: 'Flint Nodule' },
    ],
    outputs: [
      { itemId: 'FLINT_FLAKE_BLADE', count: 1, label: 'Flint Flake Blade' },
      { itemId: 'FLINT_ADZE_HEAD', count: 1, label: 'Flint Adze Head' },
    ],
    requiredToolSlot: 'PERCUSSION_MINING',
    energyCostKcal: 12.0,
    workTicks: 1,
    description: 'Conchoidal fracture knapping produces scalpel-sharp blades and an adze bit.',
  },
  {
    id: 'RECIPE_CRAFT_FLINT_ADZE',
    name: 'Lash Flint Adze',
    inputs: [
      { itemId: 'FLINT_ADZE_HEAD', count: 1, label: 'Flint Adze Head' },
      { itemId: 'WOOD_BRANCH', count: 1, label: 'Sturdy Branch' },
    ],
    outputs: [
      { itemId: 'FLINT_ADZE', count: 1, label: 'Flint Adze' },
    ],
    energyCostKcal: 8.0,
    workTicks: 1,
    description: 'Lash adze head to branch for efficient wood carving.',
  },
  {
    id: 'RECIPE_CARVE_WOODEN_BUCKET',
    name: 'Carve Wooden Bucket (5 L)',
    inputs: [
      { itemId: 'LOG_SCOTS_PINE', count: 1, label: 'Pine Softwood Log' },
    ],
    outputs: [
      { itemId: 'WOODEN_BUCKET', count: 1, label: 'Wooden Bucket (5 L)' },
      { itemId: 'PINE_SHAVINGS', count: 1, label: 'Pine Shavings (Tinder)' },
    ],
    requiredToolSlot: 'CHOPPING_CARVING',
    energyCostKcal: 38.0,
    workTicks: 1,
    description: 'Hollow out softwood log to create a 5L chemical reaction vessel (T_max = 523 K).',
  },
  {
    id: 'RECIPE_CARVE_WOODEN_TROUGH',
    name: 'Carve Tanning Trough (10 L)',
    inputs: [
      { itemId: 'LOG_SCOTS_PINE', count: 2, label: 'Pine Softwood Logs' },
    ],
    outputs: [
      { itemId: 'WOODEN_TROUGH', count: 1, label: 'Wooden Tanning Trough (10 L)' },
    ],
    requiredToolSlot: 'CHOPPING_CARVING',
    energyCostKcal: 55.0,
    workTicks: 2,
    description: 'Large dugout trough for alkaline dehairing and tannin steeping.',
  },
  {
    id: 'RECIPE_CARVE_BONE_AWL',
    name: 'Carve Bone Awl',
    inputs: [
      { itemId: 'ANIMAL_BONE', count: 1, label: 'Femur Bone' },
    ],
    outputs: [
      { itemId: 'BONE_AWL', count: 1, label: 'Bone Awl' },
    ],
    requiredToolSlot: 'CUTTING_SKINNING',
    energyCostKcal: 15.0,
    workTicks: 1,
    description: 'Sharp bone needle for piercing tough leather.',
  },
  {
    id: 'RECIPE_DEHAIR_HIDE',
    name: 'Alkaline Dehairing Soak',
    inputs: [
      { itemId: 'RAW_MEDIUM_HIDE', count: 1, label: 'Raw Medium Hide' },
      { itemId: 'HARDWOOD_ASH_WATER', count: 1, label: 'Weak Ash Water (pH ~11)' },
    ],
    outputs: [
      { itemId: 'DEHAIRED_HIDE', count: 1, label: 'Dehaired Collagen Hide' },
    ],
    energyCostKcal: 25.0,
    workTicks: 12, // 12 hours soak
    description: 'Loosen hair follicles in alkaline bath without damaging dermal collagen.',
  },
  {
    id: 'RECIPE_TANNIN_STEEP',
    name: 'Vegetable Tannin Leather Tanning',
    inputs: [
      { itemId: 'DEHAIRED_HIDE', count: 1, label: 'Dehaired Collagen Hide' },
      { itemId: 'WHITE_OAK_BARK', count: 2, label: 'White Oak Bark (Tannin)' },
    ],
    outputs: [
      { itemId: 'VEGETABLE_TANNED_LEATHER', count: 1, label: 'Vegetable-Tanned Leather' },
    ],
    energyCostKcal: 30.0,
    workTicks: 48, // 48 hours (2 days)
    description: 'Polyphenol cross-linking turns raw collagen into durable, rot-proof leather.',
  },
  {
    id: 'RECIPE_STITCH_BACKPACK',
    name: 'Stitch Leather Backpack',
    inputs: [
      { itemId: 'VEGETABLE_TANNED_LEATHER', count: 1, label: 'Vegetable-Tanned Leather' },
      { itemId: 'DEER_SINEW', count: 1, label: 'Sinew Cordage' },
    ],
    outputs: [
      { itemId: 'LEATHER_BACKPACK', count: 1, label: 'Leather Backpack (24-Slot)' },
    ],
    requiredToolSlot: 'STITCHING_MEDICAL',
    energyCostKcal: 40.0,
    workTicks: 2,
    description: 'Craft a waterproof 24-slot backpack, unlocking 40kg portable carrying capacity.',
  },
  {
    id: 'CARVE_SOAPSTONE_MOLD',
    name: 'Carve Soapstone Ingot & Utensil Mold',
    inputs: [
      { itemId: 'SOAPSTONE_CHUNK', count: 1, label: 'Soapstone Chunk' },
    ],
    outputs: [
      { itemId: 'SOAPSTONE_MOLD', count: 1, label: 'Soapstone Ingot & Utensil Mold' },
    ],
    requiredToolSlot: 'CUTTING_SKINNING',
    energyCostKcal: 25.0,
    workTicks: 2,
    description: 'Carve refractory talc-schist block using a flint flake blade into durable two-part casting molds.',
  },
  {
    id: 'SMELT_COPPER_INGOT',
    name: 'Smelt Copper Ingot',
    inputs: [
      { itemId: 'MALACHITE_ORE', count: 2, label: 'Malachite Ore (Cu2CO3(OH)2)' },
      { itemId: 'CHARCOAL', count: 1, label: 'Hardwood Charcoal' },
    ],
    outputs: [
      { itemId: 'COPPER_INGOT', count: 1, label: 'Refined Copper Ingot' },
    ],
    requiredToolSlot: 'THERMAL_HANDLING',
    energyCostKcal: 65.0,
    workTicks: 4,
    description: 'Carbothermic reduction of malachite with charcoal in a high-temperature crucible produces molten copper.',
  },
  {
    id: 'SMELT_TIN_INGOT',
    name: 'Smelt Tin Ingot',
    inputs: [
      { itemId: 'CASSITERITE_ORE', count: 2, label: 'Cassiterite Ore (SnO2)' },
      { itemId: 'CHARCOAL', count: 1, label: 'Hardwood Charcoal' },
    ],
    outputs: [
      { itemId: 'TIN_INGOT', count: 1, label: 'Refined Tin Ingot' },
    ],
    requiredToolSlot: 'THERMAL_HANDLING',
    energyCostKcal: 50.0,
    workTicks: 3,
    description: 'Reduce cassiterite tin dioxide with charcoal at high heat to cast metallic tin.',
  },
  {
    id: 'CAST_BRONZE_FORK',
    name: 'Cast Bronze Fork',
    inputs: [
      { itemId: 'COPPER_INGOT', count: 1, label: 'Copper Ingot (88 wt%)' },
      { itemId: 'TIN_INGOT', count: 1, label: 'Tin Ingot (12 wt%)' },
      { itemId: 'SOAPSTONE_MOLD', count: 1, label: 'Soapstone Mold' },
      { itemId: 'TUYERE_PIPE', count: 1, label: 'Tuyere Blast Pipe' },
    ],
    outputs: [
      { itemId: 'BRONZE_FORK', count: 1, label: 'Bronze Fork' },
    ],
    requiredToolSlot: 'THERMAL_HANDLING',
    energyCostKcal: 70.0,
    workTicks: 3,
    description: 'Melt copper (88%) and tin (12%) in mold with forced-draft tuyere blast pipe into a hygienic eating fork.',
  },
  {
    id: 'CAST_BRONZE_SPEARHEAD',
    name: 'Cast Bronze Spear',
    inputs: [
      { itemId: 'COPPER_INGOT', count: 1, label: 'Copper Ingot (88 wt%)' },
      { itemId: 'TIN_INGOT', count: 1, label: 'Tin Ingot (12 wt%)' },
      { itemId: 'SOAPSTONE_MOLD', count: 1, label: 'Soapstone Mold' },
      { itemId: 'WOOD_BRANCH', count: 1, label: 'Sturdy Branch Shaft' },
    ],
    outputs: [
      { itemId: 'BRONZE_SPEAR', count: 1, label: 'Bronze Spear' },
    ],
    requiredToolSlot: 'CUTTING_SKINNING',
    energyCostKcal: 85.0,
    workTicks: 4,
    description: 'Cast bronze spearhead in carved soapstone mold and lash to haft for high-efficiency piercing and skinning.',
  },
  {
    id: 'CAST_BRONZE_AXE',
    name: 'Cast Bronze Axe',
    inputs: [
      { itemId: 'COPPER_INGOT', count: 1, label: 'Copper Ingot (88 wt%)' },
      { itemId: 'TIN_INGOT', count: 1, label: 'Tin Ingot (12 wt%)' },
      { itemId: 'SOAPSTONE_MOLD', count: 1, label: 'Soapstone Mold' },
      { itemId: 'WOOD_BRANCH', count: 1, label: 'Hardwood Handle' },
    ],
    outputs: [
      { itemId: 'BRONZE_AXE', count: 1, label: 'Bronze Axe' },
    ],
    requiredToolSlot: 'CHOPPING_CARVING',
    energyCostKcal: 90.0,
    workTicks: 4,
    description: 'Cast heavy bronze celt/axe head and mount onto wood haft for high mechanical advantage chopping.',
  },
  {
    id: 'FERMENT_GRAIN_MASH',
    name: 'Ferment Grain Mash',
    inputs: [
      { itemId: 'GRAIN_MASH', count: 1, label: 'Maple Sap / Cooked Grain' },
      { itemId: 'WATER_VESSEL', count: 1, label: 'Water' },
    ],
    outputs: [
      { itemId: 'ETHANOL_BROTH', count: 1, label: 'Ethanol Broth' },
    ],
    energyCostKcal: 20.0,
    workTicks: 24,
    description: 'Ferment maple sap / cooked grain into Ethanol broth.',
  },
  {
    id: 'EXTRACT_SALICYLIC_ACID',
    name: 'Extract Salicylic Acid',
    inputs: [
      { itemId: 'WILLOW_BARK', count: 2, label: 'Willow Bark (Salicin)' },
      { itemId: 'WATER_VESSEL', count: 1, label: 'Dilute Acid Solution' },
    ],
    outputs: [
      { itemId: 'SALICYLIC_ACID_TINCTURE', count: 1, label: 'Salicylic Acid Tincture' },
    ],
    requiredToolSlot: 'CUTTING_SKINNING',
    energyCostKcal: 35.0,
    workTicks: 4,
    description: 'Acid hydrolysis of willow bark into Salicylic Acid tincture.',
  },
  {
    id: 'CULTIVATE_PENICILLIN',
    name: 'Cultivate Penicillin',
    inputs: [
      { itemId: 'PENICILLIUM_MOLD_CULTURE', count: 1, label: 'Penicillium Culture' },
      { itemId: 'GRAIN_MASH', count: 1, label: 'Submerged Grain Substrate' },
      { itemId: 'WATER_VESSEL', count: 1, label: 'Buffered Medium (pH 6.8)' },
    ],
    outputs: [
      { itemId: 'PENICILLIN_BROTH', count: 1, label: 'Penicillin Broth' },
    ],
    energyCostKcal: 40.0,
    workTicks: 48,
    description: 'Submerged grain fermentation of Penicillium culture into Penicillin broth (pH 6.8 extraction).',
  },
  {
    id: 'DISTILL_ANTISEPTIC_ETHANOL',
    name: 'Distill Antiseptic Ethanol',
    inputs: [
      { itemId: 'ETHANOL_BROTH', count: 2, label: 'Ethanol Broth' },
    ],
    outputs: [
      { itemId: 'ETHANOL_DISINFECTANT', count: 1, label: '95% Pure Ethanol' },
    ],
    requiredToolSlot: 'THERMAL_HANDLING',
    energyCostKcal: 60.0,
    workTicks: 3,
    description: 'Fractional distillation of ethanol broth (condenser boiling point 351.5 K) -> 95% Pure Ethanol.',
  },
  {
    id: 'CRAFT_SALICYLIC_ACID_TINCTURE',
    name: 'Craft Salicylic Acid Tincture',
    inputs: [
      { itemId: 'SALICYLIC_ACID', count: 1, label: 'Salicylic Acid' },
      { itemId: 'ETHANOL_DISINFECTANT', count: 1, label: 'Ethanol Disinfectant' },
    ],
    outputs: [
      { itemId: 'SALICYLIC_ACID_TINCTURE', count: 1, label: 'Salicylic Acid Tincture' },
    ],
    requiredToolSlot: 'STITCHING_MEDICAL',
    energyCostKcal: 15.0,
    workTicks: 1,
    description: 'Craft medical consumable: Salicylic Acid Tincture antipyretic febrifuge.',
  },
  {
    id: 'CRAFT_PENICILLIN_DOSE',
    name: 'Craft Penicillin Dose',
    inputs: [
      { itemId: 'PENICILLIN_BROTH', count: 1, label: 'Penicillin Broth' },
      { itemId: 'ETHANOL_DISINFECTANT', count: 1, label: 'Ethanol Disinfectant' },
    ],
    outputs: [
      { itemId: 'PENICILLIN_DOSE', count: 1, label: 'Penicillin Dose' },
    ],
    requiredToolSlot: 'STITCHING_MEDICAL',
    energyCostKcal: 30.0,
    workTicks: 2,
    description: 'Craft medical consumable: Penicillin Dose sepsis antibiotic cure.',
  },
  {
    id: 'CRAFT_ETHANOL_DISINFECTANT',
    name: 'Craft Ethanol Disinfectant',
    inputs: [
      { itemId: 'ETHANOL_BROTH', count: 1, label: 'Distilled Ethanol Broth' },
    ],
    outputs: [
      { itemId: 'ETHANOL_DISINFECTANT', count: 1, label: 'Ethanol Disinfectant' },
    ],
    requiredToolSlot: 'THERMAL_HANDLING',
    energyCostKcal: 20.0,
    workTicks: 1,
    description: 'Craft medical consumable: Ethanol Disinfectant topical antiseptic.',
  },
  {
    id: 'SMELT_ZINC_DISCS',
    name: 'Smelt Zinc Discs',
    inputs: [
      { itemId: 'ZINC_METAL', count: 1, label: 'Zinc Metal' },
    ],
    outputs: [
      { itemId: 'ZINC_DISCS', count: 12, label: 'Cast Zinc Discs (12x)' },
    ],
    requiredToolSlot: 'THERMAL_HANDLING',
    energyCostKcal: 45.0,
    workTicks: 2,
    description: 'Cast Zinc discs from Zinc metal using high-temperature mold.',
  },
  {
    id: 'STACK_VOLTAIC_PILE',
    name: 'Stack Voltaic Pile Battery',
    inputs: [
      { itemId: 'COPPER_INGOT', count: 1, label: 'Copper Ingot' },
      { itemId: 'ZINC_METAL', count: 1, label: 'Zinc Metal' },
      { itemId: 'SULFURIC_ACID', count: 1, label: 'Sulfuric Acid' },
      { itemId: 'LEATHER_SCRAP', count: 1, label: 'Leather Scrap' },
    ],
    outputs: [
      { itemId: 'VOLTAIC_PILE_BATTERY', count: 1, label: 'Voltaic Pile Battery (13.2 V DC)' },
    ],
    requiredToolSlot: 'STITCHING_MEDICAL',
    energyCostKcal: 60.0,
    workTicks: 3,
    description: 'Assemble 12x Cu/Zn pairs separated by H2SO4-soaked leather discs. Generates 13.2 V DC (1.10 V/cell).',
  },
  {
    id: 'CRAFT_ELECTROLYSIS_CELL',
    name: 'Craft Electrolysis Cell',
    inputs: [
      { itemId: 'FIRED_CERAMIC_VESSEL', count: 1, label: 'Lead/Ceramic Vessel' },
      { itemId: 'CARBON_ELECTRODES', count: 2, label: 'Carbon Electrodes' },
    ],
    outputs: [
      { itemId: 'ELECTROLYSIS_CELL', count: 1, label: 'Electrolysis Cell Vessel' },
    ],
    requiredToolSlot: 'CHOPPING_CARVING',
    energyCostKcal: 50.0,
    workTicks: 2,
    description: 'Build lead/ceramic electrolysis vessel with carbon electrodes.',
  },
  {
    id: 'FABRICATE_ELEMENTAL_SODIUM',
    name: 'Fabricate Elemental Sodium Metal',
    inputs: [
      { itemId: 'MOLTEN_NAOH', count: 1, label: 'Molten NaOH' },
      { itemId: 'VOLTAIC_PILE_BATTERY', count: 1, label: 'Voltaic Pile Battery' },
      { itemId: 'ELECTROLYSIS_CELL', count: 1, label: 'Electrolysis Cell' },
    ],
    outputs: [
      { itemId: 'SODIUM_METAL', count: 1, label: 'Pure Sodium Metal (Na)' },
    ],
    requiredToolSlot: 'THERMAL_HANDLING',
    energyCostKcal: 70.0,
    workTicks: 4,
    description: 'Run Faraday molten electrolysis on NaOH -> Pure Sodium Metal (Na).',
  },
  {
    id: 'FABRICATE_ELEMENTAL_POTASSIUM',
    name: 'Fabricate Elemental Potassium Metal',
    inputs: [
      { itemId: 'MOLTEN_KOH', count: 1, label: 'Molten KOH' },
      { itemId: 'VOLTAIC_PILE_BATTERY', count: 1, label: 'Voltaic Pile Battery' },
      { itemId: 'ELECTROLYSIS_CELL', count: 1, label: 'Electrolysis Cell' },
    ],
    outputs: [
      { itemId: 'POTASSIUM_METAL', count: 1, label: 'Pure Potassium Metal (K)' },
    ],
    requiredToolSlot: 'THERMAL_HANDLING',
    energyCostKcal: 75.0,
    workTicks: 4,
    description: 'Run Faraday molten electrolysis on KOH -> Pure Potassium Metal (K).',
  },
];

export interface MedicalConsumableItem {
  readonly id: string;
  readonly name: string;
  readonly category: 'ANTIPYRETIC' | 'ANTIBIOTIC' | 'ANTISEPTIC';
  readonly description: string;
  readonly massKg: number;
}

export const MEDICAL_CONSUMABLES: Record<'SALICYLIC_ACID_TINCTURE' | 'PENICILLIN_DOSE' | 'ETHANOL_DISINFECTANT', MedicalConsumableItem> = {
  SALICYLIC_ACID_TINCTURE: {
    id: 'SALICYLIC_ACID_TINCTURE',
    name: 'Salicylic Acid Tincture',
    category: 'ANTIPYRETIC',
    description: 'Antipyretic febrifuge. Reduces fever / hyperthermia by -1.8 °C.',
    massKg: 0.1,
  },
  PENICILLIN_DOSE: {
    id: 'PENICILLIN_DOSE',
    name: 'Penicillin Dose',
    category: 'ANTIBIOTIC',
    description: 'Sepsis antibiotic cure. Cures systemic bacterial infection.',
    massKg: 0.05,
  },
  ETHANOL_DISINFECTANT: {
    id: 'ETHANOL_DISINFECTANT',
    name: 'Ethanol Disinfectant',
    category: 'ANTISEPTIC',
    description: 'Topical antiseptic. Eliminates wound contamination.',
    massKg: 0.25,
  },
};

export const INITIAL_PRIMITIVE_TOOLS: Record<ToolSlotKey, ToolItem | null> = {
  CUTTING_SKINNING: null,
  CHOPPING_CARVING: null,
  PERCUSSION_MINING: {
    id: 'RIVER_HAMMERSTONE',
    name: 'River Hammerstone',
    slot: 'PERCUSSION_MINING',
    mohs: 6.5,
    mechanicalAdvantage: 1.5,
    durability: 100,
    maxDurability: 100,
  },
  THERMAL_HANDLING: null,
  STITCHING_MEDICAL: null,
  EATING_UTENSIL: null,
};

/**
 * Predefined Bronze & Tier 3 Tools definitions
 */
export const METALLURGY_TOOLS: Record<'BRONZE_FORK' | 'BRONZE_SPEAR' | 'BRONZE_AXE', ToolItem> = {
  BRONZE_FORK: {
    id: 'BRONZE_FORK',
    name: 'Bronze Fork',
    slot: 'EATING_UTENSIL',
    mohs: 3.5,
    mechanicalAdvantage: 1.0,
    durability: 100,
    maxDurability: 100,
  },
  BRONZE_SPEAR: {
    id: 'BRONZE_SPEAR',
    name: 'Bronze Spear',
    slot: 'CUTTING_SKINNING',
    mohs: 3.5,
    mechanicalAdvantage: 2.2,
    durability: 100,
    maxDurability: 100,
  },
  BRONZE_AXE: {
    id: 'BRONZE_AXE',
    name: 'Bronze Axe',
    slot: 'CHOPPING_CARVING',
    mohs: 3.5,
    mechanicalAdvantage: 2.5,
    durability: 100,
    maxDurability: 100,
  },
};

export interface EatingUtensilBonus {
  netCaloricBonusPct: number;    // e.g. 0.15 (+15%)
  pathogenRiskEliminated: boolean;
}

/**
 * Check eating utensil tool slot bonus.
 * When an item is equipped in EATING_UTENSIL (like BRONZE_FORK),
 * it provides +15% net caloric digestion efficiency and eliminates pathogen risk.
 */
export function getEatingUtensilBonus(tool: ToolItem | null): EatingUtensilBonus {
  if (!tool || tool.slot !== 'EATING_UTENSIL') {
    return {
      netCaloricBonusPct: 0,
      pathogenRiskEliminated: false,
    };
  }
  return {
    netCaloricBonusPct: 0.15,
    pathogenRiskEliminated: true,
  };
}

