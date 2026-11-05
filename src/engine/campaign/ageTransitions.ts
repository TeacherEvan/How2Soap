/**
 * Age Progression, Age Transitions & Tech Maturity Engine (§6.2, §6.3, §6.11, §6.21)
 *
 * Implements:
 * - Content for Ages I (Ash), II (Brass), and III (Volta).
 * - 6 Civilizations across lineages:
 *     Ash Walkers -> The Stillbound Synod (Age II)
 *     Shore Clan / Salt Folk -> The Carthaginian Cartel (Age II) -> The Voltaic Concord (Age III)
 *     Forgeborn -> The Bronze Compact (Age II) -> The Fulgurate League (Age III)
 * - Tech & Civic trees per age with 3 Maturity Tiers:
 *     0: INVENTION (just recipes; baseline)
 *     1: PRACTICE (>=1 settlement adopting; x1.1 yields)
 *     2: DOCTRINE (>=3 settlements adopting; x1.25 yields + special effect)
 * - Transition Golden/Dark age outcome resolution based on attributes/milestones.
 * - TEACH_THE_REALM knowledge release: broadcasts tech to Realm, sacrificing Discovery
 *   for 3 turns to grant permanent Public Health & Safety.
 */

export interface CivLineage {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly description: string;
  readonly perk: string;
}

export const AGE_CIVS: readonly CivLineage[] = [
  // Age I: Ash
  {
    id: 'ash_walkers',
    name: 'The Ash Walkers',
    age: 1,
    description: 'Masters of kilns, potash lye, and scrub-clearing.',
    perk: '+20% Potash yield from hardwood ash; kilning requires 15% less heat.',
  },
  {
    id: 'shore_clan',
    name: 'The Shore Clan',
    age: 1,
    description: 'Maritime scavengers adept at tidal salt pans and tallow extraction.',
    perk: '+25% Brine harvesting speed; fish oils provide stable saponification base.',
  },
  {
    id: 'salt_gatherers',
    name: 'The Salt Gatherers',
    age: 1,
    description: 'Steppe traders guarding the white crust of the salt trails.',
    perk: '+15% Trade value for mineral salts; meat preserved with half the salt quantity.',
  },

  // Age II: Brass
  {
    id: 'stillbound_synod',
    name: 'The Stillbound Synod',
    age: 2,
    description: 'Scholastic apothecaries devoted to alembic precision and willow alkaloids.',
    perk: '+2 Discovery per turn while any distillation or fermentation is active.',
  },
  {
    id: 'carthaginian_cartel',
    name: 'The Carthaginian Cartel',
    age: 2,
    description: 'Maritime syndicates dominating copper-tin trade routes and deep brine wells.',
    perk: '+30% Convoy GDP; Harbour quarantine checks cost no trade penalties.',
  },
  {
    id: 'bronze_compact',
    name: 'The Bronze Compact',
    age: 2,
    description: 'Foundry-masters casting bronze armor, batch spears, and mining tools.',
    perk: 'Blacksmith batch jobs complete 1 turn faster; Guard bonus +1 in all towns.',
  },

  // Age III: Volta
  {
    id: 'voltaic_concord',
    name: 'The Voltaic Concord',
    age: 3,
    description: 'Pioneers of galvanic zinc piles, muriatic acid, and electrical decomposition.',
    perk: '+50% Voltaic cell efficiency; electric arc reactions generate +4 Innovation.',
  },
  {
    id: 'fulgurate_league',
    name: 'The Fulgurate League',
    age: 3,
    description: 'Industrial chemists deploying nitro compounds and deep-seam explosive mining.',
    perk: 'Deep Mine cave-in chance reduced by 50%; demolition charges yield 2x minerals.',
  },
];

export type MaturityTier = 0 | 1 | 2; // 0 = Invention, 1 = Practice, 2 = Doctrine

export interface TechNode {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly category: 'SCIENCE' | 'CIVIC' | 'MILITARY';
  readonly description: string;
  maturity: MaturityTier;
  userSettlementCount: number;
  isUnlocked: boolean;
  doctrineSpecialEffect: string;
}

export const AGE_TECH_NODES: readonly Omit<TechNode, 'maturity' | 'userSettlementCount' | 'isUnlocked'>[] = [
  // Age I
  {
    id: 'tech_caustic_leach',
    name: 'Caustic Leaching',
    age: 1,
    category: 'SCIENCE',
    description: 'Wood-ash lye percolation through straw filters.',
    doctrineSpecialEffect: 'Soapcraft yield +25% in all settlements.',
  },
  {
    id: 'civic_hearth_law',
    name: 'Hearth Law & Rations',
    age: 1,
    category: 'CIVIC',
    description: 'Communal food storage and rationing edicts.',
    doctrineSpecialEffect: 'Food consumption reduced by 15% across all settlements.',
  },
  // Age II
  {
    id: 'tech_bronze_metallurgy',
    name: 'Bronze Metallurgy & Smelting',
    age: 2,
    category: 'SCIENCE',
    description: '88:12 copper-tin crucible reduction and casting.',
    doctrineSpecialEffect: 'Mine yields +25%; tool degradation slowed by 30%.',
  },
  {
    id: 'civic_mercantile_charter',
    name: 'Mercantile Guild Charters',
    age: 2,
    category: 'CIVIC',
    description: 'Standardized weights, coin assays, and convoy contracts.',
    doctrineSpecialEffect: 'Trade income +3 per settlement; convoys immune to minor raids.',
  },
  // Age III
  {
    id: 'tech_voltaic_pile',
    name: 'Voltaic Pile & Electrolysis',
    age: 3,
    category: 'SCIENCE',
    description: 'Alternating copper and zinc discs soaked in muriatic acid.',
    doctrineSpecialEffect: 'Unlocks synthetic alkali production and electrochemical refining.',
  },
  {
    id: 'civic_public_sanitation',
    name: 'Sanitary Code & Penicillin Distribution',
    age: 3,
    category: 'CIVIC',
    description: 'Mandatory clinical wards and national antibiotic supply.',
    doctrineSpecialEffect: 'Public Health immune to the Wasting decay.',
  },
];

export interface TeachTheRealmState {
  isBroadcasting: boolean;
  turnsRemaining: number;
  techId: string | null;
  spreadCompleted: boolean;
}

export interface AgeTransitionResult {
  previousAge: number;
  newAge: number;
  isGoldenAge: boolean;
  rewardTitle: string;
  rewardDesc: string;
  unlockedCivChoices: CivLineage[];
}

export function updateTechMaturity(node: TechNode, settlementsUsing: number): void {
  node.userSettlementCount = settlementsUsing;
  if (settlementsUsing >= 3) {
    node.maturity = 2; // Doctrine
  } else if (settlementsUsing >= 1) {
    node.maturity = 1; // Practice
  } else {
    node.maturity = 0; // Invention
  }
}

export function resolveAgeTransition(
  currentAge: number,
  attributeScore: number, // Leader milestone points
  publicHealth: number,
): AgeTransitionResult {
  const nextAge = Math.min(3, currentAge + 1);
  const isGoldenAge = attributeScore >= 4 && publicHealth >= 60;

  const unlockedCivChoices = AGE_CIVS.filter((c) => c.age === nextAge);

  if (isGoldenAge) {
    return {
      previousAge: currentAge,
      newAge: nextAge,
      isGoldenAge: true,
      rewardTitle: 'Golden Age of Renaissance',
      rewardDesc: 'The Realm enters the next epoch triumphant! +20% all yields for 10 turns, +2 Leader Attribute points.',
      unlockedCivChoices,
    };
  } else {
    return {
      previousAge: currentAge,
      newAge: nextAge,
      isGoldenAge: false,
      rewardTitle: 'Dark Age of Scarcity',
      rewardDesc: 'The epoch turns under hardship. Rebellious sentiments rise; +1 Incursion threat level.',
      unlockedCivChoices,
    };
  }
}

export function startTeachTheRealm(
  techId: string,
): { ok: boolean; message: string; state: TeachTheRealmState } {
  return {
    ok: true,
    message: `Proclamation issued! Scholars broadcast «${techId}» across the Realm. Discovery generation paused for 3 turns.`,
    state: {
      isBroadcasting: true,
      turnsRemaining: 3,
      techId,
      spreadCompleted: false,
    },
  };
}

export function stepTeachTheRealm(
  state: TeachTheRealmState,
): { state: TeachTheRealmState; healthBonus: number; safetyBonus: number; message?: string } {
  if (!state.isBroadcasting) {
    return { state, healthBonus: 0, safetyBonus: 0 };
  }

  const nextTurns = state.turnsRemaining - 1;
  if (nextTurns <= 0) {
    return {
      state: {
        isBroadcasting: false,
        turnsRemaining: 0,
        techId: state.techId,
        spreadCompleted: true,
      },
      healthBonus: 10,
      safetyBonus: 10,
      message: `The knowledge of «${state.techId}» has taken root across the entire Realm! Public Health +10, Public Safety +10 permanently.`,
    };
  }

  return {
    state: {
      ...state,
      turnsRemaining: nextTurns,
    },
    healthBonus: 0,
    safetyBonus: 0,
  };
}
