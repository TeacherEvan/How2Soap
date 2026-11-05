/**
 * Experiments Model — Chemistry-First Turns & Work Scheduling
 *
 * Implements §6.17 of the Civ VII 4X Conversion Plan (v8):
 * - Translates recipe workHours (previously workTicks) into turn durations.
 * - Concurrency capped at 4 + benchBuildings (hard maximum MAX_VESSELS = 32).
 * - Commits and reserves inventory inputs at start.
 * - Handles living processes (fermentation, mash, penicillin) with deterministic sour rolls.
 * - Progresses on turn advance and produces Bench Ledger entries.
 */

export const TURN_HOURS = 24;
export const MAX_EXPERIMENT_VESSELS = 32;

/**
 * Calculates how many campaign turns an experiment takes based on authored work hours.
 * Short bench operations (<= 3 hours) complete within the current turn (1 turn).
 * Longer operations (e.g. 24h fermentation = 1 turn; 48h tanning/penicillin = 2 turns).
 */
export function turnsPerExperiment(workHours: number): number {
  if (workHours <= 3) return 1;
  return Math.max(1, Math.ceil(workHours / TURN_HOURS));
}

/** Sour probability lookup for living cultures per §6.17 */
export const SOUR_CHANCE_BY_RECIPE: Record<string, number> = {
  fermentation: 0.12,
  ferment_mash: 0.12,
  grain_mash: 0.15,
  penicillin_culture: 0.20,
  penicillin_broth: 0.20,
};

export interface ExperimentInstance {
  readonly id: string;
  readonly recipeId: string;
  readonly recipeName: string;
  readonly turnsStarted: number;
  readonly totalTurns: number;
  turnsLeft: number;
  readonly sour: boolean;
  readonly sourChance: number;
  readonly inputsCommitted: Array<{ itemId: string; count: number }>;
  readonly outputsExpected: Array<{ itemId: string; count: number }>;
}

export interface BenchLedgerEntry {
  readonly experimentId: string;
  readonly recipeName: string;
  readonly status: 'completed' | 'in_progress' | 'sour';
  readonly dayStarted: number;
  readonly currentTurn: number;
  readonly totalTurns: number;
  readonly message: string;
}

export interface ExperimentQueueState {
  experiments: ExperimentInstance[];
  nextExperimentId: number;
  benchBuildingsCount: number;
}

export function createExperimentQueue(benchBuildings = 0): ExperimentQueueState {
  return {
    experiments: [],
    nextExperimentId: 1,
    benchBuildingsCount: benchBuildings,
  };
}

export function getMaxConcurrentExperiments(benchBuildingsCount: number): number {
  return Math.min(MAX_EXPERIMENT_VESSELS, 4 + benchBuildingsCount);
}

export interface StartExperimentParams {
  recipeId: string;
  recipeName: string;
  workHours: number;
  currentTurn: number;
  inputs: Array<{ itemId: string; count: number }>;
  outputs: Array<{ itemId: string; count: number }>;
  inventory: Record<string, number>;
  rngNextFloat?: () => number;
}

export interface StartExperimentResult {
  success: boolean;
  reason?: string;
  instance?: ExperimentInstance;
}

/**
 * Attempts to start an experiment by validating concurrency, checking inputs,
 * committing/deducting inventory, and scheduling turns with a seeded sour roll.
 */
export function startExperiment(
  queue: ExperimentQueueState,
  params: StartExperimentParams,
): StartExperimentResult {
  const maxAllowed = getMaxConcurrentExperiments(queue.benchBuildingsCount);
  if (queue.experiments.length >= maxAllowed) {
    return {
      success: false,
      reason: `Laboratory capacity reached (max ${maxAllowed} concurrent vessels).`,
    };
  }

  // Validate inputs in inventory
  for (const input of params.inputs) {
    const available = params.inventory[input.itemId] ?? 0;
    if (available < input.count) {
      return {
        success: false,
        reason: `Insufficient reagent: missing ${input.count - available}x ${input.itemId}.`,
      };
    }
  }

  // Deduct/commit inputs immediately (steeping is committed)
  for (const input of params.inputs) {
    params.inventory[input.itemId] = (params.inventory[input.itemId] ?? 0) - input.count;
  }

  const turns = turnsPerExperiment(params.workHours);
  const sourChance = SOUR_CHANCE_BY_RECIPE[params.recipeId] ?? 0;
  const roll = params.rngNextFloat ? params.rngNextFloat() : Math.random();
  const isSour = sourChance > 0 && roll < sourChance;

  const instance: ExperimentInstance = {
    id: `exp_${queue.nextExperimentId++}`,
    recipeId: params.recipeId,
    recipeName: params.recipeName,
    turnsStarted: params.currentTurn,
    totalTurns: turns,
    turnsLeft: turns,
    sour: isSour,
    sourChance,
    inputsCommitted: params.inputs.map(i => ({ ...i })),
    outputsExpected: params.outputs.map(o => ({ ...o })),
  };

  queue.experiments.push(instance);

  return {
    success: true,
    instance,
  };
}

export interface StepExperimentsResult {
  completed: ExperimentInstance[];
  active: ExperimentInstance[];
  benchLedger: BenchLedgerEntry[];
}

/**
 * Steps active experiments forward by 1 turn.
 * Decrements turnsLeft; moves finished experiments to completed.
 */
export function stepExperiments(
  queue: ExperimentQueueState,
  currentTurn: number,
): StepExperimentsResult {
  const completed: ExperimentInstance[] = [];
  const active: ExperimentInstance[] = [];
  const benchLedger: BenchLedgerEntry[] = [];

  for (const exp of queue.experiments) {
    exp.turnsLeft--;
    if (exp.turnsLeft <= 0) {
      completed.push(exp);
      benchLedger.push({
        experimentId: exp.id,
        recipeName: exp.recipeName,
        status: exp.sour ? 'sour' : 'completed',
        dayStarted: exp.turnsStarted,
        currentTurn,
        totalTurns: exp.totalTurns,
        message: exp.sour
          ? `⚠ ${exp.recipeName} soured in the flask (living culture spoiled).`
          : `✓ ${exp.recipeName} completed in laboratory (${exp.totalTurns} ${exp.totalTurns === 1 ? 'day' : 'days'}).`,
      });
    } else {
      active.push(exp);
      const elapsed = exp.totalTurns - exp.turnsLeft;
      benchLedger.push({
        experimentId: exp.id,
        recipeName: exp.recipeName,
        status: 'in_progress',
        dayStarted: exp.turnsStarted,
        currentTurn,
        totalTurns: exp.totalTurns,
        message: `⏳ ${exp.recipeName} steeping — Day ${elapsed}/${exp.totalTurns}.`,
      });
    }
  }

  queue.experiments = active;

  return {
    completed,
    active,
    benchLedger,
  };
}
