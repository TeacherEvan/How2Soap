/**
 * The Blacksmith Engine — Batch Crafting & Tool Wear
 *
 * Implements §6.20.2 of the Civ VII 4X Conversion Plan (v8):
 * - Batch fabrication: craft in volume (e.g. 8x spears, 6 turns; tools, axes, utensils).
 * - Tool wear degradation: tools in colonist hands degrade over ~40 turns.
 * - Repair jobs consume charcoal/metal capacity.
 * - Gates Guard rating > +2.
 */

export interface BlacksmithBatchJob {
  readonly id: string;
  readonly recipeId: string;
  readonly name: string;
  readonly batchCount: number; // e.g. 8
  readonly totalTurns: number;
  turnsLeft: number;
  readonly outputs: Array<{ itemId: string; count: number }>;
}

export interface BlacksmithState {
  jobs: BlacksmithBatchJob[];
  nextJobId: number;
  toolWearTicks: number;
  maintenanceAlert: boolean;
}

export function createBlacksmithState(): BlacksmithState {
  return {
    jobs: [],
    nextJobId: 1,
    toolWearTicks: 0,
    maintenanceAlert: false,
  };
}

export function startBatchJob(
  state: BlacksmithState,
  params: { recipeId: string; name: string; batchCount: number; turns: number; outputs: Array<{ itemId: string; count: number }> },
): BlacksmithBatchJob {
  const job: BlacksmithBatchJob = {
    id: `batch_${state.nextJobId++}`,
    recipeId: params.recipeId,
    name: params.name,
    batchCount: params.batchCount,
    totalTurns: params.turns,
    turnsLeft: params.turns,
    outputs: params.outputs.map((o) => ({ ...o })),
  };

  state.jobs.push(job);
  return job;
}

export function stepBlacksmith(state: BlacksmithState): {
  completedJobs: BlacksmithBatchJob[];
  toolDegraded: boolean;
} {
  const completedJobs: BlacksmithBatchJob[] = [];
  const remainingJobs: BlacksmithBatchJob[] = [];

  for (const job of state.jobs) {
    job.turnsLeft--;
    if (job.turnsLeft <= 0) {
      completedJobs.push(job);
    } else {
      remainingJobs.push(job);
    }
  }

  state.jobs = remainingJobs;
  state.toolWearTicks++;

  let toolDegraded = false;
  // Tools degrade every ~40 turns
  if (state.toolWearTicks >= 40) {
    state.toolWearTicks = 0;
    state.maintenanceAlert = true;
    toolDegraded = true;
  }

  return { completedJobs, toolDegraded };
}
