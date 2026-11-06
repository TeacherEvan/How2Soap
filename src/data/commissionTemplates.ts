export interface CommissionTemplate {
  id: string;
  weight: number;
  minDay?: number;
  minChapter?: number;
  label: string;
  target: number;
  renownReward: number;
  objective: (snapshot: any, clientState: any) => number;
}

export const COMMISSION_TEMPLATES: CommissionTemplate[] = [
  {
    id: 'saponify',
    weight: 10,
    minDay: 1,
    label: 'Cure Raw Soap at the Bench',
    target: 1,
    renownReward: 15,
    objective: (_snap, state) => {
      const soapCount = (state.inventory?.items?.['RAW_SOAP'] || 0) + (state.progression?.ever?.soap ? 1 : 0);
      return Math.min(1, soapCount);
    },
  },
  {
    id: 'harvest',
    weight: 15,
    minDay: 1,
    label: 'Gather Fuel & Botanicals',
    target: 5,
    renownReward: 10,
    objective: (_snap, state) => {
      const pine = state.inventory?.items?.['PINE_DEADFALL_WOOD'] || 0;
      const ash = state.inventory?.items?.['WOOD_ASH'] || 0;
      return Math.min(5, pine + ash);
    },
  },
  {
    id: 'renown',
    weight: 10,
    minDay: 1,
    label: 'Raise Colony Morale & Renown',
    target: 20,
    renownReward: 12,
    objective: (_snap, state) => {
      return Math.min(20, state.progression?.renown || 0);
    },
  },
  {
    id: 'dawn-report',
    weight: 8,
    minDay: 2,
    label: 'Inspect Dawn Forecast',
    target: 1,
    renownReward: 8,
    objective: (_snap, state) => {
      return state.dawnReportInspected ? 1 : 0;
    },
  },
  {
    id: 'vigor',
    weight: 12,
    minDay: 1,
    label: 'Maintain Hearth Vigor (≥ 45%)',
    target: 45,
    renownReward: 10,
    objective: (_snap, state) => {
      const vigor = state.realm?.vigor ?? 50;
      return vigor >= 45 ? 45 : vigor;
    },
  },
  {
    id: 'fabricate',
    weight: 14,
    minDay: 1,
    label: 'Fabricate Camp Utensils or Tools',
    target: 1,
    renownReward: 15,
    objective: (_snap, state) => {
      const fabCount = state.progression?.fabricatedRecipes?.length || 0;
      return Math.min(1, fabCount);
    },
  },
];
