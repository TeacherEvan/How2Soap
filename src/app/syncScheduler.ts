/**
 * Coalesces worker→UI sync renders into one pass per animation frame.
 *
 * The simulation worker posts PLAYER_SYNC/COLONY_SYNC at 10 Hz. Rendering each
 * message immediately tears down and recreates DOM subtrees up to 30 times a
 * second even though the browser paints at most once per frame. This module
 * keeps only the latest render per kind and flushes them on the next frame.
 */
type RenderKind = 'player' | 'colony' | 'requests';

const pending = new Map<RenderKind, () => void>();
let frameHandle: number | null = null;

const requestFrame: (cb: () => void) => number =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(() => cb())
    : (cb) => setTimeout(cb, 0) as unknown as number;

const cancelFrame: (handle: number) => void =
  typeof cancelAnimationFrame === 'function'
    ? (handle) => cancelAnimationFrame(handle)
    : (handle) => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);

export function queueFrameRender(kind: RenderKind, render: () => void): void {
  pending.set(kind, render);
  if (frameHandle !== null) return;
  frameHandle = requestFrame(() => {
    frameHandle = null;
    flushFrameRender();
  });
}

export function flushFrameRender(): void {
  const jobs = [...pending.values()];
  pending.clear();
  for (const job of jobs) job();
}

/** Test helper: run the pending frame now and cancel the scheduled callback. */
export function flushFrameRenderForTests(): void {
  if (frameHandle !== null) {
    cancelFrame(frameHandle);
    frameHandle = null;
  }
  flushFrameRender();
}

/** Test helper: how many distinct render kinds are waiting. */
export function pendingFrameRendersForTests(): number {
  return pending.size;
}
