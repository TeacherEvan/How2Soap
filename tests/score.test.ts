import { describe, it, expect, beforeEach } from 'vitest';
import { score } from '../src/ui/score';

describe('GenerativeScoreEngine', () => {
  beforeEach(() => {
    score.setEnabled(false);
  });

  it('toggles score state and persists', () => {
    score.setEnabled(true);
    expect(score.getEnabled()).toBe(true);

    score.setEnabled(false);
    expect(score.getEnabled()).toBe(false);
  });

  it('switches between adaptive themes cleanly', () => {
    score.setTheme('hearth');
    expect(score.getTheme()).toBe('hearth');

    score.setTheme('crisis');
    expect(score.getTheme()).toBe('crisis');

    score.setTheme('victory');
    expect(score.getTheme()).toBe('victory');
  });
});
