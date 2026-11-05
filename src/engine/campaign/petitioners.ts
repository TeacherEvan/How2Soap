/**
 * Milestone M6: The Petitioners' Board — Community Complaints & Demands
 * (§6.23)
 *
 * Petitions arrive from citizens/guilds across settlements with 4 resolution choices:
 * - SETTLE: Spend commodity/trade, fulfills demand, boosts Estate/Public
 * - DISMISS: Reject complaint, minor loss of Public/Estate, +small payoff or saved expense
 * - DEFER: Delay once by 3 turns, but escalates severity
 * - SCAPEGOAT: Blame another party (dark choice: steep Public -15, Crown +3)
 *
 * If 0 answered 3 turns running -> mob event telegraph (-4 Public next turn).
 * If 5 answered within deadline -> "People's Champion" (+5 Culture/Renown).
 */

export type PetitionEstate = 'crown' | 'army' | 'public';
export type ResolutionChoice = 'SETTLE' | 'DISMISS' | 'DEFER' | 'SCAPEGOAT';

export interface Petition {
  id: string;
  petitioner: string;
  role: string;
  settlementName: string;
  demand: string;
  deadlineTurns: number;
  severity: 1 | 2 | 3;
  estateTag: PetitionEstate;
  isResolved: boolean;
  isDeferred: boolean;
}

export interface PetitionersBoardState {
  petitions: Petition[];
  resolvedCount: number;
  consecutiveUnansweredTurns: number;
  peoplesChampionAwarded: boolean;
}

export function createInitialPetitionersBoard(): PetitionersBoardState {
  return {
    petitions: [
      {
        id: 'pet_tanners_lye',
        petitioner: 'Marta the Tanner',
        role: 'Master Leatherworker',
        settlementName: 'Hearth Keep',
        demand: 'The tanners of Millstreet say the raw lye burns their hands and demand leather tunics or wash balm.',
        deadlineTurns: 4,
        severity: 2,
        estateTag: 'public',
        isResolved: false,
        isDeferred: false,
      },
      {
        id: 'pet_watch_arrears',
        petitioner: 'Captain Vane',
        role: 'Frontier Watch',
        settlementName: 'Hearth Keep',
        demand: 'The garrison watch demands three days wages in arrears or bronze armaments for the eastern gate.',
        deadlineTurns: 5,
        severity: 2,
        estateTag: 'army',
        isResolved: false,
        isDeferred: false,
      },
    ],
    resolvedCount: 0,
    consecutiveUnansweredTurns: 0,
    peoplesChampionAwarded: false,
  };
}

export interface ResolvePetitionResult {
  success: boolean;
  message: string;
  estateDeltas: { crown: number; army: number; public: number };
  awardPeoplesChampion: boolean;
}

export function resolvePetition(
  state: PetitionersBoardState,
  petitionId: string,
  choice: ResolutionChoice,
): ResolvePetitionResult {
  const p = state.petitions.find((item) => item.id === petitionId);
  if (!p) {
    return {
      success: false,
      message: 'Petition not found.',
      estateDeltas: { crown: 0, army: 0, public: 0 },
      awardPeoplesChampion: false,
    };
  }
  if (p.isResolved) {
    return {
      success: false,
      message: 'Petition already resolved.',
      estateDeltas: { crown: 0, army: 0, public: 0 },
      awardPeoplesChampion: false,
    };
  }

  const estateDeltas = { crown: 0, army: 0, public: 0 };
  let message = '';
  let awardPeoplesChampion = false;

  switch (choice) {
    case 'SETTLE': {
      p.isResolved = true;
      state.resolvedCount += 1;
      state.consecutiveUnansweredTurns = 0;
      estateDeltas[p.estateTag] += p.severity * 3;
      estateDeltas.public += 2;
      message = `Settled petition with ${p.petitioner}: The complaint was addressed. ${p.estateTag.toUpperCase()} +${p.severity * 3}, Public +2.`;
      if (state.resolvedCount >= 5 && !state.peoplesChampionAwarded) {
        state.peoplesChampionAwarded = true;
        awardPeoplesChampion = true;
        message += ' [TITLE UNLOCKED: People\'s Champion! +5 Renown/Culture]';
      }
      break;
    }

    case 'DISMISS': {
      p.isResolved = true;
      estateDeltas.public -= p.severity * 2;
      message = `Dismissed petition of ${p.petitioner}: The petitioners left discontent. Public -${p.severity * 2}.`;
      break;
    }

    case 'DEFER': {
      if (p.isDeferred) {
        return {
          success: false,
          message: 'This petition has already been deferred once and cannot be delayed further.',
          estateDeltas: { crown: 0, army: 0, public: 0 },
          awardPeoplesChampion: false,
        };
      }
      p.isDeferred = true;
      p.deadlineTurns += 3;
      p.severity = Math.min(3, p.severity + 1) as 1 | 2 | 3;
      message = `Deferred petition of ${p.petitioner} by 3 turns. Severity escalated to Tier ${p.severity}.`;
      break;
    }

    case 'SCAPEGOAT': {
      p.isResolved = true;
      state.consecutiveUnansweredTurns = 0;
      estateDeltas.public -= 15;
      estateDeltas.crown += 3;
      message = `Scapegoated an outside agitator for the grievance. Crown pleased (+3), but Public outraged (-15).`;
      break;
    }
  }

  return {
    success: true,
    message,
    estateDeltas,
    awardPeoplesChampion,
  };
}

/**
 * Step petitions each turn at dawn.
 */
export function stepPetitions(state: PetitionersBoardState): { mobTelegraph: boolean; expiredCount: number } {
  let expiredCount = 0;
  let activeUnresolved = 0;

  for (const p of state.petitions) {
    if (p.isResolved) continue;
    p.deadlineTurns -= 1;
    if (p.deadlineTurns <= 0) {
      p.isResolved = true;
      expiredCount += 1;
    } else {
      activeUnresolved += 1;
    }
  }

  if (activeUnresolved > 0) {
    state.consecutiveUnansweredTurns += 1;
  } else {
    state.consecutiveUnansweredTurns = 0;
  }

  const mobTelegraph = state.consecutiveUnansweredTurns >= 3;

  return { mobTelegraph, expiredCount };
}
