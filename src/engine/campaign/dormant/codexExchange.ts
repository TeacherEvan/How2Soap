/**
 * The Codex & Alchemist Exchange (§6.27)
 *
 * "Recipes you build are stored, and can be sold to other alchemists — the same
 * for you that can be used to ravage another territory, or strengthen your own."
 *
 * Codex:
 * - Stores fabricated recipe IDs in save v3 (`codex: string[]`).
 * - Provenance: Secret -> Divulged -> Patent -> Trade.
 *
 * Alchemist Exchange:
 * - 4 foreign brokers:
 *   1. Maester Rott Callaghan (Ash & beeswax; buys soap/lye; sells glazes & obsidian)
 *   2. Madame Anise della Penna (Perfume & myrrh; buys ferments/penicillin; sells rosemary terpenes)
 *   3. The Ninth Sphere Monastery (Candle & stone; buys flux/cements; sells relic grinds/pigments)
 *   4. The Brass Verger (Oil & sulfur; buys voltaic/copper; sells muriatic acid/nitric ether)
 * - Actions: sell, buy, steal.
 */

export type ProvenanceStatus = 'SECRET' | 'DIVULGED' | 'PATENT' | 'TRADE';

export interface CodexEntry {
  recipeId: string;
  name: string;
  discoveryDay: number;
  provenance: ProvenanceStatus;
}

export interface AlchemistBroker {
  readonly id: string;
  readonly name: string;
  readonly fragrance: string;
  readonly buysFocus: string;
  readonly sellsFocus: string;
  readonly availableCatalog: { recipeId: string; name: string; costTrade: number }[];
}

export const ALCHEMIST_BROKERS: readonly AlchemistBroker[] = [
  {
    id: 'broker_rott_callaghan',
    name: 'Maester Rott Callaghan',
    fragrance: 'Ash & beeswax',
    buysFocus: 'Soap-craft curves, descaling lye variants, caustic wash formulas',
    sellsFocus: 'Sand-blasted glazes, Honest Obsidian cut techniques',
    availableCatalog: [
      { recipeId: 'RECIPE_OBSIDIAN_GLAZE', name: 'Refined Obsidian Vitrification', costTrade: 35 },
      { recipeId: 'RECIPE_BORAX_FLUX', name: 'Borax Flux Assay', costTrade: 40 },
    ],
  },
  {
    id: 'broker_anise_penna',
    name: 'Madame Anise della Penna',
    fragrance: 'Perfume & myrrh',
    buysFocus: 'Tinctures, ferments, penicillium broth seed cultures',
    sellsFocus: 'Fragrance-grade rosemary terpenes, luxury lacquer varnish',
    availableCatalog: [
      { recipeId: 'RECIPE_ROSEMARY_TERPENES', name: 'Distilled Rosemary Terpenes', costTrade: 45 },
      { recipeId: 'RECIPE_AMBER_LACQUER', name: 'Gilded Resin Lacquer', costTrade: 50 },
    ],
  },
  {
    id: 'broker_ninth_sphere',
    name: 'The Ninth Sphere Monastery',
    fragrance: 'Candle tallow & old stone',
    buysFocus: 'Ceramics flux, hydraulic kilning, Roman cement trade secrets',
    sellsFocus: 'Relic grinds, illuminated glyph-grade pigments',
    availableCatalog: [
      { recipeId: 'RECIPE_ROMAN_POZZOLANA', name: 'Pozzolanic Mortar Secret', costTrade: 60 },
      { recipeId: 'RECIPE_CINNABAR_GRIND', name: 'Sanctified Cinnabar Vermilion', costTrade: 55 },
    ],
  },
  {
    id: 'broker_brass_verger',
    name: 'The Brass Verger',
    fragrance: 'Lamp oil & sulfur',
    buysFocus: 'Voltaic pile schemas, copper-gold reductions, electric arc paths',
    sellsFocus: 'Spirit of salt (muriatic acid), nitric ether for batteries',
    availableCatalog: [
      { recipeId: 'RECIPE_MURIATIC_ETHER', name: 'Concentrated Muriatic Acid', costTrade: 65 },
      { recipeId: 'RECIPE_ZINC_AMALGAM', name: 'Voltaic Zinc Amalgamation', costTrade: 70 },
    ],
  },
];

export interface ExchangeState {
  codex: Record<string, CodexEntry>;
  soldRecipeIds: string[]; // Once sold, available to rivals next age
  stolenRecipeIds: string[];
}

export function createInitialExchange(discoveredRecipes: string[] = []): ExchangeState {
  const codex: Record<string, CodexEntry> = {};
  for (const rId of discoveredRecipes) {
    codex[rId] = {
      recipeId: rId,
      name: rId.replace(/^RECIPE_/, '').replace(/_/g, ' '),
      discoveryDay: 1,
      provenance: 'SECRET',
    };
  }
  return {
    codex,
    soldRecipeIds: [],
    stolenRecipeIds: [],
  };
}

export function registerCodexRecipe(
  state: ExchangeState,
  recipeId: string,
  recipeName: string,
  currentTurn: number,
): void {
  if (!state.codex[recipeId]) {
    state.codex[recipeId] = {
      recipeId,
      name: recipeName,
      discoveryDay: currentTurn,
      provenance: 'SECRET',
    };
  }
}

export function updateProvenance(
  state: ExchangeState,
  recipeId: string,
  newProvenance: ProvenanceStatus,
): { ok: boolean; message: string } {
  const entry = state.codex[recipeId];
  if (!entry) {
    return { ok: false, message: 'Recipe not found in Codex.' };
  }

  // Legal forward progressions only: SECRET -> DIVULGED -> PATENT -> TRADE
  const order: Record<ProvenanceStatus, number> = {
    SECRET: 0,
    DIVULGED: 1,
    PATENT: 2,
    TRADE: 3,
  };

  if (order[newProvenance] <= order[entry.provenance]) {
    return { ok: false, message: 'Provenance cannot be rolled backward or kept unchanged.' };
  }

  entry.provenance = newProvenance;
  return { ok: true, message: `Recipe ${entry.name} promoted to ${newProvenance}.` };
}

export interface TradeRecipeResult {
  ok: boolean;
  message: string;
  tradeDelta: number;
  publicDelta: number;
  exposureRiskFired: boolean;
}

export function tradeRecipe(
  state: ExchangeState,
  params: {
    recipeId: string;
    brokerId: string;
    scope: 'sell' | 'buy' | 'steal';
    tradeBalance: number;
    rngRoll?: number; // 0..1 for steal exposure
  },
): TradeRecipeResult {
  const broker = ALCHEMIST_BROKERS.find((b) => b.id === params.brokerId);
  if (!broker) {
    return { ok: false, message: 'Unknown broker.', tradeDelta: 0, publicDelta: 0, exposureRiskFired: false };
  }

  if (params.scope === 'sell') {
    const entry = state.codex[params.recipeId];
    if (!entry) {
      return { ok: false, message: 'You cannot sell a recipe not yet in your Codex.', tradeDelta: 0, publicDelta: 0, exposureRiskFired: false };
    }
    if (state.soldRecipeIds.includes(params.recipeId)) {
      return { ok: false, message: 'Recipe has already been sold to the international exchange.', tradeDelta: 0, publicDelta: 0, exposureRiskFired: false };
    }

    state.soldRecipeIds.push(params.recipeId);
    entry.provenance = 'TRADE';
    const salePayout = 45; // Standard barter sum

    return {
      ok: true,
      message: `Sold ${entry.name} to ${broker.name} for ${salePayout} Trade! Note: rivals may access this formulation in subsequent ages.`,
      tradeDelta: salePayout,
      publicDelta: 0,
      exposureRiskFired: false,
    };
  }

  if (params.scope === 'buy') {
    const item = broker.availableCatalog.find((c) => c.recipeId === params.recipeId);
    if (!item) {
      return { ok: false, message: 'Broker does not sell this recipe.', tradeDelta: 0, publicDelta: 0, exposureRiskFired: false };
    }
    if (params.tradeBalance < item.costTrade) {
      return { ok: false, message: `Insufficient Trade funds. Requires ${item.costTrade} Trade.`, tradeDelta: 0, publicDelta: 0, exposureRiskFired: false };
    }

    registerCodexRecipe(state, item.recipeId, item.name, 1);
    const codexEntry = state.codex[item.recipeId];
    codexEntry.provenance = 'TRADE';

    return {
      ok: true,
      message: `Acquired formula «${item.name}» from ${broker.name}. Added to Codex.`,
      tradeDelta: -item.costTrade,
      publicDelta: 1,
      exposureRiskFired: false,
    };
  }

  if (params.scope === 'steal') {
    const roll = params.rngRoll ?? Math.random();
    const exposureRisk = 0.35; // 35% exposure rate
    const exposed = roll < exposureRisk;

    const item = broker.availableCatalog.find((c) => c.recipeId === params.recipeId);
    const recipeName = item ? item.name : params.recipeId;

    registerCodexRecipe(state, params.recipeId, recipeName, 1);
    state.stolenRecipeIds.push(params.recipeId);

    if (exposed) {
      return {
        ok: true,
        message: `Stole formula «${recipeName}» from ${broker.name}, but operatives were exposed! Public Estate -4.`,
        tradeDelta: 0,
        publicDelta: -4,
        exposureRiskFired: true,
      };
    } else {
      return {
        ok: true,
        message: `Covertly transcribed «${recipeName}» from ${broker.name} undetected.`,
        tradeDelta: 0,
        publicDelta: 0,
        exposureRiskFired: false,
      };
    }
  }

  return { ok: false, message: 'Invalid trade scope.', tradeDelta: 0, publicDelta: 0, exposureRiskFired: false };
}
