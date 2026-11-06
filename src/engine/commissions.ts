import { COMMISSION_TEMPLATES, type CommissionTemplate } from '../data/commissionTemplates';

export interface ActiveCommission {
  id: string;
  label: string;
  progress: number;
  target: number;
  renownReward: number;
  complete: boolean;
  claimed: boolean;
}

export interface CommissionsState {
  day: number;
  active: ActiveCommission[];
  streak: number;
  lastClaimDay: number;
  totalClaimed: number;
}

export function createInitialCommissionsState(day = 1): CommissionsState {
  return {
    day,
    active: generateDailyCommissions(day, 1337),
    streak: 0,
    lastClaimDay: 0,
    totalClaimed: 0,
  };
}

/**
 * Deterministic PRNG seeded by worldSeed ^ day.
 */
function seededRNG(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function generateDailyCommissions(day: number, worldSeed = 1337, chapter = 0): ActiveCommission[] {
  const rng = seededRNG((worldSeed ^ (day * 31337)) >>> 0);
  const eligible = COMMISSION_TEMPLATES.filter((t) => {
    if (t.minDay && day < t.minDay) return false;
    if (t.minChapter && chapter < t.minChapter) return false;
    return true;
  });

  const pool = [...eligible];
  const chosen: CommissionTemplate[] = [];

  while (chosen.length < 3 && pool.length > 0) {
    const totalWeight = pool.reduce((acc, t) => acc + t.weight, 0);
    let rand = rng() * totalWeight;
    let pickedIndex = 0;
    for (let i = 0; i < pool.length; i++) {
      rand -= pool[i].weight;
      if (rand <= 0) {
        pickedIndex = i;
        break;
      }
    }
    chosen.push(pool[pickedIndex]);
    pool.splice(pickedIndex, 1);
  }

  return chosen.map((tmpl) => ({
    id: tmpl.id,
    label: tmpl.label,
    progress: 0,
    target: tmpl.target,
    renownReward: tmpl.renownReward,
    complete: false,
    claimed: false,
  }));
}

export function evaluateCommissions(
  commissionsState: CommissionsState,
  snapshot: any,
  clientState: any
): { hasNewCompletion: boolean } {
  let hasNewCompletion = false;

  for (const comm of commissionsState.active) {
    if (comm.claimed) continue;
    const tmpl = COMMISSION_TEMPLATES.find((t) => t.id === comm.id);
    if (!tmpl) continue;

    const currentProgress = tmpl.objective(snapshot, clientState);
    comm.progress = Math.min(comm.target, Math.max(comm.progress, currentProgress));

    if (comm.progress >= comm.target && !comm.complete) {
      comm.complete = true;
      hasNewCompletion = true;
    }
  }

  return { hasNewCompletion };
}

export function claimCommission(
  commissionsState: CommissionsState,
  commissionId: string,
  currentDay: number
): { success: boolean; renownReward: number; streakMilestone: boolean } {
  const comm = commissionsState.active.find((c) => c.id === commissionId);
  if (!comm || !comm.complete || comm.claimed) {
    return { success: false, renownReward: 0, streakMilestone: false };
  }

  comm.claimed = true;
  commissionsState.totalClaimed += 1;

  // Streak logic
  if (commissionsState.lastClaimDay === currentDay) {
    // Already claimed today, streak stays intact
  } else if (commissionsState.lastClaimDay === currentDay - 1) {
    commissionsState.streak += 1;
    commissionsState.lastClaimDay = currentDay;
  } else {
    // Missed a day or first claim
    commissionsState.streak = 1;
    commissionsState.lastClaimDay = currentDay;
  }

  const streakMilestone = commissionsState.streak > 0 && commissionsState.streak % 7 === 0;

  return {
    success: true,
    renownReward: comm.renownReward,
    streakMilestone,
  };
}
