/**
 * The Council — Full-screen tile launcher overlay navigation.
 */
import { FEATURE_WINDOWS, openWindowById, type Pillar, type LaunchableWindow } from '../../app/launcher';
import { getNextTileIndex, getColumnCountForWidth } from './tileNav';

export class Council {
  private overlay: HTMLElement;
  private currentPillar: 'all' | Pillar = 'all';
  private isOpen = false;
  private lastFocusedElement: HTMLElement | null = null;
  private activeTileIndex = 0;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'council';
    this.overlay.className = 'council-overlay hidden';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-labelledby', 'council-title');
    this.overlay.innerHTML = `
      <div class="council-backdrop"></div>
      <div class="council-panel">
        <header class="council-header">
          <div class="council-title-wrap">
            <h2 id="council-title">The Council</h2>
            <p class="council-sub">Hearth &amp; Domain Operations</p>
          </div>
          <button class="council-close-btn" type="button" aria-label="Close Council (Esc)">✕</button>
        </header>

        <nav class="council-pillars" role="tablist" aria-label="Filter council tiles by pillar">
          <button class="pillar-tab active" type="button" role="tab" aria-selected="true" data-pillar="all">All</button>
          <button class="pillar-tab" type="button" role="tab" aria-selected="false" data-pillar="craft">⚒ Craft</button>
          <button class="pillar-tab" type="button" role="tab" aria-selected="false" data-pillar="colony">🏘 Colony</button>
          <button class="pillar-tab" type="button" role="tab" aria-selected="false" data-pillar="domain">🌐 Domain</button>
          <button class="pillar-tab" type="button" role="tab" aria-selected="false" data-pillar="hearth">🕯 Hearth</button>
        </nav>

        <main class="council-grid-container">
          <div class="council-grid" role="region" aria-label="Operations tiles"></div>
        </main>

        <footer class="council-footer">
          <span class="council-hint"><kbd>Esc</kbd> / <kbd>M</kbd> close · <kbd>1</kbd>–<kbd>9</kbd> open directly · <kbd>0</kbd> close all windows</span>
        </footer>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.bindEvents();
    this.renderTiles();
  }

  private bindEvents(): void {
    // Backdrop & Close button
    this.overlay.querySelector('.council-backdrop')?.addEventListener('click', () => this.close());
    this.overlay.querySelector('.council-close-btn')?.addEventListener('click', () => this.close());

    // Pillar filtering tabs
    this.overlay.querySelectorAll<HTMLButtonElement>('.pillar-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const pillar = tab.dataset.pillar as 'all' | Pillar;
        this.setPillar(pillar);
      });
    });

    // Keyboard navigation within the council
    this.overlay.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        const tiles = this.getVisibleTiles();
        if (tiles.length === 0) return;

        e.preventDefault();
        const cols = getColumnCountForWidth(window.innerWidth);
        const next = getNextTileIndex(
          this.activeTileIndex,
          tiles.length,
          cols,
          e.key as any
        );
        this.focusTile(next);
      }
    });

    // Global toggle key: 'M' or 'm'
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('input, select, textarea, [contenteditable="true"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  public setPillar(pillar: 'all' | Pillar): void {
    this.currentPillar = pillar;
    this.overlay.querySelectorAll<HTMLButtonElement>('.pillar-tab').forEach((tab) => {
      const active = tab.dataset.pillar === pillar;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    this.activeTileIndex = 0;
    this.renderTiles();
  }

  private getFilteredWindows(): LaunchableWindow[] {
    return FEATURE_WINDOWS.filter((w) => {
      if (w.enabled === false) return false;
      if (this.currentPillar === 'all') return true;
      return w.pillar === this.currentPillar;
    });
  }

  private getVisibleTiles(): HTMLButtonElement[] {
    return Array.from(this.overlay.querySelectorAll<HTMLButtonElement>('.council-tile'));
  }

  private renderTiles(): void {
    const grid = this.overlay.querySelector<HTMLElement>('.council-grid');
    if (!grid) return;

    const windows = this.getFilteredWindows();
    grid.innerHTML = windows
      .map(
        (w, idx) => `
        <button
          type="button"
          class="council-tile"
          data-window="${w.id}"
          data-index="${idx}"
          tabindex="${idx === this.activeTileIndex ? '0' : '-1'}"
          aria-label="Open ${w.label} (key ${w.key || ''})"
        >
          <div class="tile-icon-badge-row">
            <span class="tile-icon" aria-hidden="true">${w.icon}</span>
            <span class="tile-badge-slot" id="badge-${w.id}"></span>
          </div>
          <span class="tile-label">${w.label}</span>
          ${w.key ? `<kbd class="tile-key">${w.key}</kbd>` : ''}
        </button>
      `
      )
      .join('');

    grid.querySelectorAll<HTMLButtonElement>('.council-tile').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.window;
        if (id) {
          this.close();
          void openWindowById(id);
        }
      });
    });
  }

  private focusTile(index: number): void {
    const tiles = this.getVisibleTiles();
    if (index < 0 || index >= tiles.length) return;

    tiles.forEach((t, i) => {
      t.tabIndex = i === index ? 0 : -1;
    });
    this.activeTileIndex = index;
    tiles[index].focus();
  }

  public open(): void {
    if (this.isOpen) return;
    this.lastFocusedElement = document.activeElement as HTMLElement | null;
    this.isOpen = true;
    this.overlay.classList.remove('hidden');

    this.renderTiles();
    requestAnimationFrame(() => {
      this.focusTile(this.activeTileIndex);
    });
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.classList.add('hidden');
    if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
      this.lastFocusedElement.focus();
    }
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}
