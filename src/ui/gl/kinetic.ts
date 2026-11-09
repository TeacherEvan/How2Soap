/**
 * Kinetic animation runtime core — frame-rate independent smoothing.
 * Zero dependencies — pure math on numbers.
 */

export type { AnimationClip } from './lowPolyMeshes';

/** Maximum frame delta (seconds) integrated per call. */
export const MAX_FRAME_DT = 0.1;

/** Maximum sub-step (seconds) for spring integration: 8.33ms = 1/120s. */
export const MAX_SPRING_SUBSTEP = 1 / 120;

/**
 * Exponential decay towards a target — unconditional, bounded via Math.exp.
 * Frame-rate independent: `target + (current - target) * exp(-decay * dt)`.
 * Only clamp is `safeDt = max(0, dt)` — no upper clamp; large dt simply
 * converges fully (delta finite, overshoot-free for decay >= 0).
 */
export function expDecay(current: number, target: number, decay: number, dt: number): number {
  const safeDt = Math.max(0, dt);
  return target + (current - target) * Math.exp(-decay * safeDt);
}

export interface SpringState {
  pos: number;
  vel: number;
}

/**
 * Single-axis damped spring, semi-implicit Euler with sub-stepping.
 * `dt` is clamped to MAX_FRAME_DT (0.1s); the remainder is split into
 * sub-steps of <= 8.33ms (1/120s). Step count is never capped.
 */
export function stepSpringSubstepped(
  pos: number,
  vel: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): SpringState {
  const clampedDt = Math.min(Math.max(0, dt), MAX_FRAME_DT);
  const steps = Math.max(1, Math.ceil(clampedDt / MAX_SPRING_SUBSTEP));
  const h = clampedDt / steps;
  let p = pos;
  let v = vel;
  for (let i = 0; i < steps; i++) {
    const accel = stiffness * (target - p) - damping * v;
    v += accel * h;
    p += v * h;
  }
  return { pos: p, vel: v };
}
