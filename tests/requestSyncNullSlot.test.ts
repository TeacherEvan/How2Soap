import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('REQUEST_SYNC null slot safety (P1-10)', () => {
  beforeEach(() => {
    const el = () => ({
      innerHTML: '',
      textContent: '',
      appendChild: vi.fn(),
      addEventListener: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn(() => false) },
      style: {},
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      prepend: vi.fn(),
    });
    const mockDoc = {
      getElementById: vi.fn(() => el()),
      querySelector: vi.fn(() => el()),
      querySelectorAll: vi.fn(() => []),
      createElement: vi.fn(() => el()),
    };
    vi.stubGlobal('document', mockDoc);
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('handles null slots without crashing on !slot.active', async () => {
    const { handleWorkerMessage } = await import('../src/app/workerMessages');
    const { state } = await import('../src/app/state');

    // 1. Initial sync with all null slots must not crash
    expect(() => {
      handleWorkerMessage({ type: 'REQUEST_SYNC', slots: [null, null, null] });
    }).not.toThrow();

    expect(state.timedRequests).toEqual([null, null, null]);

    // 2. Active slot arrives alongside nulls
    const activeSlots = [
      { slot: 0, status: 'active', active: true, id: 'req_1' },
      null,
      null,
    ];
    handleWorkerMessage({ type: 'REQUEST_SYNC', slots: activeSlots });
    expect(state.timedRequests).toEqual(activeSlots);

    // 3. Slot fulfills (status becomes 'fulfilled', active becomes false)
    const fulfilledSlots = [
      { slot: 0, status: 'fulfilled', active: false, id: 'req_1' },
      null,
      null,
    ];

    handleWorkerMessage({ type: 'REQUEST_SYNC', slots: fulfilledSlots });

    expect(state.completedRequestsCount).toBe(1);

    // 4. Another sync where slots become null again
    expect(() => {
      handleWorkerMessage({ type: 'REQUEST_SYNC', slots: [null, null, null] });
    }).not.toThrow();
    expect(state.timedRequests).toEqual([null, null, null]);
  });
});
