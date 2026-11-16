// src/engine/time.ts
export const SIM_STEP_SECONDS = 360;   // 6 game-minutes per worker tick
export const WORKER_HZ = 10;           // 10 simulation steps per game-hour
export const WALL_TICK_MS = 500;       // 500ms wall-clock per tick (120s = 2 min per game-day)
export const TICKS_PER_HOUR = WORKER_HZ;
export const DAY_TICKS = 240;          // 86400 s / 360 s
export const tickToDay = (tick: number): number => 1 + Math.floor(tick / DAY_TICKS);