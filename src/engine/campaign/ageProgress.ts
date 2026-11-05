/**
 * Age Progression, Dedications, and The Turning
 *
 * Implements §6.2, §6.3, §8.4 of the Civ VII 4X Conversion Plan (v8):
 * - Age progress meter (0..100)
 * - Three Age I Civilizations: Ash Walkers, Shore Clan, Salt Gatherers
 * - Five default Dedications (+ earned)
 * - Turning status & choices
 */

export interface CivLineage {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly description: string;
  readonly perk: string;
}

export const AGE_I_CIVS: readonly CivLineage[] = [
  {
    id: 'ash_walkers',
    name: 'The Ash Walkers',
    age: 1,
    description: 'Masters of kilns, potash lye, and scrub-clearing.',
    perk: '+20% Potash yield from hardwood ash; kilning requires 15% less heat.',
  },
  {
    id: 'shore_clan',
    name: 'The Shore Clan',
    age: 1,
    description: 'Maritime scavengers adept at tidal salt pans and tallow extraction.',
    perk: '+25% Brine harvesting speed; fish oils provide stable saponification base.',
  },
  {
    id: 'salt_gatherers',
    name: 'The Salt Gatherers',
    age: 1,
    description: 'Steppe traders guarding the white crust of the salt trails.',
    perk: '+15% Trade value for mineral salts; meat preserved with half the salt quantity.',
  },
];

export interface DedicationDef {
  readonly id: string;
  readonly name: string;
  readonly category: 'military' | 'cultural' | 'economic' | 'scientific';
  readonly description: string;
  readonly effect: string;
}

export const DEDICATIONS: readonly DedicationDef[] = [
  {
    id: 'second_wind',
    name: 'Second Wind',
    category: 'military',
    description: 'Laborers sustain frantic work shifts with rhythmic songs.',
    effect: '+12% assigned-job yield across all active settlements.',
  },
  {
    id: 'winters_remedy',
    name: 'Winter\'s Remedy',
    category: 'cultural',
    description: 'Herbal tonics and warm hearth clothes fend off the frost.',
    effect: '-1 crisis severity step on cold-snap and fever-wave rolls.',
  },
  {
    id: 'quarter_under_arms',
    name: 'Quarter Under Arms',
    category: 'military',
    description: 'Every township trains an armed cadre ready at dawn.',
    effect: 'Guards repel wolf packs and minor raiders automatically without morale loss.',
  },
  {
    id: 'salted_granary',
    name: 'The Salted Granary',
    category: 'economic',
    description: 'Brine curing extends all food stores across long winters.',
    effect: 'Paddock and camp rations last 30% longer.',
  },
  {
    id: 'alembic_whisper',
    name: 'Alembic Whisper',
    category: 'scientific',
    description: 'Precision vessel management minimizes volatile spillage.',
    effect: '+1 Discovery per turn while any experiment is in flight.',
  },
];

export interface AgeProgressState {
  currentAge: number; // 1 = Ash, 2 = Brass, 3 = Volta
  progress: number;   // 0..100
  selectedCivId: string | null;
  chosenDedications: string[];
  attributePoints: number;
  turningAvailable: boolean;
}

export function createInitialAgeProgress(): AgeProgressState {
  return {
    currentAge: 1,
    progress: 0,
    selectedCivId: 'ash_walkers',
    chosenDedications: [],
    attributePoints: 1,
    turningAvailable: false,
  };
}

export function addAgeProgress(state: AgeProgressState, delta: number): AgeProgressState {
  const newProgress = Math.min(100, state.progress + delta);
  return {
    ...state,
    progress: newProgress,
    turningAvailable: newProgress >= 100,
  };
}
