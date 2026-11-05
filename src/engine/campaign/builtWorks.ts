/**
 * Built Works Engine (§6.29)
 *
 * Achievement-gated structural upgrades where construction functions as a second
 * technology tree. Each work consumes chemical/camp reagents (lime-cement, leather rope,
 * casein glue, acids, wood-composite, military engines) with lasting Realm benefits.
 */

export interface BuiltWorkDef {
  readonly id: string;
  readonly name: string;
  readonly chemistryRecipe: string;
  readonly reagents: { itemId: string; count: number; label: string }[];
  readonly effectDesc: string;
  readonly unlocks: string;
  readonly healthDeltaPerTurn?: number;
  readonly haulBonusPct?: number;
  readonly rangedMaBonus?: number;
  readonly correspondenceSpeedMultiplier?: number;
  readonly completed: boolean;
}

export interface BuiltWorksState {
  works: Record<string, boolean>; // id -> completed
  engineeringCanonCount: number; // Epilogue engineering counter
  activeHealthBonusPerTurn: number;
}

export const BUILT_WORKS_DEFS: readonly Omit<BuiltWorkDef, 'completed'>[] = [
  {
    id: 'work_lime_cement',
    name: 'Hydraulic Lime-Cement & Sewer Outfall',
    chemistryRecipe: 'CaCO3 -> CaO -> Ca(OH)2 + pozzolana',
    reagents: [
      { itemId: 'SOAPSTONE_CHUNK', count: 4, label: 'Crushed Limestone/Soapstone' },
      { itemId: 'HARDWOOD_CHARCOAL', count: 3, label: 'Kiln Fuel' },
    ],
    effectDesc: 'Constructs municipal sewer outfalls: Public Health +2 per turn.',
    unlocks: 'Aqueducts, stone arches, and stone curtain walls.',
    healthDeltaPerTurn: 2,
  },
  {
    id: 'work_leather_rope',
    name: 'Tanned Leather Cordage & River Span',
    chemistryRecipe: 'Leached hide collagen crosslinked with willow tannin',
    reagents: [
      { itemId: 'VEGETABLE_TANNED_LEATHER', count: 2, label: 'Vegetable-Tanned Leather' },
      { itemId: 'DEER_SINEW', count: 2, label: 'Sinew Cordage' },
    ],
    effectDesc: '+10% colonist haul speed; bridges river gorges (Span).',
    unlocks: 'The River Span Wonder, siege ladders, suspension crossings.',
    haulBonusPct: 0.10,
  },
  {
    id: 'work_casein_glue',
    name: 'Casein Glue & Laminated Composite Bows',
    chemistryRecipe: 'Milk curd precipitate + mild acetic acid wash',
    reagents: [
      { itemId: 'RAW_ADIPOSE_FAT', count: 2, label: 'Curd/Fat Base' },
      { itemId: 'ANIMAL_BONE', count: 2, label: 'Heavy Femur Horn/Bone' },
    ],
    effectDesc: '+1 ranged mechanical advantage for town guards; composite laminations.',
    unlocks: 'Composite siege bows, laminated masts.',
    rangedMaBonus: 1,
  },
  {
    id: 'work_acids_engraving',
    name: 'Vitriolic Acid Etching & Glyph Ciphers',
    chemistryRecipe: 'Lead-chamber sulfuric & nitric acid bath',
    reagents: [
      { itemId: 'SALTPETER_CRYSTALS', count: 2, label: 'Saltpeter' },
      { itemId: 'SULFUR', count: 1, label: 'Sulfur Fines' },
    ],
    effectDesc: 'Nitric-etched metal mementos and diplomatic glyphs; correspondence accelerates ×2.',
    unlocks: 'Diplomatic cipher poetry, high-trust envoy seals.',
    correspondenceSpeedMultiplier: 2,
  },
  {
    id: 'work_wood_composite',
    name: 'Resin-Bonded Wood-Composite Weapons',
    chemistryRecipe: 'Hardwood veneers + boiled casein/hide glue under pressure',
    reagents: [
      { itemId: 'HARDWOOD_LOG', count: 3, label: 'Hardwood Timber' },
      { itemId: 'DEER_SINEW', count: 2, label: 'Sinew' },
    ],
    effectDesc: 'Lightweight high-toughness shafting; lowers weight by 30%, increases guard rating by +1.',
    unlocks: 'Kestrel strike staffs, rapid-response guard cadres.',
  },
  {
    id: 'work_military_engines',
    name: 'Siege Counterweights & Heavy Ballistics',
    chemistryRecipe: 'Cement footings + leather span cable + composite beams + iron pivot',
    reagents: [
      { itemId: 'COPPER_INGOT', count: 2, label: 'Bronze Pivot Bushings' },
      { itemId: 'HARDWOOD_LOG', count: 4, label: 'Counterweight Timbers' },
      { itemId: 'TNT_CHARGE', count: 1, label: 'Demolition Munition' },
    ],
    effectDesc: 'Breaches enemy walls during military expeditions; decisive siege power.',
    unlocks: 'The March offensive endgame, citadel reduction.',
  },
];

export function createInitialBuiltWorks(): BuiltWorksState {
  return {
    works: {},
    engineeringCanonCount: 0,
    activeHealthBonusPerTurn: 0,
  };
}

export function constructBuiltWork(
  state: BuiltWorksState,
  workId: string,
): { ok: boolean; message: string; state: BuiltWorksState } {
  if (state.works[workId]) {
    return { ok: false, message: 'This built work has already been completed.', state };
  }

  const def = BUILT_WORKS_DEFS.find((w) => w.id === workId);
  if (!def) {
    return { ok: false, message: 'Unknown built work.', state };
  }

  const nextWorks = { ...state.works, [workId]: true };
  const healthDelta = def.healthDeltaPerTurn ?? 0;

  const nextState: BuiltWorksState = {
    works: nextWorks,
    engineeringCanonCount: state.engineeringCanonCount + 1,
    activeHealthBonusPerTurn: state.activeHealthBonusPerTurn + healthDelta,
  };

  return {
    ok: true,
    message: `Completed construction: «${def.name}»! ${def.effectDesc}`,
    state: nextState,
  };
}
