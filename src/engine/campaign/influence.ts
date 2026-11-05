/**
 * Milestone M6: Influence, Independent Powers & Foreign Stance
 * (§6.10, §6.18.4, §6.19, §6.29)
 *
 * Implements 4 Independent Powers per age roster, Suzerain bonuses,
 * the 4 power actions: BEFRIEND, LEVY, INCITE, INCORPORATE,
 * and foreign stance metrics.
 */

export interface IndependentPower {
  id: string;
  name: string;
  age: number; // 1, 2, or 3
  description: string;
  focus: 'MILITARY' | 'CULTURE' | 'TRADE' | 'SCIENCE';
  influence: number; // 0..100 (100 = full incorporation)
  suzerainBonus: string;
  suzerainActive: boolean;
  status: 'NEUTRAL' | 'FRIENDLY' | 'SUZERAIN' | 'INCORPORATED' | 'HOSTILE';
  demands: string;
}

export const AGE_I_INDEPENDENT_POWERS: IndependentPower[] = [
  {
    id: 'power_wolf_kin',
    name: 'Wolf-Kin Clan',
    age: 1,
    description: 'Fierce nomadic hunters of the northern pine wastes.',
    focus: 'MILITARY',
    influence: 15,
    suzerainBonus: '+2 Guard in all border settlements; -25% raid threat from wild beasts.',
    suzerainActive: false,
    status: 'NEUTRAL',
    demands: 'They want: weapons and forged iron spearheads.',
  },
  {
    id: 'power_painted_lodge',
    name: 'The Painted Lodge',
    age: 1,
    description: 'Weavers and pigment-grinders dwelling in the river bends.',
    focus: 'CULTURE',
    influence: 20,
    suzerainBonus: '+3 Renown per turn; Celebration cost halved.',
    suzerainActive: false,
    status: 'NEUTRAL',
    demands: 'They want: fine pigments, scented oils, and clean tallow.',
  },
  {
    id: 'power_salt_caravan',
    name: 'Salt Caravan Syndicate',
    age: 1,
    description: 'Wagon-masters controlling brine wells and overland roads.',
    focus: 'TRADE',
    influence: 10,
    suzerainBonus: '+4 Trade per turn; Convoys cannot be intercepted by bandits.',
    suzerainActive: false,
    status: 'NEUTRAL',
    demands: 'They want: unrefined salt, dried rations, and road safety.',
  },
  {
    id: 'power_stillbound_hermitage',
    name: 'Stillbound Hermitage',
    age: 1,
    description: 'Secluded herbalists and distillers living among thermal springs.',
    focus: 'SCIENCE',
    influence: 25,
    suzerainBonus: '+2 Discovery per turn; Public Health decay reduced by 50%.',
    suzerainActive: false,
    status: 'NEUTRAL',
    demands: 'They want: willow bark extract and clean glass alembics.',
  },
];

export const AGE_II_INDEPENDENT_POWERS: IndependentPower[] = [
  {
    id: 'power_iron_foundry_league',
    name: 'Iron Foundry League',
    age: 2,
    description: 'Blast furnace masters of the crags with advanced cupola secrets.',
    focus: 'MILITARY',
    influence: 10,
    suzerainBonus: 'Blacksmith batch jobs speed +50%; weapon costs reduced.',
    suzerainActive: false,
    status: 'NEUTRAL',
    demands: 'They want: coke, flux stone, and high-grade copper.',
  },
  {
    id: 'power_grand_bazaar_vessel',
    name: 'Grand Bazaar Flotilla',
    age: 2,
    description: 'Deep-water trading junks carrying exotic spices and silks.',
    focus: 'TRADE',
    influence: 15,
    suzerainBonus: '+8 Trade per turn; Harbour trade taxes doubled.',
    suzerainActive: false,
    status: 'NEUTRAL',
    demands: 'They want: verified phase-pure bronze and fine soap cakes.',
  },
  {
    id: 'power_cloistered_scholars',
    name: 'Cloistered Scholars of St. Jude',
    age: 2,
    description: 'Manuscript copyists and botanists preserving ancient codices.',
    focus: 'SCIENCE',
    influence: 20,
    suzerainBonus: '+5 Discovery per turn; +1 free research insight per 10 turns.',
    suzerainActive: false,
    status: 'NEUTRAL',
    demands: 'They want: caustic parchment bleach and gall ink.',
  },
  {
    id: 'power_sacred_chorus',
    name: 'Sacred Chorus of the Vale',
    age: 2,
    description: 'Choral bell-ringers and ceremonial procession stewards.',
    focus: 'CULTURE',
    influence: 15,
    suzerainBonus: '+6 Renown per turn; Estate Public drop rate dampened.',
    suzerainActive: false,
    status: 'NEUTRAL',
    demands: 'They want: ceremonial incense and bell bronze.',
  },
];

export interface InfluenceState {
  currentInfluencePool: number;
  powers: IndependentPower[];
  suzerainCount: number;
  incorporatedCount: number;
}

export function createInitialInfluenceState(age = 1): InfluenceState {
  const template = age === 1 ? AGE_I_INDEPENDENT_POWERS : AGE_II_INDEPENDENT_POWERS;
  return {
    currentInfluencePool: 20,
    powers: template.map((p) => ({ ...p })),
    suzerainCount: 0,
    incorporatedCount: 0,
  };
}

export type PowerAction = 'BEFRIEND' | 'LEVY' | 'INCITE' | 'INCORPORATE';

export interface PowerActionResult {
  success: boolean;
  message: string;
  influenceCost: number;
  powerId: string;
}

/**
 * Execute an action on an Independent Power.
 * Costs Influence currency.
 */
export function executePowerAction(
  state: InfluenceState,
  powerId: string,
  action: PowerAction,
): PowerActionResult {
  const p = state.powers.find((item) => item.id === powerId);
  if (!p) {
    return { success: false, message: `Unknown power: ${powerId}`, influenceCost: 0, powerId };
  }

  switch (action) {
    case 'BEFRIEND': {
      const cost = 10;
      if (state.currentInfluencePool < cost) {
        return { success: false, message: `Need ${cost} Influence to befriend ${p.name}.`, influenceCost: 0, powerId };
      }
      state.currentInfluencePool -= cost;
      p.influence = Math.min(100, p.influence + 20);
      if (p.influence >= 60 && !p.suzerainActive) {
        p.status = 'SUZERAIN';
        p.suzerainActive = true;
        state.suzerainCount = state.powers.filter((x) => x.suzerainActive).length;
        return {
          success: true,
          message: `Reached Suzerainty with ${p.name}! Bonus active: ${p.suzerainBonus}`,
          influenceCost: cost,
          powerId,
        };
      } else if (p.influence >= 30 && p.status === 'NEUTRAL') {
        p.status = 'FRIENDLY';
      }
      return {
        success: true,
        message: `Sent diplomatic envoys and gifts to ${p.name}. Influence is now ${p.influence}/100.`,
        influenceCost: cost,
        powerId,
      };
    }

    case 'LEVY': {
      const cost = 15;
      if (state.currentInfluencePool < cost) {
        return { success: false, message: `Need ${cost} Influence to levy troops or aid from ${p.name}.`, influenceCost: 0, powerId };
      }
      if (p.influence < 40) {
        return { success: false, message: `${p.name} influence must be at least 40 to levy.`, influenceCost: 0, powerId };
      }
      state.currentInfluencePool -= cost;
      p.influence = Math.max(0, p.influence - 10);
      return {
        success: true,
        message: `Levied auxiliary support from ${p.name}. (Influence decreased by 10).`,
        influenceCost: cost,
        powerId,
      };
    }

    case 'INCITE': {
      const cost = 12;
      if (state.currentInfluencePool < cost) {
        return { success: false, message: `Need ${cost} Influence to incite raids or unrest.`, influenceCost: 0, powerId };
      }
      state.currentInfluencePool -= cost;
      p.status = 'HOSTILE';
      p.suzerainActive = false;
      p.influence = Math.max(0, p.influence - 30);
      state.suzerainCount = state.powers.filter((x) => x.suzerainActive).length;
      return {
        success: true,
        message: `Incited ${p.name} against rival borders. They are now hostile to foreign marches.`,
        influenceCost: cost,
        powerId,
      };
    }

    case 'INCORPORATE': {
      const cost = 30;
      if (state.currentInfluencePool < cost) {
        return { success: false, message: `Need ${cost} Influence to fully incorporate ${p.name}.`, influenceCost: 0, powerId };
      }
      if (p.influence < 80) {
        return { success: false, message: `${p.name} influence must be at least 80 to incorporate.`, influenceCost: 0, powerId };
      }
      state.currentInfluencePool -= cost;
      p.influence = 100;
      p.status = 'INCORPORATED';
      p.suzerainActive = true;
      state.incorporatedCount = state.powers.filter((x) => x.status === 'INCORPORATED').length;
      state.suzerainCount = state.powers.filter((x) => x.suzerainActive).length;
      return {
        success: true,
        message: `${p.name} has been formally incorporated into your realm territory!`,
        influenceCost: cost,
        powerId,
      };
    }
  }
}
