import { describe, expect, it } from 'vitest';
import { createTimedRequestManager } from '../src/engine/timedRequests';

describe('Timed Requests Engine', () => {
  it('initializes with empty slots and spawns request on step', () => {
    const mgr = createTimedRequestManager();
    expect(mgr.slots.every(s => s === null)).toBe(true);

    mgr.step(5);
    expect(mgr.slots[0]).not.toBeNull();
    expect(mgr.slots[0]?.status).toBe('active');
  });

  it('handles request fulfillment with speed multiplier', () => {
    const mgr = createTimedRequestManager();
    mgr.step(5);
    const slot0 = mgr.slots[0]!;
    expect(slot0).toBeDefined();

    const inv = { [slot0.requiredItemId]: slot0.requiredQty + 5 };
    const res = mgr.fulfill(0, inv, 6);

    expect(res).not.toBeNull();
    expect(res?.success).toBe(true);
    expect(res?.speedMultiplier).toBe(1.5);
    expect(inv[slot0.requiredItemId]).toBe(5);
    expect(mgr.slots[0]).toBeNull();
  });

  it('triggers onExpired callback when deadline passes', () => {
    const mgr = createTimedRequestManager();
    mgr.step(5);
    const originalReq = mgr.slots[0]!;
    const deadline = originalReq.deadlineTick;

    let expiredReq: any = null;
    mgr.step(deadline + 1, (req) => {
      expiredReq = req;
    });

    expect(expiredReq).not.toBeNull();
    expect(expiredReq.id).toBe(originalReq.id);
  });
});
