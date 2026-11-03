import { describe, expect, it } from 'vitest';
import { OverlayStack } from '../src/ui/overlayStack';

describe('overlay stack', () => {
  it('ESC closes only the top-most overlay', () => {
    const s = new OverlayStack();
    const a = { id: 'a' } as any, b = { id: 'b' } as any;
    s.push(a); s.push(b);
    expect(s.closeTop()).toBe(b);
    expect(s.closeTop()).toBe(a);
    expect(s.closeTop()).toBeUndefined();
  });
});
