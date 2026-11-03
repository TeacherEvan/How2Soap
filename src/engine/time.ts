// src/engine/time.ts
export const SIM_STEP_SECONDS = 360;   // 6 game-minutes per worker tick
export const WORKER_HZ = 10;           // 10 steps per wall second at 1× speed
export const TICKS_PER_HOUR = WORKER_HZ;
export const DAY_TICKS = 240;          // 86400 s / 360 s
export const tickToDay = (tick: number): number => 1 + Math.floor(tick / DAY_TICKS);