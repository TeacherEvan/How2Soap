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
];

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
