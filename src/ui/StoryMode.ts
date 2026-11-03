import type { ChapterDef } from '../data/story';
import { globalOverlayStack } from './overlayStack';
import { audio } from './audio';

export const StoryMode = (() => {
  const showOverlay = (markup: string, cls = '', closable = true): HTMLElement => {
    const existing = document.getElementById('story-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'story-overlay';
    overlay.className = `story-overlay ${cls}`.trim();
    overlay.innerHTML = markup;
    document.body.appendChild(overlay);

    if (closable) {
      const entry = {
        id: overlay.id,
        close: () => {
          overlay.remove();
          globalOverlayStack.remove(entry);
        },
      };
      globalOverlayStack.push(entry);
    }

    // Focus trap / auto-focus first button
    const firstBtn = overlay.querySelector('button');
    firstBtn?.focus();

    return overlay;
  };

  return {
    bootSplash(
      opts: { day: number; chapterTitle: string; renown: number; title: string; hasSave: boolean },
      cb: { onContinue(): void; onNewWorld(): void },
    ): void {
      const markup = `
        <div class="story-card boot-splash">
          <h2>How to Make Soap</h2>
          <p class="subtitle">A Chemical Survival Chronicle</p>
          ${
            opts.hasSave
              ? `
              <div class="save-summary">
                <div><strong>Day ${opts.day}</strong> · ${opts.chapterTitle}</div>
                <div>${opts.title} · ${opts.renown} Renown</div>
              </div>
              <div class="splash-actions">
                <button class="btn btn-primary" id="btn-splash-continue">Continue Chronicle</button>
                <button class="btn btn-secondary" id="btn-splash-new">Start Fresh World</button>
              </div>
            `
              : `
              <div class="splash-actions">
                <button class="btn btn-primary" id="btn-splash-start">Begin Journey</button>
              </div>
            `
          }
        </div>
      `;
      const overlay = showOverlay(markup, 'boot-splash-overlay', false);
      if (opts.hasSave) {
        overlay.querySelector('#btn-splash-continue')?.addEventListener('click', () => {
          overlay.remove();
          cb.onContinue();
        });
        overlay.querySelector('#btn-splash-new')?.addEventListener('click', () => {
          if (confirm('Start a fresh world? Any existing progress will be overwritten.')) {
            overlay.remove();
            cb.onNewWorld();
          }
        });
      } else {
        overlay.querySelector('#btn-splash-start')?.addEventListener('click', () => {
          overlay.remove();
          cb.onNewWorld();
        });
      }
    },

    prologue(onDone: () => void): void {
      const lines = [
        'The fire does not ask names. Remember that.',
        'You are an apprentice of Magister Hennig,',
        'the last of the old school — half alchemist, half witness.',
        'Six doors stand between you and the world that made you:',
        'fire, soap, bronze, willow, mould, and the lightning in the bottle.',
        'Open them all. The world you save may be your own.',
      ];

      const markup = `
        <div class="story-card prologue-card">
          <header class="prologue-header">
            <span class="prologue-title">PROLOGUE</span>
            <button class="btn-skip" id="btn-prologue-skip">Skip [Esc]</button>
          </header>
          <div class="prologue-body" id="prologue-body"></div>
          <footer class="prologue-footer">
            <button class="btn btn-primary" id="btn-prologue-begin" style="display: none;">Step into the Wild</button>
          </footer>
        </div>
      `;
      const overlay = showOverlay(markup, 'prologue-overlay', false);
      const bodyEl = overlay.querySelector('#prologue-body') as HTMLElement;
      const beginBtn = overlay.querySelector('#btn-prologue-begin') as HTMLElement;
      const skipBtn = overlay.querySelector('#btn-prologue-skip') as HTMLElement;

      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        window.removeEventListener('keydown', handleKeyDown);
        overlay.remove();
        onDone();
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cleanup();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      skipBtn.addEventListener('click', cleanup);
      beginBtn.addEventListener('click', cleanup);

      // Typewriter sequence
      let lineIdx = 0;
      let charIdx = 0;
      let currentP: HTMLParagraphElement | null = null;

      const typeChar = () => {
        if (cleanedUp) return;
        if (lineIdx >= lines.length) {
          beginBtn.style.display = 'inline-block';
          beginBtn.focus();
          return;
        }

        if (charIdx === 0) {
          currentP = document.createElement('p');
          bodyEl.appendChild(currentP);
        }

        const line = lines[lineIdx];
        if (charIdx < line.length) {
          currentP!.textContent += line.charAt(charIdx);
          charIdx += 1;
          window.setTimeout(typeChar, 24);
        } else {
          lineIdx += 1;
          charIdx = 0;
          window.setTimeout(typeChar, 350);
        }
      };

      typeChar();
    },

    chapterComplete(ch: ChapterDef, onContinue: () => void): void {
      audio.levelUp();
      const markup = `
        <div class="story-card chapter-complete-card">
          <div class="chapter-stamp">CHAPTER COMPLETE</div>
          <h2>${ch.title}</h2>
          <div class="era-tag">${ch.era}</div>
          <blockquote class="chapter-epigraph">${ch.epigraph}</blockquote>
          <p class="chapter-epilogue">${ch.epilogue}</p>
          <div class="chapter-reward">+${ch.renown} Renown Earned</div>
          <button class="btn btn-primary" id="btn-chapter-continue">Continue Chronicle</button>
        </div>
      `;
      const overlay = showOverlay(markup, 'chapter-overlay');
      overlay.querySelector('#btn-chapter-continue')?.addEventListener('click', () => {
        overlay.remove();
        onContinue();
      });
    },

    victory(
      stats: { days: number; fabricated: number; renown: number; levelTitle: string },
      epilogue: string,
      cb: { onFreeCraft(): void; onNewWorld(): void },
    ): void {
      audio.victory();
      const markup = `
        <div class="story-card victory-card">
          <div class="chapter-stamp victory-stamp">VICTORY</div>
          <h2>The Crucible Mastered</h2>
          <p class="epilogue-line">${epilogue}</p>
          <div class="stats-grid">
            <div class="stat-item"><span class="stat-label">Days Survived</span><span class="stat-val">${stats.days}</span></div>
            <div class="stat-item"><span class="stat-label">Recipes Fabricated</span><span class="stat-val">${stats.fabricated}</span></div>
            <div class="stat-item"><span class="stat-label">Final Renown</span><span class="stat-val">${stats.renown}</span></div>
            <div class="stat-item"><span class="stat-label">Rank</span><span class="stat-val">${stats.levelTitle}</span></div>
          </div>
          <div class="splash-actions">
            <button class="btn btn-primary" id="btn-victory-free">Free Play</button>
            <button class="btn btn-secondary" id="btn-victory-new">New Chronicle</button>
          </div>
        </div>
      `;
      const overlay = showOverlay(markup, 'victory-overlay');
      overlay.querySelector('#btn-victory-free')?.addEventListener('click', () => {
        overlay.remove();
        cb.onFreeCraft();
      });
      overlay.querySelector('#btn-victory-new')?.addEventListener('click', () => {
        overlay.remove();
        cb.onNewWorld();
      });
    },

    death(
      cause: 'sepsis' | 'starvation' | 'hypothermia' | string,
      stats: { days: number; renown: number },
      onRestart: () => void,
    ): void {
      audio.toll();
      const causeText =
        cause === 'sepsis'
          ? 'Systemic infection took hold. Fever and sepsis claimed your strength.'
          : cause === 'starvation'
          ? 'Glucose exhausted. Your body could burn no further.'
          : cause === 'hypothermia'
          ? 'The elements pierced your shelter. The cold stopped your heart.'
          : 'Your journey ends in the wild.';

      const markup = `
        <div class="story-card death-card">
          <div class="chapter-stamp death-stamp">FATAL TERMINATION</div>
          <h2>The Wilderness Claims You</h2>
          <p class="death-cause">${causeText}</p>
          <div class="stats-grid">
            <div class="stat-item"><span class="stat-label">Days Lived</span><span class="stat-val">${stats.days}</span></div>
            <div class="stat-item"><span class="stat-label">Renown Earned</span><span class="stat-val">${stats.renown}</span></div>
          </div>
          <button class="btn btn-danger" id="btn-death-restart">Begin Anew</button>
        </div>
      `;
      const overlay = showOverlay(markup, 'death-overlay');
      overlay.querySelector('#btn-death-restart')?.addEventListener('click', () => {
        overlay.remove();
        onRestart();
      });
    },
  };
})();
