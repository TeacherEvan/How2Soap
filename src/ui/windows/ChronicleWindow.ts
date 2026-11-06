import type { WindowSpec } from '../WindowManager';
import { state } from '../../app/state';

export const chronicleWindowSpec: WindowSpec = {
  id: 'chronicle',
  title: 'Hearth Chronicle',
  icon: '📜',
  mount(container: HTMLElement) {
    container.innerHTML = `
      <div class="chronicle-window" role="region" aria-label="Hearth Chronicle and Master Tech Progression">
        <section class="chronicle-section master-tech-section">
          <h3>Master Tech Progression</h3>
          <div class="master-tech-status" id="chronicle-master-tech">
            <div class="renown-banner">
              <span id="chronicle-renown-title">L1 · Scrub Apprentice</span>
              <div class="chronicle-renown-display">
                <span id="chronicle-renown-score">Renown: ${state.progression.renown ?? 0}</span>
              </div>
            </div>
            <ul class="quest-ladder" id="chronicle-quest-list">
              <li>Loading milestones…</li>
            </ul>
          </div>
        </section>

        <section class="chronicle-section story-records-section">
          <h3>Story &amp; Annals</h3>
          <div id="chronicle-story-records" class="chronicle-story-list">
            <p class="hint">The annals of the hearth are penned as you survive and discover.</p>
          </div>
        </section>

        <section class="chronicle-section event-log-section">
          <h3>Event Annals</h3>
          <div class="chronicle-log-container">
            <ul class="log chronicle-log" id="chronicle-event-log">
              <li class="empty">No events yet.</li>
            </ul>
          </div>
        </section>
      </div>
    `;
    this.onSnapshot?.({ tick: 0, telemetry: new Float64Array(), moles: new Float64Array() }, container);
  },
  onSnapshot(_snapshot, container: HTMLElement) {
    if (!state) return;

    // 1. Renown and title
    const scoreEl = container.querySelector('#chronicle-renown-score');
    if (scoreEl) {
      scoreEl.textContent = `Renown: ${state.progression.renown ?? 0}`;
    }

    // 2. Master tech progression
    const questList = container.querySelector('#chronicle-quest-list');
    if (questList) {
      const quests = (state as any).quests || [];
      if (quests.length > 0) {
        questList.innerHTML = quests
          .map(
            (q: any) => `
            <li class="${q.completed ? 'completed' : 'pending'}">
              <span class="quest-icon" aria-hidden="true">${q.completed ? '✓' : '○'}</span>
              <div class="quest-detail">
                <strong>${q.title || q.label || 'Objective'}</strong>
                <p>${q.description || ''}</p>
              </div>
            </li>
          `
          )
          .join('');
      } else {
        questList.innerHTML = '<li>Milestones will appear as the hearth grows.</li>';
      }
    }

    // 3. Event annals / log
    const logList = container.querySelector('#chronicle-event-log');
    if (logList && Array.isArray(state.log)) {
      if (state.log.length === 0) {
        logList.innerHTML = '<li class="empty">No events recorded.</li>';
      } else {
        logList.innerHTML = state.log
          .slice(-50)
          .reverse()
          .map((entry: any) => `<li>${typeof entry === 'string' ? entry : entry.text || entry.message}</li>`)
          .join('');
      }
    }
  },
};

export const spec = chronicleWindowSpec;
