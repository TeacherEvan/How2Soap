import { describe, expect, it } from 'vitest';
import { snapshotSignature } from '../src/engine/saveSignature';

describe('autosave signature', () => {
  it('changes when tick or glucose changes', () => {
    const a = snapshotSignature({ tick: 1, glucose: 1000, seed: 7 } as any);
    const b = snapshotSignature({ tick: 2, glucose: 1000, seed: 7 } as any);
    const c = snapshotSignature({ tick: 1, glucose: 1000, seed: 7 } as any);
    expect(a).toBe(c);
    expect(a).not.toBe(b);
  });
});
