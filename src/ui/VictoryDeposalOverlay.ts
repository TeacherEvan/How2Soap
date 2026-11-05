/**
 * Victory & Deposal Endgames Modal (§6.10, §6.18.5, §6.18.8, §6.29)
 *
 * Full-screen narrative overlay displaying:
 * - Victory or Deposal stamp and title
 * - Authored concluding prose and narrative resolution
 * - Canon summary: Engineering Canon vs Medical Canon
 * - Test of Time Score breakdown (Dominion, Tourism, GDP, Innovation, Estates, Settlements)
 * - "Save as Museum" export button + "Continue in Museum Mode" / "New World" options
 */

import { globalOverlayStack } from './overlayStack';
import {
  type VictoryType,
  type CampaignVictoryState,
  getEndingCardContent,
  calculateTestOfTimeScore,
} from '../engine/campaign/victories';
import type { DeposalType, RealmState } from '../engine/campaign/realm';
import type { SettlementsState } from '../engine/campaign/settlements';
import type { BuiltWorksState } from '../engine/campaign/builtWorks';
import type { PatronId } from '../engine/campaign/patron';
import { score } from './score';

export interface VictoryDeposalModalData {
  endingType: VictoryType | DeposalType;
  victoryState: CampaignVictoryState;
  realm: RealmState;
  settlements: SettlementsState;
  builtWorks: BuiltWorksState;
  patronId: PatronId | null;
  turn: number;
  onMuseumMode(): void;
  onNewWorld(): void;
}

export function openVictoryDeposalModal(data: VictoryDeposalModalData): void {
  const existing = document.getElementById('victory-deposal-overlay');
  if (existing) existing.remove();

  const card = getEndingCardContent(data.endingType, data.builtWorks, data.patronId);
  const scoreData = calculateTestOfTimeScore(data.victoryState, data.realm, data.settlements, data.turn);

  // Play audio theme
  if (card.isVictory) {
    score.setTheme('victory');
  } else {
    score.setTheme('crisis');
  }

  const overlay = document.createElement('div');
  overlay.id = 'victory-deposal-overlay';
  overlay.className = 'story-overlay victory-deposal-overlay';

  const stampColor = card.isVictory ? '#98c379' : '#e06c75';
  const badgeColor = card.isVictory ? '#e5b567' : '#d19a66';

  overlay.innerHTML = `
    <div class="story-card" style="max-width: 820px; width: 92vw; max-height: 90vh; overflow-y: auto; padding: 1.5rem; background: #12151c; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 16px 48px rgba(0,0,0,0.85); border-radius: 8px;">
      <header style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.8rem; margin-bottom: 1.2rem; text-align: center;">
        <div style="font-size: 0.8rem; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; color: ${stampColor}; margin-bottom: 0.3rem;">
          ${card.stamp}
        </div>
        <h1 style="margin: 0; font-family: var(--font-heading, serif); font-size: 2rem; color: #f0f6fc;">
          ${card.title}
        </h1>
        <div style="display: inline-block; margin-top: 0.5rem; padding: 2px 10px; border-radius: 12px; font-size: 0.8rem; background: rgba(229,181,103,0.1); color: ${badgeColor}; border: 1px solid rgba(229,181,103,0.3);">
          ${card.badge}
        </div>
      </header>

      <div class="prose-section" style="margin-bottom: 1.5rem; line-height: 1.65; font-size: 0.95rem; color: #c9d1d9;">
        ${card.prose.map((p) => `<p style="margin: 0 0 0.8rem;">${p}</p>`).join('')}
      </div>

      <div class="canon-banner" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 0.8rem 1rem; margin-bottom: 1.5rem; font-size: 0.85rem; color: #8b949e;">
        <strong style="color: #5aa5ff;">Legacy of Built Works:</strong> ${card.canonSummary}
      </div>

      <div class="score-breakdown-card" style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; margin-bottom: 0.8rem;">
          <div>
            <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--muted);">Test of Time Total Score</span>
            <div style="font-size: 1.8rem; font-weight: bold; color: #5aa5ff; font-variant-numeric: tabular-nums;">
              ${scoreData.totalScore}
            </div>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--muted);">Conferred Title</span>
            <div style="font-size: 1.1rem; font-weight: bold; color: #e5b567;">
              ${scoreData.rankTitle}
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.6rem; font-size: 0.8rem;">
          <div style="padding: 0.4rem; background: rgba(255,255,255,0.02); border-radius: 4px;">
            <div style="color: var(--muted);">Dominion</div>
            <strong style="color: #e06c75;">+${scoreData.breakdown.dominion}</strong>
          </div>
          <div style="padding: 0.4rem; background: rgba(255,255,255,0.02); border-radius: 4px;">
            <div style="color: var(--muted);">Tourism</div>
            <strong style="color: #98c379;">+${scoreData.breakdown.tourism}</strong>
          </div>
          <div style="padding: 0.4rem; background: rgba(255,255,255,0.02); border-radius: 4px;">
            <div style="color: var(--muted);">GDP</div>
            <strong style="color: #e5b567;">+${scoreData.breakdown.gdp}</strong>
          </div>
          <div style="padding: 0.4rem; background: rgba(255,255,255,0.02); border-radius: 4px;">
            <div style="color: var(--muted);">Innovation</div>
            <strong style="color: #61afef;">+${scoreData.breakdown.innovation}</strong>
          </div>
          <div style="padding: 0.4rem; background: rgba(255,255,255,0.02); border-radius: 4px;">
            <div style="color: var(--muted);">Estates (×2)</div>
            <strong style="color: #c678dd;">+${scoreData.breakdown.estateBonus}</strong>
          </div>
          <div style="padding: 0.4rem; background: rgba(255,255,255,0.02); border-radius: 4px;">
            <div style="color: var(--muted);">Settlements (×15)</div>
            <strong style="color: #56b6c2;">+${scoreData.breakdown.settlementBonus}</strong>
          </div>
          <div style="padding: 0.4rem; background: rgba(255,255,255,0.02); border-radius: 4px;">
            <div style="color: var(--muted);">Turn Tax</div>
            <strong style="color: #888;">-${scoreData.breakdown.turnPenalty}</strong>
          </div>
        </div>
      </div>

      <div class="actions" style="display: flex; gap: 0.8rem; justify-content: flex-end; flex-wrap: wrap;">
        <button id="btn-save-museum" class="btn btn-secondary" style="padding: 0.5rem 1rem;">
          Export Save as Museum
        </button>
        <button id="btn-museum-mode" class="btn btn-primary" style="padding: 0.5rem 1rem;">
          Continue in Museum Mode
        </button>
        <button id="btn-new-world" class="btn btn-danger" style="padding: 0.5rem 1rem;">
          Start New World
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const cleanup = () => {
    overlay.remove();
  };

  overlay.querySelector('#btn-save-museum')?.addEventListener('click', () => {
    // Generate read-only museum export JSON
    const museumData = {
      museumVersion: '1.0.0',
      title: card.title,
      stamp: card.stamp,
      turn: data.turn,
      score: scoreData,
      canonSummary: card.canonSummary,
      savedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(museumData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alchemists_empire_museum_turn_${data.turn}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  overlay.querySelector('#btn-museum-mode')?.addEventListener('click', () => {
    cleanup();
    data.onMuseumMode();
  });

  overlay.querySelector('#btn-new-world')?.addEventListener('click', () => {
    if (confirm('Start a fresh world? Any existing chronicle will be overwritten.')) {
      cleanup();
      data.onNewWorld();
    }
  });

  globalOverlayStack.push({
    id: overlay.id,
    close: cleanup,
  });
}
