/**
 * Tiered Hires & National Labor Market
 *
 * Implements §6.19.1 of the Civ VII 4X Conversion Plan (v8):
 * - Hires Tiers: Locals, Specialists, Mercenaries, Warriors, Gangsters.
 * - Fieldcraft & Estate Signals:
 *   - Locals: Cheap commodity wages, standard yield, +1 Public per 5 hired.
 *   - Specialists: Mid commodity wage, +40% recipe yield, Crown loved.
 *   - Mercenaries: 3x Trade wage, +50% in raids/guard, Army +1.
 *   - Warriors: Frontier combat, strong vs Pale, Army +2.
 *   - Gangsters: Thieves' union, tolls on convoys, deniable, Public -2, Crown -1.
 */

export type HireTier =
  | 'LOCALS'
  | 'SPECIALISTS'
  | 'MERCENARIES'
  | 'WARRIORS'
  | 'GANGSTERS';

export interface HireTierDefinition {
  readonly tier: HireTier;
  readonly title: string;
  readonly costDesc: string;
  readonly fieldcraft: string;
  readonly estateSignal: string;
  readonly estateDeltas: {
    crown: number;
    army: number;
    public: number;
  };
}

export const HIRE_TIERS: readonly HireTierDefinition[] = [
  {
    tier: 'LOCALS',
    title: 'Settlement Locals',
    costDesc: 'Standard commodity rations (1x Food/Soap)',
    fieldcraft: '+10% haul speed across home territory',
    estateSignal: 'Public-friendly (+1 Public per contract)',
    estateDeltas: { crown: 0, army: 0, public: 1 },
  },
  {
    tier: 'SPECIALISTS',
    title: 'Master Specialists',
    costDesc: 'Mid commodity wage (2x Salve/Tonics)',
    fieldcraft: '+40% yield on assigned craft benches',
    estateSignal: 'Crown-favored (+1 Crown per contract)',
    estateDeltas: { crown: 1, army: 0, public: 0 },
  },
  {
    tier: 'MERCENARIES',
    title: 'The Brass Company (Mercenaries)',
    costDesc: '3x wage in Trade value (Copper / Ingot)',
    fieldcraft: '+50% combat advantage in raids & watch garrison',
    estateSignal: 'Army-favored (+1 Army per contract)',
    estateDeltas: { crown: 0, army: 1, public: 0 },
  },
  {
    tier: 'WARRIORS',
    title: 'Frontier Steppe Warriors',
    costDesc: 'Commodity wage + forged weapons upfront',
    fieldcraft: 'Strongest defense against Pale raids',
    estateSignal: 'Army-favored (+2 Army per contract)',
    estateDeltas: { crown: 0, army: 2, public: -1 },
  },
  {
    tier: 'GANGSTERS',
    title: 'The Guild of Thorns',
    costDesc: 'Crate of tonics + 20% toll skimming',
    fieldcraft: 'Silently eliminates dissident threats and rivals',
    estateSignal: 'Illicit and deniable (Public -2, Crown -1)',
    estateDeltas: { crown: -1, army: 0, public: -2 },
  },
];
