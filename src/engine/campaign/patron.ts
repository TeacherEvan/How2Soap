/**
 * The Patron & First Commission System
 *
 * Implements §6.22 of the Civ VII 4X Conversion Plan (v8):
 * - Cold open in mud-port: heap of scrap (2 sticks, 1 loose stone, sinew, cauldron dregs, ash).
 * - First craft silently assigns the patron based on the chosen artifact.
 * - Commission & Requisition order loop with patron trust (Tiers 0..4).
 */

export type PatronId =
  | 'odric_vane'      // Spear -> Soldier seeking a maker
  | 'madame_serafine'  // Perfume / Soap -> Wealthy merchant's steward
  | 'sister_aurel'     // Tincture -> Healer with herbs
  | 'forge_clans'      // Charcoal / Bronze -> Smiths paying in metal
  | 'hedge_witch';     // Wander off / Nothing -> Self-sufficient hermit

export interface PatronDefinition {
  readonly id: PatronId;
  readonly name: string;
  readonly title: string;
  readonly associatedItem: string | null;
  readonly arc: string;
  readonly feeds: string;
  readonly openingPrompt: string;
}

export const PATRONS: readonly PatronDefinition[] = [
  {
    id: 'odric_vane',
    name: 'Serjeant Odric Vane',
    title: 'Warden of the Marches',
    associatedItem: 'RECIPE_CRAFT_FLINT_SPEAR',
    arc: 'Muster → war-chief\'s house → frontier lord → warden of the marches → Crown marshal',
    feeds: 'Ore, sinews, hunts, the Marches\' charter language',
    openingPrompt: 'Arm my huntsmen for the wolf season — three good heads of stone and flint before the frost.',
  },
  {
    id: 'madame_serafine',
    name: 'Madame Serafine',
    title: 'Steward of the Guild of Scents',
    associatedItem: 'RECIPE_SAPONIFY_COLD',
    arc: 'Perfumer → the Guild of Scents → Magistrate of the Spice Guild → royal alchemist',
    feeds: 'Luxury reagents, letters of credit, the Court\'s ear',
    openingPrompt: 'The manor demands clean tallow and sweet water. Deliver three bars of fragrant curd.',
  },
  {
    id: 'sister_aurel',
    name: 'Sister Aurel of the Weir',
    title: 'District Physician of the Weir',
    associatedItem: 'RECIPE_STEEP_WILLOW_BARK',
    arc: 'Herbalist → tincturist → district physician of the Weir → royal physician',
    feeds: 'Willow country, clinics, the Realm\'s gratitude',
    openingPrompt: 'The river fever takes the young first. Bring three vials of willow steep to soothe the ague.',
  },
  {
    id: 'forge_clans',
    name: 'The Forge Clans',
    title: 'Master of the Deep',
    associatedItem: 'RECIPE_ROAST_CHARCOAL',
    arc: 'Coal-burner → smith → Master of the Deep → lord of the Ember Road',
    feeds: 'Ore rights, bellows, the mines',
    openingPrompt: 'The hearths are cold. We need five bushels of pure hardwood charcoal to light the crucibles.',
  },
  {
    id: 'hedge_witch',
    name: 'The Hedge-Witch',
    title: 'The Silent Hermit',
    associatedItem: null,
    arc: 'Self-sufficient hermit → the country\'s quiet saint',
    feeds: 'Food from the hedgerows, solitude, the Domain of Quiet',
    openingPrompt: 'Speak to the quiet earth. Tend your own hands; no court shall command your salt.',
  },
];

export interface Commission {
  readonly id: string;
  readonly patronId: PatronId;
  readonly askItem: string;
  readonly askCount: number;
  deliveredCount: number;
  readonly deadlineTurn: number;
  readonly rewardStock: { itemId: string; count: number; label: string }[];
  readonly completed: boolean;
  readonly failed: boolean;
}

export interface PatronState {
  patronId: PatronId | null;
  trustTier: number; // 0: Abandoned, 1: Stranger, 2: Familiar, 3: Sworn, 4: Cherished
  trustScore: number; // 0..100
  firstCraftCompleted: boolean;
  activeCommission: Commission | null;
  completedCommissionsCount: number;
}

export function createInitialPatronState(): PatronState {
  return {
    patronId: null,
    trustTier: 1,
    trustScore: 20,
    firstCraftCompleted: false,
    activeCommission: null,
    completedCommissionsCount: 0,
  };
}

export function assignPatronFromRecipe(recipeId: string | null): PatronId {
  if (!recipeId) return 'hedge_witch';
  if (recipeId.includes('SPEAR') || recipeId.includes('ADZE') || recipeId.includes('KNIFE') || recipeId.includes('AXE')) {
    return 'odric_vane';
  }
  if (recipeId.includes('SOAP') || recipeId.includes('SAPONIFY') || recipeId.includes('OIL') || recipeId.includes('TALLOW')) {
    return 'madame_serafine';
  }
  if (recipeId.includes('WILLOW') || recipeId.includes('TINCTURE') || recipeId.includes('TEA') || recipeId.includes('SALVE')) {
    return 'sister_aurel';
  }
  if (recipeId.includes('CHARCOAL') || recipeId.includes('SMELT') || recipeId.includes('BRONZE') || recipeId.includes('INGOT')) {
    return 'forge_clans';
  }
  return 'hedge_witch';
}

export function createFirstCommission(patronId: PatronId, currentTurn: number): Commission {
  switch (patronId) {
    case 'odric_vane':
      return {
        id: 'comm_vane_1',
        patronId,
        askItem: 'RECIPE_CRAFT_FLINT_SPEAR',
        askCount: 3,
        deliveredCount: 0,
        deadlineTurn: currentTurn + 5,
        rewardStock: [
          { itemId: 'SPHALERITE_ORE', count: 4, label: 'Sphalerite Ore' },
          { itemId: 'SINEW_CORD', count: 3, label: 'Sinew Cord' },
        ],
        completed: false,
        failed: false,
      };
    case 'madame_serafine':
      return {
        id: 'comm_serafine_1',
        patronId,
        askItem: 'BAR_SOAP',
        askCount: 3,
        deliveredCount: 0,
        deadlineTurn: currentTurn + 5,
        rewardStock: [
          { itemId: 'RENDERED_TALLOW', count: 4, label: 'Rendered Tallow' },
          { itemId: 'SALT_BRINE', count: 2, label: 'Salt Brine' },
        ],
        completed: false,
        failed: false,
      };
    case 'sister_aurel':
      return {
        id: 'comm_aurel_1',
        patronId,
        askItem: 'WILLOW_TEA',
        askCount: 3,
        deliveredCount: 0,
        deadlineTurn: currentTurn + 5,
        rewardStock: [
          { itemId: 'WILLOW_BARK', count: 6, label: 'Willow Bark' },
          { itemId: 'DRIED_MEAT', count: 3, label: 'Dried Rations' },
        ],
        completed: false,
        failed: false,
      };
    case 'forge_clans':
      return {
        id: 'comm_forge_1',
        patronId,
        askItem: 'CHARCOAL',
        askCount: 5,
        deliveredCount: 0,
        deadlineTurn: currentTurn + 5,
        rewardStock: [
          { itemId: 'CHALCOPYRITE_ORE', count: 4, label: 'Copper Ore' },
          { itemId: 'CASSITERITE_ORE', count: 2, label: 'Tin Ore' },
        ],
        completed: false,
        failed: false,
      };
    case 'hedge_witch':
    default:
      return {
        id: 'comm_witch_1',
        patronId: 'hedge_witch',
        askItem: 'ROWAN_BERRIES',
        askCount: 5,
        deliveredCount: 0,
        deadlineTurn: currentTurn + 8,
        rewardStock: [
          { itemId: 'DRIED_MEAT', count: 5, label: 'Hedgerow Forage' },
        ],
        completed: false,
        failed: false,
      };
  }
}
