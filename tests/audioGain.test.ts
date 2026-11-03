import { describe, expect, it } from 'vitest';
import { sliderToGain } from '../src/ui/audio';

describe('slider→gain mapping', () => {
  it('0 → silent, 100 → full, clamps out-of-range', () => {
    expect(sliderToGain(0)).toBe(0);
    expect(sliderToGain(100)).toBe(1);
    expect(sliderToGain(-5)).toBe(0);
    expect(sliderToGain(250)).toBe(1);
  });
});
