import type { WindowSpec } from '../WindowManager';
import { state } from '../../app/state';
import { claimCommission, type ActiveCommission } from '../../engine/commissions';
import { audio } from '../audio';
import { showToast } from '../Toast';

function renderCommissionsContent(container: HTMLElement): void {
  const commState = (state as any).commissions;
  const streak = commState?.streak ?? 0;
  const active: ActiveCommission[] = commState?.active ?? [];
  const day = (state as any).player?.day ?? 1;

  container.innerHTML = `
    <div class="commissions-window" role="region" aria-label="Daily Commissions" style="display: flex; flex-direction: column; gap: 1.2rem; padding: 0.5rem;">
      <header class="commissions-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.8rem;">
        <div>
          <h2 style="margin: 0; font-size: 1.2rem; color: #f1dbb1;">Daily Civic Commissions</h2>
          <p class="hint" style="margin: 4px 0 0 0; font-size: 0.82rem; color: var(--muted);">Fulfilled at the bench or colony, claimed manually for Hearth Renown.</p>
        </div>
        <div class="streak-badge" id="commissions-streak" style="display: flex; align-items: center; gap: 6px; background: rgba(223, 168, 59, 0.15); border: 1px solid #dfa83b; padding: 6px 12px; border-radius: 20px;">
          <span class="flame-icon" aria-hidden="true" style="font-size: 1.1rem;">🔥</span>
          <strong style="color: #ffd88a; font-size: 0.9rem;">${streak} Day Streak</strong>
        </div>
      </header>

      <div class="commissions-list" id="commissions-list" style="display: flex; flex-direction: column; gap: 1rem;">
        ${
          active.length === 0
            ? '<p class="hint">No commissions posted for today.</p>'
            : active
                .map((comm) => {
                  const pct = Math.min(100, Math.round((comm.progress / comm.target) * 100));
                  const canClaim = comm.complete && !comm.claimed;
                  return `
                    <div class="commission-card" style="background: rgba(18, 24, 32, 0.7); border: 1px solid ${canClaim ? '#c5a059' : 'rgba(255,255,255,0.08)'}; border-radius: 8px; padding: 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; box-shadow: ${canClaim ? '0 0 12px rgba(197, 160, 89, 0.2)' : 'none'};">
                      <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem;">
                          <strong style="color: #e5edf5; font-size: 0.95rem;">${comm.label}</strong>
                          <span style="color: #5aa5ff; font-weight: 600; font-size: 0.85rem;">+${comm.renownReward} Renown</span>
                        </div>
                        <div class="comm-prog-bar" role="progressbar" aria-valuenow="${comm.progress}" aria-valuemin="0" aria-valuemax="${comm.target}" style="height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-bottom: 0.3rem;">
                          <div style="height: 100%; transform-origin: left; transform: scaleX(${pct / 100}); background: ${canClaim ? '#48bb78' : '#3182ce'}; transition: transform 140ms ease;"></div>
                        </div>
                        <div style="font-size: 0.78rem; color: var(--muted);">
                          Progress: ${comm.progress} / ${comm.target} (${pct}%)
                        </div>
                      </div>

                      <div>
                        ${
                          comm.claimed
                            ? '<span style="color: var(--muted); font-size: 0.85rem; font-weight: 500;">✓ Claimed</span>'
                            : `<button class="btn btn-claim-commission" data-id="${comm.id}" ${canClaim ? '' : 'disabled'} style="min-width: 90px; min-height: 36px; font-weight: 600; ${canClaim ? 'background: #c5a059; color: #12151c; border-color: #ffd88a;' : 'opacity: 0.5;'}">
                                ${canClaim ? 'Claim' : 'In Flight'}
                              </button>`
                        }
                      </div>
                    </div>
                  `;
                })
                .join('')
        }
      </div>
    </div>
  `;

  container.querySelectorAll<HTMLButtonElement>('.btn-claim-commission').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (!id || !commState) return;

      const res = claimCommission(commState, id, day);
      if (res.success) {
        audio.stimulantShimmer();
        state.progression.renown = (state.progression.renown || 0) + res.renownReward;
        showToast(`+${res.renownReward} Renown claimed! Day ${res.streakMilestone ? `${commState.streak} Milestone` : `${commState.streak} streak`}`, 'success');

        if (res.streakMilestone) {
          if ((state as any).realm) {
            (state as any).realm.vigor = Math.min(100, ((state as any).realm.vigor || 50) + 10);
          }
          showToast(`7-Day Streak Milestone! Hearth Vigor +10`, 'success');
        }

        renderCommissionsContent(container);
      }
    });
  });
}

export const commissionsWindowSpec: WindowSpec = {
  id: 'commissions',
  title: 'Day Commissions',
  icon: '🎯',
  mount(container: HTMLElement) {
    renderCommissionsContent(container);
  },
  onSnapshot(_snapshot, container: HTMLElement) {
    renderCommissionsContent(container);
  },
};

export const spec = commissionsWindowSpec;
