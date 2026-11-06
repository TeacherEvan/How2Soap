import type { WindowSpec } from '../WindowManager';

export const commissionsWindowSpec: WindowSpec = {
  id: 'commissions',
  title: 'Day Commissions',
  icon: '🎯',
  mount(container: HTMLElement) {
    container.innerHTML = `
      <div class="commissions-window" role="region" aria-label="Daily Commissions">
        <header class="commissions-header">
          <div class="streak-badge" id="commissions-streak">
            <span class="flame-icon">🔥</span>
            <span>0 Day Streak</span>
          </div>
          <p class="hint">Three civic commissions are posted each dawn. Fulfill and claim them to advance hearth renown.</p>
        </header>
        <div class="commissions-list" id="commissions-list">
          <div class="commission-card placeholder">
            <p>Commissions arrive at dawn with Day 1.</p>
          </div>
        </div>
      </div>
    `;
  },
  onSnapshot(_snapshot, _container: HTMLElement) {
    // Spec 2 will bind the live commission engine.
  },
};

export const spec = commissionsWindowSpec;
