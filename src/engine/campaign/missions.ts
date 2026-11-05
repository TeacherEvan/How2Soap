/**
 * Missions & Operatives Engine (§6.30)
 *
 * Five Operatives you may recruit:
 * 1. Courier (Subtle/Speed; Dress the wound, Scout)
 * 2. Alchemist-Spy (Subtle/Science; Steal the schema, Scout)
 * 3. Brute (Bold/Strength; Raise the levy, Poison the hoard)
 * 4. Whisper (Silken/Thorn; Silence the pamphletist, Scout)
 * 5. Paladin (Bold/Zeal; Raise the levy, Defend marches)
 *
 * 7 Mission Verbs:
 * - SCOUT
 * - STEAL_SCHEMA
 * - POISON_HOARD
 * - RAISE_LEVY
 * - DRESS_WOUND
 * - SILENCE_PAMPHLETIST
 * - EXTRACT_WITNESS
 *
 * Seeded resolution triads: Clean / Partial / Compromised / Disaster
 * Operatives who fail twice are dismissed for cowardice.
 */

export type OperativeRole = 'COURIER' | 'ALCHEMIST_SPY' | 'BRUTE' | 'WHISPER' | 'PALADIN';
export type SkillType = 'SUBTLE' | 'BOLD' | 'SILKEN';

export interface Operative {
  id: string;
  name: string;
  role: OperativeRole;
  wagePerTurn: number;
  loyalty: number; // 0..100
  primarySkill: SkillType;
  skillValue: number; // 1..5
  failureCount: number;
  isDismissed: boolean;
}

export type MissionVerb =
  | 'SCOUT'
  | 'STEAL_SCHEMA'
  | 'POISON_HOARD'
  | 'RAISE_LEVY'
  | 'DRESS_WOUND'
  | 'SILENCE_PAMPHLETIST'
  | 'EXTRACT_WITNESS';

export type MissionOutcomeBand = 'CLEAN' | 'PARTIAL' | 'COMPROMISED' | 'DISASTER';

export interface MissionDef {
  readonly verb: MissionVerb;
  readonly title: string;
  readonly desc: string;
  readonly requiredSkill: SkillType;
  readonly difficulty: number; // 1..5
}

export const MISSIONS_CATALOG: readonly MissionDef[] = [
  {
    verb: 'SCOUT',
    title: 'Scout the Frontier',
    desc: 'Survey 2 hex rings ahead; reveals ruins, deposits, and hostile movements.',
    requiredSkill: 'SUBTLE',
    difficulty: 2,
  },
  {
    verb: 'STEAL_SCHEMA',
    title: 'Steal Alchemical Schema',
    desc: 'Infiltrate rival scriptorium to copy formula secrets.',
    requiredSkill: 'SUBTLE',
    difficulty: 4,
  },
  {
    verb: 'POISON_HOARD',
    title: 'Poison the Hoard',
    desc: 'Contaminate a rival or Pale forward siege depot with bitter alkaloids.',
    requiredSkill: 'BOLD',
    difficulty: 4,
  },
  {
    verb: 'RAISE_LEVY',
    title: 'Raise Frontier Levy',
    desc: 'Rally town guards and muster irregulars; +2 Guard immediately.',
    requiredSkill: 'BOLD',
    difficulty: 2,
  },
  {
    verb: 'DRESS_WOUND',
    title: 'Dress the Wounded',
    desc: 'Deliver salves and antiseptics to remote hamlets; Public Health +5.',
    requiredSkill: 'SILKEN',
    difficulty: 2,
  },
  {
    verb: 'SILENCE_PAMPHLETIST',
    title: 'Silence the Pamphleteer',
    desc: 'Quiet seditious printers in the market square. Public -2, Crown +4.',
    requiredSkill: 'SILKEN',
    difficulty: 3,
  },
  {
    verb: 'EXTRACT_WITNESS',
    title: 'Extract Vulnerable Witness',
    desc: 'Rescue a notable citizen or defector from occupied territory.',
    requiredSkill: 'SUBTLE',
    difficulty: 3,
  },
];

export interface MissionsState {
  operatives: Operative[];
  missionsDispatchedCount: number;
}

export const INITIAL_OPERATIVES: readonly Operative[] = [
  {
    id: 'op_courier',
    name: 'Milo Swift',
    role: 'COURIER',
    wagePerTurn: 2,
    loyalty: 80,
    primarySkill: 'SUBTLE',
    skillValue: 3,
    failureCount: 0,
    isDismissed: false,
  },
  {
    id: 'op_spy',
    name: 'Alchemist Ren',
    role: 'ALCHEMIST_SPY',
    wagePerTurn: 4,
    loyalty: 75,
    primarySkill: 'SUBTLE',
    skillValue: 4,
    failureCount: 0,
    isDismissed: false,
  },
  {
    id: 'op_brute',
    name: 'Kagan Iron-Arm',
    role: 'BRUTE',
    wagePerTurn: 3,
    loyalty: 85,
    primarySkill: 'BOLD',
    skillValue: 4,
    failureCount: 0,
    isDismissed: false,
  },
  {
    id: 'op_whisper',
    name: 'Lady Vespera',
    role: 'WHISPER',
    wagePerTurn: 3,
    loyalty: 70,
    primarySkill: 'SILKEN',
    skillValue: 3,
    failureCount: 0,
    isDismissed: false,
  },
  {
    id: 'op_paladin',
    name: 'Sir Gareth of the Brand',
    role: 'PALADIN',
    wagePerTurn: 5,
    loyalty: 90,
    primarySkill: 'BOLD',
    skillValue: 4,
    failureCount: 0,
    isDismissed: false,
  },
];

export function createInitialMissions(): MissionsState {
  return {
    operatives: INITIAL_OPERATIVES.map((o) => ({ ...o })),
    missionsDispatchedCount: 0,
  };
}

export function computeMissionProbabilities(
  operative: Operative,
  mission: MissionDef,
): { cleanPct: number; partialPct: number; compromisedPct: number; disasterPct: number } {
  let advantage = operative.skillValue - mission.difficulty;
  if (operative.primarySkill === mission.requiredSkill) {
    advantage += 1;
  }

  // Base percentages shifted by advantage
  let cleanPct = Math.max(10, Math.min(80, 45 + advantage * 15));
  let partialPct = Math.max(10, Math.min(50, 30 + advantage * 5));
  let compromisedPct = Math.max(5, Math.min(40, 20 - advantage * 10));
  let disasterPct = Math.max(0, 100 - (cleanPct + partialPct + compromisedPct));

  return { cleanPct, partialPct, compromisedPct, disasterPct };
}

export interface ResolveMissionResult {
  outcome: MissionOutcomeBand;
  success: boolean;
  operativeDismissed: boolean;
  message: string;
  estateDeltas: { crown: number; army: number; public: number };
}

export function executeMission(
  state: MissionsState,
  operativeId: string,
  verb: MissionVerb,
  rngRoll = 0.5,
): ResolveMissionResult {
  const op = state.operatives.find((o) => o.id === operativeId);
  if (!op || op.isDismissed) {
    return {
      outcome: 'DISASTER',
      success: false,
      operativeDismissed: false,
      message: 'Operative not available.',
      estateDeltas: { crown: 0, army: 0, public: 0 },
    };
  }

  const mission = MISSIONS_CATALOG.find((m) => m.verb === verb);
  if (!mission) {
    return {
      outcome: 'DISASTER',
      success: false,
      operativeDismissed: false,
      message: 'Unknown mission.',
      estateDeltas: { crown: 0, army: 0, public: 0 },
    };
  }

  state.missionsDispatchedCount += 1;
  const probs = computeMissionProbabilities(op, mission);

  let outcome: MissionOutcomeBand;
  const rollPct = rngRoll * 100;

  if (rollPct < probs.cleanPct) {
    outcome = 'CLEAN';
  } else if (rollPct < probs.cleanPct + probs.partialPct) {
    outcome = 'PARTIAL';
  } else if (rollPct < probs.cleanPct + probs.partialPct + probs.compromisedPct) {
    outcome = 'COMPROMISED';
  } else {
    outcome = 'DISASTER';
  }

  let operativeDismissed = false;
  let message = '';
  let estateDeltas = { crown: 0, army: 0, public: 0 };
  let success = false;

  switch (outcome) {
    case 'CLEAN':
      success = true;
      op.loyalty = Math.min(100, op.loyalty + 5);
      message = `${op.name} completed «${mission.title}» flawlessly without detection!`;
      estateDeltas = { crown: 2, army: 2, public: 1 };
      break;

    case 'PARTIAL':
      success = true;
      message = `${op.name} achieved the primary objective for «${mission.title}», but withdrew with minor friction.`;
      estateDeltas = { crown: 1, army: 1, public: 0 };
      break;

    case 'COMPROMISED':
      success = false;
      op.failureCount += 1;
      op.loyalty = Math.max(0, op.loyalty - 15);
      message = `${op.name} was compromised during «${mission.title}»! Enemy watches were alerted.`;
      estateDeltas = { crown: -1, army: -1, public: -2 };
      break;

    case 'DISASTER':
      success = false;
      op.failureCount += 1;
      op.loyalty = Math.max(0, op.loyalty - 30);
      message = `Disaster during «${mission.title}»! Operative was cornered and fled into hiding.`;
      estateDeltas = { crown: -3, army: -2, public: -4 };
      break;
  }

  if (op.failureCount >= 2) {
    op.isDismissed = true;
    operativeDismissed = true;
    message += ` Following repeated failures, ${op.name} has been permanently dismissed for cowardice of profession.`;
  }

  return {
    outcome,
    success,
    operativeDismissed,
    message,
    estateDeltas,
  };
}
