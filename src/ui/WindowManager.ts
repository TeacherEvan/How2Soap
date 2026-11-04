/**
 * WindowManager — one window per feature, Slay/Stardew-style for a turn-based game.
 *
 * Every major feature opens as a single-purpose dialog window: singleton per
 * id, role=dialog + aria-modal, focus trapped inside, ESC closes via the
 * shared overlayStack (CrisisModal deliberately stays inert to ESC), focus
 * returns to the launcher that opened the window. Full-screen sheet under
 * 720px. Windows are lazy-loaded by the launcher, never in the eager bundle.
 */
import { globalOverlayStack } from './overlayStack';
import { audio } from './audio';

export type WindowSize = 'full' | 'wide' | 'narrow';

export interface WindowSpec {
  /** Stable id: 'reactions' | 'fabrication' | 'paddocks' | 'biome' | ... */
  id: string;
  title: string;
  icon: string;
  size?: WindowSize;
  /** Render the window body. Called once per window open. */
  mount: (body: HTMLElement) => void;
  /** Teardown (intervals, rAF loops, listeners). Called on close. */
  unmount?: () => void;
  /**
   * Optional: receives the live snapshot whenever the game tick advances
   * while the window is open. Keep it cheap (called on 10 Hz tick edges).
   */
  onSnapshot?: (
    snapshot: { tick: number; telemetry: Float64Array; moles: Float64Array },
    body: HTMLElement,
  ) => void;
}

interface OpenWindow {
  spec: WindowSpec;
  root: HTMLElement;
  backdrop: HTMLElement;
  body: HTMLElement;
  overlayEntry: { id?: string; close?: () => void; remove?: () => void };
  restoreFocusTo: Element | null;
}

const openWindows = new Map<string, OpenWindow>();

function closeWindow(id: string): void {
  const entry = openWindows.get(id);
  if (!entry) return;
  audio.uiLatchClick(0.85);
  try {
    entry.spec.unmount?.();
  } finally {
    entry.root.remove();
    entry.backdrop.remove();
    globalOverlayStack.remove(entry.overlayEntry);
    openWindows.delete(id);
    entry.restoreFocusTo?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    if (entry.restoreFocusTo instanceof HTMLElement) {
      entry.restoreFocusTo.focus();
    }
  }
}

function trapFocus(root: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const focusables = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
    ),
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export const WindowManager = {
  open(spec: WindowSpec): void {
    const existing = openWindows.get(spec.id);
    if (existing) {
      existing.root.querySelector<HTMLElement>('.window-close')?.focus();
      return;
    }

    const size = spec.size ?? 'wide';
    const titleId = `window-${spec.id}-title`;

    const backdrop = document.createElement('div');
    backdrop.className = 'window-backdrop';
    backdrop.dataset.windowId = spec.id;
    backdrop.addEventListener('pointerdown', () => closeWindow(spec.id));

    const root = document.createElement('div');
    root.className = `window window-${size}`;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', titleId);
    root.innerHTML = `
      <div class="window-titlebar">
        <span class="window-icon" aria-hidden="true">${spec.icon}</span>
        <h2 class="window-title" id="${titleId}">${spec.title}</h2>
        <button class="window-close ghost" type="button" aria-label="Close ${spec.title}" title="Close (Esc)">✕</button>
      </div>
      <div class="window-body"></div>
    `;

    const body = root.querySelector<HTMLElement>('.window-body')!;
    const closeBtn = root.querySelector<HTMLButtonElement>('.window-close')!;
    closeBtn.addEventListener('click', () => closeWindow(spec.id));

    root.addEventListener('keydown', (event: KeyboardEvent) => trapFocus(root, event));

    document.body.append(backdrop, root);
    audio.uiHeavyVent();

    const restoreFocusTo = document.activeElement;
    const overlayEntry = { id: `window:${spec.id}`, close: () => closeWindow(spec.id), remove: () => closeWindow(spec.id) };
    globalOverlayStack.push(overlayEntry);

    // Mount content after insertion so layout-dependent code can measure.
    spec.mount(body);

    const entry: OpenWindow = { spec, root, backdrop, body, overlayEntry, restoreFocusTo };
    openWindows.set(spec.id, entry);

    (body.querySelector<HTMLElement>('[data-autofocus], input, button, [tabindex]') ?? closeBtn).focus();
  },

  close(id: string): void {
    closeWindow(id);
  },

  closeAll(): void {
    for (const id of Array.from(openWindows.keys())) {
      closeWindow(id);
    }
  },

  isOpen(id: string): boolean {
    return openWindows.has(id);
  },

  /** Forward the live simulation snapshot to open windows that consume it. */
  broadcastSnapshot(snapshot: { tick: number; telemetry: Float64Array; moles: Float64Array }): void {
    for (const entry of openWindows.values()) {
      try {
        entry.spec.onSnapshot?.(snapshot, entry.body);
      } catch {
        // A window threw during its update — close it rather than kill the frame loop.
        closeWindow(entry.spec.id);
      }
    }
  },
};
