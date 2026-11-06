import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  flushFrameRenderForTests,
  pendingFrameRendersForTests,
  queueFrameRender,
} from '../src/app/syncScheduler';

afterEach(() => {
  flushFrameRenderForTests();
  vi.useRealTimers();
});

describe('sync scheduler — one render per animation frame', () => {
  it('coalesces ten player syncs into one render', () => {
    vi.useFakeTimers();
    const render = vi.fn();

    for (let i = 0; i < 10; i += 1) queueFrameRender('player', render);

    expect(render).not.toHaveBeenCalled();
    expect(pendingFrameRendersForTests()).toBe(1);

    flushFrameRenderForTests();

    expect(render).toHaveBeenCalledTimes(1);
    expect(pendingFrameRendersForTests()).toBe(0);
  });

  it('keeps player and colony renders independent in the same frame', () => {
    vi.useFakeTimers();
    const player = vi.fn();
    const colony = vi.fn();

    queueFrameRender('player', player);
    queueFrameRender('colony', colony);
    flushFrameRenderForTests();

    expect(player).toHaveBeenCalledTimes(1);
    expect(colony).toHaveBeenCalledTimes(1);
  });

  it('keeps only the newest renderer for a kind', () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const second = vi.fn();

    queueFrameRender('player', first);
    queueFrameRender('player', second);
    flushFrameRenderForTests();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
