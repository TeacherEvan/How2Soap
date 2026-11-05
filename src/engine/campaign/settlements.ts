/**
 * Settlements Model & Economy (Towns & Cities)
 *
 * Implements §6.4 & §6.18.2 of the Civ VII 4X Conversion Plan (v8):
 * - Settlement kinds: CAMP, TOWN, CITY.
 * - Town focuses: FARMING, MINING, TRADE_OUTPOST, FORT, URBAN_CENTER, GROWING.
 * - Buildings & overbuilding (carrying previous age buildings at 50% yield).
 * - Distribute clothes (Leather Tunics) & Blacksmith tool maintenance.
 * - Settlement limit: base 3. Over-limit applies morale penalty.
 * - 7-yield economy: Food, Production, Trade (gold-analogue), Discovery (science), Renown (culture), Morale, Influence.
 */

export type SettlementKind = 'CAMP' | 'TOWN' | 'CITY';

export type TownFocus =
  | 'FARMING'
  | 'MINING'
  | 'TRADE_OUTPOST'
  | 'FORT'
  | 'URBAN_CENTER'
  | 'GROWING';

export interface SettlementYields {
  food: number;
  production: number;
  trade: number;
  discovery: number;
  renown: number;
  morale: number;
  influence: number;
}

export interface BuildingInstance {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly yields: Partial<SettlementYields>;
  readonly overbuilt?: boolean;
}

export interface Settlement {
  id: string;
  name: string;
  kind: SettlementKind;
  q: number;
  r: number;
  population: number;
  growthPool: number;
  focus?: TownFocus;
  isCapital: boolean;
  buildings: BuildingInstance[];
  districts: import('./districts').UrbanDistrict[];
  workedHexes: string[];
  overbuilt: string[];
  foundedCampaignDay: number;
  guardCount: number; // 0..5 (§6.18.3)
  clothedPairs: number; // (§6.18.2)
  toolsCount: number;
  toolsWear: number; // tool degradation clock (§6.20.2)
}

export interface SettlementsState {
  settlements: Settlement[];
  settlementLimit: number;
  globalYields: SettlementYields;
}

export function createInitialSettlementsState(capitalName = 'The Hearth'): SettlementsState {
  const capital: Settlement = {
    id: 'settlement_capital',
    name: capitalName,
    kind: 'CAMP',
    q: 0,
    r: 0,
    population: 4,
    growthPool: 0,
    focus: 'GROWING',
    isCapital: true,
    buildings: [
      {
        id: 'bld_hearth_fire',
        name: 'Camp Hearth',
        age: 1,
        yields: { food: 2, production: 2, trade: 1, discovery: 1, renown: 1, morale: 5, influence: 1 },
      },
    ],
    districts: [
      {
        id: 'district_hearth_center',
        kind: 'CAMP_CENTER',
        q: 0,
        r: 0,
        buildings: [],
        isQuarter: false,
        isUniqueQuarter: false,
      },
    ],
    workedHexes: ['0,0'],
    overbuilt: [],
    foundedCampaignDay: 1,
    guardCount: 0,
    clothedPairs: 0,
    toolsCount: 4,
    toolsWear: 0,
  };

  return {
    settlements: [capital],
    settlementLimit: 3,
    globalYields: {
      food: 2,
      production: 2,
      trade: 1,
      discovery: 1,
      renown: 1,
      morale: 5,
      influence: 1,
    },
  };
}

export function foundSettlement(
  state: SettlementsState,
  params: { name: string; q: number; r: number; currentDay: number },
): { ok: boolean; message: string; settlement?: Settlement } {
  const exists = state.settlements.some((s) => s.q === params.q && s.r === params.r);
  if (exists) {
    return { ok: false, message: `Hex (${params.q}, ${params.r}) already contains a settlement.` };
  }

  const id = `settlement_${state.settlements.length + 1}`;
  const newSettlement: Settlement = {
    id,
    name: params.name,
    kind: 'TOWN',
    q: params.q,
    r: params.r,
    population: 2,
    growthPool: 0,
    focus: 'GROWING',
    isCapital: false,
    buildings: [],
    districts: [
      {
        id: `district_${params.name.toLowerCase().replace(/\s+/g, '_')}_center`,
        kind: 'CITY_CENTER',
        q: params.q,
        r: params.r,
        buildings: [],
        isQuarter: false,
        isUniqueQuarter: false,
      },
    ],
    workedHexes: [`${params.q},${params.r}`],
    overbuilt: [],
    foundedCampaignDay: params.currentDay,
    guardCount: 0,
    clothedPairs: 0,
    toolsCount: 2,
    toolsWear: 0,
  };

  state.settlements.push(newSettlement);
  recomputeSettlementYields(state);

  return {
    ok: true,
    message: `Founded town of ${params.name} at (${params.q}, ${params.r}).`,
    settlement: newSettlement,
  };
}

export function upgradeSettlementKind(
  settlement: Settlement,
): { ok: boolean; message: string } {
  if (settlement.kind === 'CAMP') {
    settlement.kind = 'TOWN';
    return { ok: true, message: `${settlement.name} upgraded from Camp to Town.` };
  }
  if (settlement.kind === 'TOWN') {
    settlement.kind = 'CITY';
    return { ok: true, message: `${settlement.name} upgraded from Town to City.` };
  }
  return { ok: false, message: `${settlement.name} is already a City.` };
}

export function recomputeSettlementYields(state: SettlementsState): void {
  const totals: SettlementYields = {
    food: 0,
    production: 0,
    trade: 0,
    discovery: 0,
    renown: 0,
    morale: 0,
    influence: 0,
  };

  const isOverLimit = state.settlements.length > state.settlementLimit;
  const overLimitPenalty = isOverLimit ? -4 * (state.settlements.length - state.settlementLimit) : 0;

  for (const s of state.settlements) {
    // Base pop yields
    totals.food += s.population * 1;
    totals.production += s.population * 1;
    totals.trade += s.kind === 'CITY' ? 3 : s.kind === 'TOWN' ? 1 : 0;
    totals.discovery += s.kind === 'CITY' ? 2 : 0;

    // Focus yields
    if (s.focus === 'FARMING') totals.food += 3;
    if (s.focus === 'MINING') totals.production += 3;
    if (s.focus === 'TRADE_OUTPOST') totals.trade += 3;
    if (s.focus === 'FORT') totals.influence += 2;
    if (s.focus === 'GROWING') totals.food += 2;

    // Building yields
    for (const b of s.buildings) {
      const mult = b.overbuilt ? 0.5 : 1.0;
      if (b.yields.food) totals.food += b.yields.food * mult;
      if (b.yields.production) totals.production += b.yields.production * mult;
      if (b.yields.trade) totals.trade += b.yields.trade * mult;
      if (b.yields.discovery) totals.discovery += b.yields.discovery * mult;
      if (b.yields.renown) totals.renown += b.yields.renown * mult;
      if (b.yields.influence) totals.influence += b.yields.influence * mult;
      if (b.yields.morale) totals.morale += b.yields.morale * mult;
    }

    // Clothed pairs add morale & safety
    totals.morale += Math.floor(s.clothedPairs * 0.5);
  }

  totals.morale += overLimitPenalty;
  state.globalYields = totals;
}
