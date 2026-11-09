import { describe, expect, it } from 'vitest';
import {
  expDecay,
  stepSpringSubstepped,
  MAX_FRAME_DT,
  MAX_SPRING_SUBSTEP,
} from '../src/ui/gl/kinetic';
import { MESHES } from '../src/ui/gl/lowPolyMeshes';
import type { AnimationClip } from '../src/ui/gl/lowPolyMeshes';

describe('expDecay', () => {
  it('converges to target over time', () => {
    let v = 0;
    for (let i = 0; i < 600; i++) {
      v = expDecay(v, 10, 2, 1 / 60);
    }
    expect(Math.abs(v - 10)).toBeLessThan(1e-6);
  });

  it('is frame-rate independent (one large step equals many small steps)', () => {
    const decay = 2.5;
    const target = 7;
    const one = expDecay(0, target, decay, 1.0);
    let many = 0;
    for (let i = 0; i < 60; i++) {
      many = expDecay(many, target, decay, 1 / 60);
    }
    expect(Math.abs(one - many)).toBeLessThan(1e-9);
  });

  it('never overshoots the target for decay >= 0', () => {
    let v = 0;
    for (let i = 0; i < 300; i++) {
      v = expDecay(v, 5, 3, 1 / 60);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it('clamps negative dt to zero (no change) and handles large dt without divergence', () => {
    expect(expDecay(3, 10, 2, 0)).toBe(3);
    expect(expDecay(3, 10, 2, -1)).toBe(3);
    const big = expDecay(0, 10, 2, 100);
    expect(Number.isFinite(big)).toBe(true);
    expect(Math.abs(big - 10)).toBeLessThan(1e-9);
  });
});

describe('stepSpringSubstepped', () => {
  it('is stable at 120Hz: 1/60 vs 1/120 reach the same end state for the same wall time', () => {
    const stiffness = 80;
    const damping = 14;
    const target = 5;

    let a = { pos: 0, vel: 0 };
    for (let i = 0; i < 120; i++) {
      a = stepSpringSubstepped(a.pos, a.vel, target, stiffness, damping, 1 / 60);
    }

    let b = { pos: 0, vel: 0 };
    for (let i = 0; i < 240; i++) {
      b = stepSpringSubstepped(b.pos, b.vel, target, stiffness, damping, 1 / 120);
    }

    expect(Number.isFinite(a.pos)).toBe(true);
    expect(Number.isFinite(b.pos)).toBe(true);
    expect(Math.abs(a.pos - b.pos)).toBeLessThan(1e-9);
    expect(Math.abs(a.vel - b.vel)).toBeLessThan(1e-9);
    // Converged near target after 2s
    expect(Math.abs(b.pos - target)).toBeLessThan(0.5);
  });

  it('does not diverge under stiff spring at 120Hz', () => {
    let s = { pos: 0, vel: 0 };
    for (let i = 0; i < 600; i++) {
      s = stepSpringSubstepped(s.pos, s.vel, 10, 200, 20, 1 / 120);
      expect(Number.isFinite(s.pos)).toBe(true);
      expect(Number.isFinite(s.vel)).toBe(true);
      expect(Math.abs(s.pos)).toBeLessThan(50);
    }
    expect(Math.abs(s.pos - 10)).toBeLessThan(1.0);
  });

  it('clamps frame dt to MAX_FRAME_DT and keeps sub-steps <= 8.33ms', () => {
    expect(MAX_FRAME_DT).toBe(0.1);
    expect(MAX_SPRING_SUBSTEP).toBeCloseTo(1 / 120, 12);
    // Huge dt should still be finite and bounded (clamped to 0.1s of integration)
    const clamped = stepSpringSubstepped(0, 0, 10, 80, 14, 10);
    const atMax = stepSpringSubstepped(0, 0, 10, 80, 14, 0.1);
    expect(Number.isFinite(clamped.pos)).toBe(true);
    expect(clamped.pos).toBeCloseTo(atMax.pos, 12);
    expect(clamped.vel).toBeCloseTo(atMax.vel, 12);
    // Zero dt is a no-op
    const idle = stepSpringSubstepped(3, 4, 10, 80, 14, 0);
    expect(idle.pos).toBe(3);
    expect(idle.vel).toBe(4);
  });
});

describe('AnimationClip', () => {
  it('describes baked loops alongside MeshGeometry', () => {
    const clip: AnimationClip = {
      fps: 30,
      loop: true,
      frames: [new Float32Array(MESHES.COLONIST_PAWN.positions.length)],
    };
    expect(clip.fps).toBe(30);
    expect(clip.loop).toBe(true);
    expect(clip.frames.length).toBe(1);
    expect(clip.frames[0].length).toBe(MESHES.COLONIST_PAWN.positions.length);
  });
});
