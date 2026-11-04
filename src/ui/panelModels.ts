import { CRISIS_DEFS, type CrisisSnapshot } from '../engine/crisis';

export interface ConditionState {
  fever?: boolean;
  systemicInfection?: boolean;
  woundContamination?: boolean;
  dead?: boolean;
}

export interface PlayerStateInput {
  glucoseKcal: number;
  conditions?: ConditionState;
}

export interface BannerItem {
  id: string;
  text: string;
  severity: 'info' | 'warn' | 'critical';
}

export interface HeldItemInput {
  id: string;
  count: number;
  massKg?: number;
}

export interface TreatmentAction {
  id: string;
  name: string;
  effects: string;
  conditionTarget: string;
}

export const TREATMENTS: Record<string, { name: string; effects: string; clears: keyof ConditionState }> = {
  SALINE_RINSE: {
    name: 'Saline Rinse',
    effects: 'Flushes debris and cleans surface bacteria; clears wound contamination',
    clears: 'woundContamination',
  },
  ETHANOL_DISINFECTANT: {
    name: 'Ethanol Disinfectant',
    effects: 'Sterilizes active wound site; clears wound contamination',
    clears: 'woundContamination',
  },
  SALICYLIC_ACID_TINCTURE: {
    name: 'Salicylic Tincture',
    effects: 'Antipyretic willow extract; reduces and clears pyrogenic fever',
    clears: 'fever',
  },
  SALICYLIC_TINCTURE: {
    name: 'Salicylic Tincture',
    effects: 'Antipyretic willow extract; reduces and clears pyrogenic fever',
    clears: 'fever',
  },
  PENICILLIN_DOSE: {
    name: 'Penicillin Dose',
    effects: 'Systemic broad-spectrum antibiotic; destroys sepsis and systemic infection',
    clears: 'systemicInfection',
  },
};

/** Crisis snapshot as consumed by UI (kept structural to avoid engine coupling in tests). */
export interface CrisisUiState {
  phase: 'idle' | 'telegraph' | 'active';
  telegraph: { crisisId: string; severity: number; watchesUntil: number } | null;
  active: { crisisId: string; title: string; severity: number } | null;
}

export function bannerModel(
  player: PlayerStateInput,
  crisis?: CrisisUiState | CrisisSnapshot | null,
): BannerItem[] {
  const banners: BannerItem[] = [];
  const c = player.conditions ?? {};

  if (c.dead) {
    banners.push({
      id: 'dead',
      text: '☠ Fatal collapse — the wild has reclaimed you',
      severity: 'critical',
    });
    return banners;
  }

  if (c.systemicInfection) {
    banners.push({
      id: 'sepsis',
      text: '🧫 Sepsis — only Penicillin will do',
      severity: 'critical',
    });
  } else if (c.fever) {
    banners.push({
      id: 'fever',
      text: '🌡 Fever 38.6° — administer Salicylic Tincture',
      severity: 'warn',
    });
  } else if (c.woundContamination) {
    banners.push({
      id: 'wound',
      text: '🩹 Wound festering! Treat with Saline Rinse or Antiseptic',
      severity: 'warn',
    });
  }

  if (player.glucoseKcal < 250) {
    banners.push({
      id: 'hunger',
      text: '🩸 Ravenous — glucose below 250 kcal',
      severity: 'warn',
    });
  }

  if (crisis?.phase === 'telegraph' && crisis.telegraph) {
    const def = CRISIS_DEFS[crisis.telegraph.crisisId as keyof typeof CRISIS_DEFS];
    const severity = crisis.telegraph.severity;
    banners.push({
      id: 'crisis-telegraph',
      text: `⚠ Crisis brewing — ${def?.title ?? crisis.telegraph.crisisId} (${crisis.telegraph.watchesUntil} watch${crisis.telegraph.watchesUntil === 1 ? '' : 'es'})`,
      severity: severity >= 3 ? 'critical' : severity === 2 ? 'warn' : 'info',
    });
  }

  return banners;
}

export function treatmentModel(
  heldItems: readonly HeldItemInput[],
  player: PlayerStateInput,
): TreatmentAction[] {
  const c = player.conditions ?? {};
  const actions: TreatmentAction[] = [];

  for (const item of heldItems) {
    if (item.count <= 0) continue;
    const def = TREATMENTS[item.id];
    if (!def) continue;

    // Is the condition this medicine treats currently active?
    if (c[def.clears]) {
      actions.push({
        id: item.id,
        name: def.name,
        effects: def.effects,
        conditionTarget: def.clears,
      });
    }
  }

  return actions;
}
