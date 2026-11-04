import { describe, expect, it, beforeAll } from 'vitest';
import { WindowManager } from '../src/ui/WindowManager';

describe('WindowManager viewport clamping', () => {
  beforeAll(() => {
    (globalThis as any).window = {
      innerWidth: 1024,
      innerHeight: 768,
    };
  });

  it('clamps coordinates safely inside boundaries', () => {
    const el = {
      offsetWidth: 400,
      offsetHeight: 300,
      getBoundingClientRect: () => ({ width: 400, height: 300 }),
      style: {},
    } as any;

    // Test clamped right/bottom overflow
    const resOver = WindowManager.clampToViewport(el, 900, 700);
    expect(resOver.x).toBeLessThanOrEqual(1024 - 400 - 12);
    expect(resOver.y).toBeLessThanOrEqual(768 - 300 - 68);

    // Test clamped top/left underflow
    const resUnder = WindowManager.clampToViewport(el, -50, 10);
    expect(resUnder.x).toBe(12);
    expect(resUnder.y).toBe(62);
  });
});
