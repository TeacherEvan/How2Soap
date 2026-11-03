import type { PlayerMetabolismState } from './metabolism';

export interface ConditionEvent { message: string }

/**
 * Escalates wound → fever → sepsis → death based on untreated time.
 * Called from both tick() (10 Hz) and advance() (Sleep) for fast-forward parity.
 */
export function escalateConditions(player: PlayerMetabolismState, dtHours: number): ConditionEvent[] {
  const out: ConditionEvent[] = [];
  const c = player.conditions;

  if (c.woundContamination) {
    player.woundOnsetSeconds = (player.woundOnsetSeconds ?? 0) + dtHours * 3600;
    if (!c.fever && player.woundOnsetSeconds >= 12 * 3600) {
      c.fever = true;
      out.push({ message: 'A flush crawls up your neck — fever 38.6°.' });
    }
  }

  if (c.fever && !c.systemicInfection) {
    player.sepsisOnsetSeconds = (player.sepsisOnsetSeconds ?? 0) + dtHours * 3600;
    if (player.sepsisOnsetSeconds >= 24 * 3600) {
      c.systemicInfection = true;
      out.push({ message: 'Chills race down your spine. This is sepsis.' });
      player.sepsisOnsetSeconds = 0; // restart fuse for the fatal stage
    }
  }

  if (c.systemicInfection) {
    player.sepsisOnsetSeconds = (player.sepsisOnsetSeconds ?? 0) + dtHours * 3600;
    if (player.sepsisOnsetSeconds >= 48 * 3600) player.dead = true;
  }

  return out;
}