/**
 * Notable Citizens & Cohort Clinical Trials (§6.19.4)
 *
 * Implements:
 * - 24 notable named citizens tracked in save v3.
 * - Cohort trials: testing a chemical release on a specific settlement role
 *   (e.g., miners, colliers, tanners, dock hands) over a 3-turn cycle.
 * - Completing a cohort trial yields +3 Innovation and permanently unlocks
 *   the precise dose curve / formulation perk (+5% yield or discovered efficacy).
 * - Full releases grant immediate broad effects but no scientific understanding;
 *   cohort trials represent the scientific method as a mechanic.
 */

export interface NotableCitizen {
  readonly id: string;
  readonly name: string;
  readonly role: 'COLLIER' | 'MINER' | 'TANNER' | 'DOCK_HAND' | 'WEAVER' | 'HERBALIST';
  readonly settlementId: string;
  treatmentTag: string | null; // e.g. 'WILLOW_TEA_TRIAL', 'NITROUS_DOSE'
  outcomeNotes: string;
  isAlive: boolean;
}

export interface CohortTrial {
  readonly trialId: string;
  readonly role: NotableCitizen['role'];
  readonly settlementId: string;
  readonly drugItemId: string;
  readonly startTurn: number;
  readonly durationTurns: number; // 3 turns
  turnsElapsed: number;
  completed: boolean;
  fouled: boolean;
}

export interface NotablesState {
  citizens: NotableCitizen[];
  activeTrials: CohortTrial[];
  completedTrialsCount: number;
  unlockedDosePerks: string[]; // Set of unlocked formulation perks
  totalInnovationEarned: number;
}

export const SEEDED_NOTABLE_NAMES: readonly { name: string; role: NotableCitizen['role'] }[] = [
  { name: 'Berto the Collier', role: 'COLLIER' },
  { name: 'Gareth of the Pit', role: 'MINER' },
  { name: 'Elda the Tanner', role: 'TANNER' },
  { name: 'Kari Dock-Watcher', role: 'DOCK_HAND' },
  { name: 'Selene the Weaver', role: 'WEAVER' },
  { name: 'Old Martha', role: 'HERBALIST' },
  { name: 'Bran the Stoker', role: 'COLLIER' },
  { name: 'Rowan Deep-Delver', role: 'MINER' },
  { name: 'Tomas the Currier', role: 'TANNER' },
  { name: 'Vito Rope-Hauler', role: 'DOCK_HAND' },
  { name: 'Anwen the Spinner', role: 'WEAVER' },
  { name: 'Morwenna Root-Seeker', role: 'HERBALIST' },
  { name: 'Doran Iron-Sieve', role: 'MINER' },
  { name: 'Kip Black-Thumb', role: 'COLLIER' },
  { name: 'Nell Hide-Scraper', role: 'TANNER' },
  { name: 'Jann Wharf-Rat', role: 'DOCK_HAND' },
  { name: 'Marek Loom-Turner', role: 'WEAVER' },
  { name: 'Briar Marsh-Wife', role: 'HERBALIST' },
  { name: 'Carrow Ore-Breaker', role: 'MINER' },
  { name: 'Luka Kiln-Master', role: 'COLLIER' },
  { name: 'Dara Fat-Render', role: 'TANNER' },
  { name: 'Pavel the Lighterman', role: 'DOCK_HAND' },
  { name: 'Tessa Spool-Hand', role: 'WEAVER' },
  { name: 'Ivor Bitter-Root', role: 'HERBALIST' },
];

export function createInitialNotables(): NotablesState {
  const citizens: NotableCitizen[] = SEEDED_NOTABLE_NAMES.map((entry, index) => ({
    id: `notable_${index + 1}`,
    name: entry.name,
    role: entry.role,
    settlementId: 'settlement_capital',
    treatmentTag: null,
    outcomeNotes: 'In vigorous health at camp.',
    isAlive: true,
  }));

  return {
    citizens,
    activeTrials: [],
    completedTrialsCount: 0,
    unlockedDosePerks: [],
    totalInnovationEarned: 0,
  };
}

export function startCohortTrial(
  state: NotablesState,
  role: NotableCitizen['role'],
  drugItemId: string,
  currentTurn: number,
  settlementId = 'settlement_capital',
): { ok: boolean; message: string; trial?: CohortTrial } {
  // Check if trial already active for this role
  const existing = state.activeTrials.find((t) => t.role === role && !t.completed);
  if (existing) {
    return { ok: false, message: `A clinical cohort trial is already in progress for ${role}s.` };
  }

  const trial: CohortTrial = {
    trialId: `trial_${role}_${drugItemId}_${currentTurn}`,
    role,
    settlementId,
    drugItemId,
    startTurn: currentTurn,
    durationTurns: 3,
    turnsElapsed: 0,
    completed: false,
    fouled: false,
  };

  state.activeTrials.push(trial);

  // Tag corresponding citizens
  for (const c of state.citizens) {
    if (c.role === role && c.settlementId === settlementId && c.isAlive) {
      c.treatmentTag = `TRIAL_${drugItemId}`;
      c.outcomeNotes = `Administered experimental cohort dose of ${drugItemId}. Under observation.`;
    }
  }

  return {
    ok: true,
    message: `Commenced 3-turn cohort trial of ${drugItemId} on all ${role}s in ${settlementId}.`,
    trial,
  };
}

export interface StepTrialsResult {
  completedTrials: CohortTrial[];
  innovationGained: number;
  recapNotes: string[];
}

export function stepCohortTrials(
  state: NotablesState,
  isBatchSour = false,
): StepTrialsResult {
  const completedTrials: CohortTrial[] = [];
  const recapNotes: string[] = [];
  let innovationGained = 0;

  for (const trial of state.activeTrials) {
    if (trial.completed) continue;

    trial.turnsElapsed += 1;

    if (isBatchSour) {
      trial.fouled = true;
      trial.completed = true;
      recapNotes.push(`The experimental batch of ${trial.drugItemId} soured! The trial on ${trial.role}s was fouled; Public -6.`);
      for (const c of state.citizens) {
        if (c.role === trial.role && c.treatmentTag === `TRIAL_${trial.drugItemId}`) {
          c.outcomeNotes = 'Suffered convulsions from soured trial batch. Survived after treatment.';
          c.treatmentTag = null;
        }
      }
      continue;
    }

    if (trial.turnsElapsed >= trial.durationTurns) {
      trial.completed = true;
      completedTrials.push(trial);
      state.completedTrialsCount += 1;
      state.totalInnovationEarned += 3;
      innovationGained += 3;

      const perkName = `PERK_${trial.drugItemId}_PRECISION`;
      if (!state.unlockedDosePerks.includes(perkName)) {
        state.unlockedDosePerks.push(perkName);
      }

      // Author flavor for notable outcomes
      const subject = state.citizens.find((c) => c.role === trial.role);
      const subjectName = subject ? subject.name : `The ${trial.role}`;
      const note = `${subjectName} demonstrated consistent vigor without tremors. Precision dose-curve mapped! (+3 Innovation, permanent +5% efficacy unlocked).`;
      recapNotes.push(note);

      for (const c of state.citizens) {
        if (c.role === trial.role && c.treatmentTag === `TRIAL_${trial.drugItemId}`) {
          c.outcomeNotes = 'Trial completed with distinction. Full physiological adaptation observed.';
          c.treatmentTag = null;
        }
      }
    }
  }

  return {
    completedTrials,
    innovationGained,
    recapNotes,
  };
}
