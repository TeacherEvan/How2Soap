/**
 * ES-3 Colony ↔ Chemistry Couplings
 * 
 * Three read-points behind featureFlags.colonyChemistryLink:
 * 1. Labor → quality: APPRENTICE_CHEMIST improves mini-game tolerances
 * 2. Unrest → spoilage: low morale/strike increases spoilage/rupture
 * 3. Crash → clumsiness: CRASH phase colonist reduces tolerances
 * 
 * All effects use seeded RNG; flag off ⇒ bit-identical to M0.
 */

// No external dependencies needed

export interface CouplingConfig {
  enabled: boolean;
  rngSeed: number;
}

export interface LaborQualityEffect {
  /** Trace target reduction: 12 → 9 strokes */
  traceTargetReduction: number;
  /** Phase-2 band widening: 80-95 → 78-96 °C */
  phase2BandWiden: number;
}

export interface UnrestSpoilageEffect {
  /** Per-batch spoilage roll chance (0-1) */
  spoilageChance: number;
  /** Vessel rupture severity increase (+1) */
  ruptureSeverityIncrease: number;
}

export interface CrashClumsinessEffect {
  /** Phase-1 tolerance reduction: -4% */
  phase1ToleranceReduction: number;
  /** Phase-2 band reduction: -4°C */
  phase2BandReduction: number;
}

export interface CouplingEffects {
  laborQuality: LaborQualityEffect | null;
  unrestSpoilage: UnrestSpoilageEffect | null;
  crashClumsiness: CrashClumsinessEffect | null;
}

interface ColonistState {
  archetype: string;
  assignedVessel?: number;
  status?: string;
  morale?: number;
  activeStimulant?: {
    phase: 'BOOST' | 'CRASH';
  } | null;
}

/**
 * Determines coupling effects based on colony state.
 * All random rolls use seeded RNG for determinism.
 */
export function computeCouplingEffects(
  config: CouplingConfig,
  colony: {
    colonists: ColonistState[];
  }
): CouplingEffects {
  if (!config.enabled) {
    return {
      laborQuality: null,
      unrestSpoilage: null,
      crashClumsiness: null,
    };
  }

  // 1. Labor → quality: Check for APPRENTICE_CHEMIST assigned to vessel (or general camp labor if no specific vessel assignment)
  const hasApprenticeChemist = colony.colonists.some(
    c => c.archetype === 'APPRENTICE_CHEMIST' && (c.assignedVessel !== undefined || c.status !== 'STRIKE')
  );

  const laborQuality = hasApprenticeChemist
    ? {
        traceTargetReduction: 3, // 12 → 9
        phase2BandWiden: 2, // 80-95 → 78-96 °C (widen by 2°C each side)
      }
    : null;

  // 2. Unrest → spoilage: mean morale < 40 or any STRIKE
  const meanMorale = colony.colonists.length > 0
    ? colony.colonists.reduce((sum, c) => sum + (c.morale ?? 50), 0) / colony.colonists.length
    : 50;
  const hasStrike = colony.colonists.some((c) => c.status === 'STRIKE');
  const unrestTriggered = meanMorale < 40 || hasStrike;

  const unrestSpoilage = unrestTriggered
    ? {
        spoilageChance: 0.15, // 15% per-batch spoilage roll
        ruptureSeverityIncrease: 1,
      }
    : null;

  // 3. Crash → clumsiness: any colonist in CRASH phase
  const hasCrashColonist = colony.colonists.some(
    c => (c.status === 'CRASH' || c.activeStimulant?.phase === 'CRASH') && (c.assignedVessel !== undefined || c.status !== 'STRIKE')
  );

  const crashClumsiness = hasCrashColonist
    ? {
        phase1ToleranceReduction: 4, // -4%
        phase2BandReduction: 4, // -4°C
      }
    : null;

  return {
    laborQuality,
    unrestSpoilage,
    crashClumsiness,
  };
}

/**
 * Roll for per-batch spoilage (seeded).
 * Returns true if batch spoils.
 */
export function rollSpoilage(rng: () => number, chance: number): boolean {
  return rng() < chance;
}

/**
 * Apply coupling effects to mini-game configuration.
 * Returns modified config for SoapKettleMiniGame.
 */
export function applyCouplingsToMiniGame(
  baseConfig: {
    targetStrokes: number; // default 12
    phase2MinTemp: number; // default 80
    phase2MaxTemp: number; // default 95
    phase1Tolerance: number; // default 45-55% (range 10%)
    phase2Tolerance: number; // default ±7.5°C around 87.5
  },
  effects: CouplingEffects
): typeof baseConfig {
  const config = { ...baseConfig };

  if (effects.laborQuality) {
    // Labor → quality improvements
    config.targetStrokes = Math.max(1, config.targetStrokes - effects.laborQuality.traceTargetReduction);
    config.phase2MinTemp = Math.max(60, config.phase2MinTemp - effects.laborQuality.phase2BandWiden);
    config.phase2MaxTemp = Math.min(110, config.phase2MaxTemp + effects.laborQuality.phase2BandWiden);
  }

  if (effects.crashClumsiness) {
    // Crash → clumsiness reductions
    config.phase1Tolerance = Math.max(1, config.phase1Tolerance - effects.crashClumsiness.phase1ToleranceReduction);
    config.phase2MinTemp = Math.max(60, config.phase2MinTemp - effects.crashClumsiness.phase2BandReduction / 2);
    config.phase2MaxTemp = Math.min(110, config.phase2MaxTemp - effects.crashClumsiness.phase2BandReduction / 2);
  }

  return config;
}

/**
 * Create seeded RNG for coupling rolls.
 */
export function createCouplingRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}