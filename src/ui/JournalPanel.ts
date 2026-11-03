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

export type LetterState = 'locked' | 'available' | 'claimed';

export interface JournalLetterView {
  id: string;
  def: LetterDef;
  state: LetterState;
}

export interface JournalChapterView {
  id: string;
  def: ChapterDef;
  state: 'done' | 'current' | 'locked';
  objectives: Array<{
    id: string;
    text: string;
    done: boolean;
  }>;
}

export interface JournalModel {
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

export function mountJournal(tabRoot: HTMLElement, save: ProgressionState): void {
  const model = buildJournalModel(save);

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
    .map(a => {
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

  tabRoot.innerHTML = `
    <div class="journal">
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
    </div>
  `;
}
