/**
 * Journal Panel with tabbed interface:
 * - Chronicle: campaign progress, affinities, letters
 * - Council: timed requests, town management
 * - Dispatcher's Desk: Crown's Ledger (ES-2)
 */

import {
  CHAPTERS,
  LETTERS,
  AFFINITIES,
  type ChapterDef,
  type LetterDef,
  type AffinityId,
} from '../data/story';
import {
  type ProgressionState,
  levelFromRenown,
  affinityRank,
  dominantAffinity,
} from '../engine/progression';
import { state, send } from '../app/state';
import { renderTimedRequestsHTML } from './TimedRequestsWidget';
import '../styles.css';

export type LetterState = 'locked' | 'available' | 'claimed';

interface JournalLetterView {
  id: string;
  def: LetterDef;
  state: LetterState;
}

interface JournalChapterView {
  id: string;
  def: ChapterDef;
  state: 'done' | 'current' | 'locked';
  objectives: Array<{
    id: string;
    text: string;
    done: boolean;
  }>;
}

interface JournalModel {
  chapters: JournalChapterView[];
  letters: JournalLetterView[];
  renownLine: string;
  dominantAffinity: AffinityId | null;
  affinities: Array<{
    id: AffinityId;
    name: string;
    points: number;
    rank: 0 | 1 | 2 | 3;
    title: string;
    color: string;
  }>;
}

export function buildJournalModel(save: ProgressionState): JournalModel {
  const doneSet = new Set(save.objectivesDone);
  const claimedSet = new Set(save.lettersDone);

  const chapters: JournalChapterView[] = CHAPTERS.map((ch, idx) => {
    let state: 'done' | 'current' | 'locked' = 'locked';
    if (idx < save.chapter) {
      state = 'done';
    } else if (idx === save.chapter) {
      state = 'current';
    }

    const objectives = ch.objectives.map(o => ({
      id: o.id,
      text: o.text,
      done: doneSet.has(o.id),
    }));

    return { id: ch.id, def: ch, state, objectives };
  });

  const letters: JournalLetterView[] = LETTERS.map(l => {
    let state: LetterState = 'locked';
    if (claimedSet.has(l.id)) {
      state = 'claimed';
    } else if (l.chapter - 1 <= save.chapter) {
      state = 'available';
    }
    return { id: l.id, def: l, state };
  });

  const renownInfo = levelFromRenown(save.renown);
  const renownLine = `Renown L${renownInfo.level} · ${renownInfo.title} — ${renownInfo.intoLevel} / ${renownInfo.span}`;

  const affinitiesList = AFFINITIES.map(aff => {
    const pts = save.affinity[aff.id] ?? 0;
    const rank = affinityRank(pts);
    const title = rank > 0 ? aff.titles[rank - 1] : 'Uninitiated';
    return {
      id: aff.id,
      name: aff.id.charAt(0).toUpperCase() + aff.id.slice(1),
      points: pts,
      rank,
      title,
      color: aff.color,
    };
  });

  return {
    chapters,
    letters,
    renownLine,
    dominantAffinity: dominantAffinity(save.affinity),
    affinities: affinitiesList,
  };
}

let currentTab: 'chronicle' | 'council' | 'ledger' = 'chronicle';

export function mountJournal(tabRoot: HTMLElement, save: ProgressionState): void {
  currentTab = 'chronicle';
  renderJournal(tabRoot, save);
}

function renderJournal(tabRoot: HTMLElement, save: ProgressionState): void {
  const model = buildJournalModel(save);
  const ledger = state.ledger;

  const chaptersHtml = model.chapters
    .map(c => {
      const stateBadge = c.state === 'done' ? '✓' : c.state === 'current' ? '▶' : '🔒';
      const objectivesHtml = c.objectives
        .map(o => `<li class="${o.done ? 'done' : ''}">${o.done ? '☑' : '☐'} ${o.text}</li>`)
        .join('');
      return `
        <li class="chapter ${c.state}" data-chapter="${c.id}">
          <div class="chapter-era">${c.def.era}</div>
          <div class="chapter-title">${c.def.title} <span class="chapter-state">${stateBadge}</span></div>
          <p class="chapter-epigraph">${c.def.epigraph}</p>
          <ul class="objective-list">${objectivesHtml}</ul>
        </li>
      `;
    })
    .join('');

  const affinityRowsHtml = model.affinities
    .map((a: { id: AffinityId; name: string; points: number; rank: 0 | 1 | 2 | 3; title: string; color: string }) => {
      const pct = Math.min(100, Math.round((a.points / 150) * 100));
      return `
        <div class="affinity-row" data-affinity="${a.id}">
          <span class="affinity-name">${a.name}</span>
          <div class="affinity-track">
            <div class="affinity-fill" style="width: ${pct}%; background-color: ${a.color}"></div>
          </div>
          <span class="affinity-rank">${a.title} (${a.points})</span>
        </div>
      `;
    })
    .join('');

  const lettersHtml = model.letters
    .map(l => {
      const rewardAffinities = Object.entries(l.def.rewardAffinity)
        .map(([k, v]) => `+${v} ${k}`)
        .join(' · ');
      const rewardText = `+${l.def.rewardRenown} Renown${rewardAffinities ? ' · ' + rewardAffinities : ''}`;
      const statusBadge =
        l.state === 'claimed'
          ? '<span class="letter-status">Claimed ✓</span>'
          : l.state === 'available'
          ? '<span class="letter-status available">Available</span>'
          : '<span class="letter-status locked">Locked</span>';

      return `
        <article class="letter ${l.state}" data-letter="${l.id}">
          <header>
            <span class="letter-from">${l.def.from} <em>${l.def.era}</em></span>
            ${statusBadge}
          </header>
          <blockquote>“${l.def.excerpt}”</blockquote>
          <p class="letter-task">${l.def.task.text}</p>
          <footer><span class="letter-reward">${rewardText}</span></footer>
        </article>
      `;
    })
    .join('');

  // Ledger HTML
  const ledgerSlotsHtml = ledger?.slots?.map((slot: any) => {
    const familyBadge = `<span class="ledger-family-badge ${slot.family}">${slot.family}</span>`;
    const statusClass = `ledger-status-${slot.status}`;
    const statusText = slot.status.charAt(0).toUpperCase() + slot.status.slice(1);
    const deadlineText = slot.deadlineDay === ledger?.day ? 'Today' : `Day ${slot.deadlineDay}`;
    const rewardAffinityText = slot.rewardAffinity
      ? Object.entries(slot.rewardAffinity).map(([k, v]) => `+${v} ${k}`).join(' · ')
      : '';
    const rewardText = `+${slot.rewardRenown} Renown${rewardAffinityText ? ' · ' + rewardAffinityText : ''}`;

    let actionsHtml = '';
    if (slot.status === 'available') {
      actionsHtml = `<button class="btn btn-primary btn-sm ledger-accept" data-slot-id="${slot.id}">Accept</button>`;
    } else if (slot.status === 'accepted') {
      actionsHtml = `<button class="btn btn-success btn-sm ledger-fulfill" data-slot-id="${slot.id}">Fulfill</button>`;
    } else if (slot.status === 'fulfilled') {
      actionsHtml = `<span class="ledger-fulfilled">✓ Fulfilled</span>`;
    } else {
      actionsHtml = `<span class="ledger-expired">Expired</span>`;
    }

    return `
      <article class="ledger-slot ${slot.family} ${slot.status}">
        <header>
          ${familyBadge}
          <span class="ledger-deadline">Deadline: ${deadlineText}</span>
        </header>
        <p class="ledger-text">${slot.text}</p>
        <footer>
          <span class="ledger-reward">${rewardText}</span>
          <span class="${statusClass}">${statusText}</span>
          ${actionsHtml}
        </footer>
      </article>
    `;
  }).join('') || '<p class="ledger-empty">No dispatches today. Await the Crown\'s word.</p>';

  const streakHtml = ledger
    ? `<div class="ledger-streak">Streak: ${ledger.streak} day${ledger.streak !== 1 ? 's' : ''} · Best: ${ledger.bestStreak}</div>`
    : '';

  const timedRequestsHtml = state.timedRequests ? renderTimedRequestsHTML(state.timedRequests, state.snapshot?.tick ?? 0) : '';

  tabRoot.innerHTML = `
    <div class="journal">
      <nav class="journal-tabs" role="tablist" aria-label="Journal sections">
        <button class="journal-tab ${currentTab === 'chronicle' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'chronicle'}" data-tab="chronicle">📜 Chronicle</button>
        <button class="journal-tab ${currentTab === 'council' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'council'}" data-tab="council">🏛 Council</button>
        <button class="journal-tab ${currentTab === 'ledger' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'ledger'}" data-tab="ledger">📋 Dispatcher's Desk</button>
      </nav>

      <div class="journal-tabpanel" role="tabpanel">
        <!-- Chronicle Tab -->
        <section class="journal-panel ${currentTab === 'chronicle' ? 'active' : ''}" data-panel="chronicle" role="tabpanel">
          <section class="journal-chapters">
            <h3>The Grand Crucible</h3>
            <ol class="chapter-timeline">${chaptersHtml}</ol>
          </section>
          <section class="journal-side">
            <div class="affinity-block">
              <h4>Chosen Path</h4>
              ${affinityRowsHtml}
              <div class="renown-line">${model.renownLine}</div>
            </div>
            <div class="council">
              <h4>The Council of Chemists</h4>
              ${lettersHtml}
            </div>
          </section>
        </section>

        <!-- Council Tab -->
        <section class="journal-panel ${currentTab === 'council' ? 'active' : ''}" data-panel="council" role="tabpanel">
          <div class="council-panel">
            <h3>Town Requests & Missions</h3>
            ${timedRequestsHtml}
          </div>
        </section>

        <!-- Dispatcher's Desk Tab -->
        <section class="journal-panel ${currentTab === 'ledger' ? 'active' : ''}" data-panel="ledger" role="tabpanel">
          <div class="ledger-panel">
            <h3>Dispatcher's Desk</h3>
            <p class="ledger-intro">Three dispatches from the Crown. Complete all three before dusk for the Crown's favor.</p>
            ${streakHtml}
            <div class="ledger-slots">${ledgerSlotsHtml}</div>
          </div>
        </section>
      </div>
    </div>
  `;

  // Attach tab click handlers
  tabRoot.querySelectorAll('.journal-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = (btn as HTMLElement).dataset.tab as 'chronicle' | 'council' | 'ledger';
      renderJournal(tabRoot, save);
    });
  });

  // Attach ledger action handlers
  tabRoot.querySelectorAll('.ledger-accept').forEach(btn => {
    btn.addEventListener('click', () => {
      const slotId = (btn as HTMLElement).dataset.slotId;
      if (slotId) send({ type: 'ACCEPT_LEDGER_SLOT', slotId });
    });
  });

  tabRoot.querySelectorAll('.ledger-fulfill').forEach(btn => {
    btn.addEventListener('click', () => {
      const slotId = (btn as HTMLElement).dataset.slotId;
      if (slotId) send({ type: 'FULFILL_LEDGER_SLOT', slotId });
    });
  });
}