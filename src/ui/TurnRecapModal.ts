/**
 * Turn Recap Modal with Bench Ledger
 *
 * Implements §6.16 of the Civ VII 4X Conversion Plan (v8):
 * - Illustrated turn recap grouped by Omens, Deeds, Losses, Council, and The Bench.
 * - Bench Ledger highlights active experiments, days remaining, and completed items.
 */

import { globalOverlayStack } from './overlayStack';

export interface TurnRecapData {
  turn: number;
  events: Array<{ vesselId: number; message: string }>;
  benchLedger: Array<{ label: string; turnsLeft: number; done: boolean }>;
  healthDelta?: number;
  safetyDelta?: number;
  vigorDelta?: number;
}

export function openTurnRecapModal(data: TurnRecapData, onDismiss?: () => void): void {
  const existing = document.getElementById('turn-recap-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'turn-recap-overlay';
  overlay.className = 'story-overlay turn-recap-overlay';

  const omens = data.events.filter((e) => e.message.includes('Crisis') || e.message.includes('strike') || e.message.includes('Omen'));
  const deeds = data.events.filter((e) => e.message.includes('Skimmed') || e.message.includes('Delivered') || e.message.includes('Finished') || e.message.includes('Formed'));
  const losses = data.events.filter((e) => e.message.includes('expired') || e.message.includes('failed') || e.message.includes('wasting'));
  const other = data.events.filter((e) => !omens.includes(e) && !deeds.includes(e) && !losses.includes(e));

  const renderEventList = (items: Array<{ message: string }>, emptyText: string) => {
    if (items.length === 0) return `<p style="font-size: 0.85rem; color: var(--muted); font-style: italic;">${emptyText}</p>`;
    return `<ul style="margin: 0; padding-left: 1.2rem; font-size: 0.85rem;">${items.map((i) => `<li>${i.message}</li>`).join('')}</ul>`;
  };

  overlay.innerHTML = `
    <div class="story-card" style="max-width: 680px; width: 90vw;">
      <header style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; margin-bottom: 1rem;">
        <h2 style="margin: 0; font-family: var(--font-heading, serif); font-size: 1.5rem;">Dawn of Day ${data.turn}</h2>
        <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--muted);">The flasks have rested; the Realm measures the ledger.</p>
      </header>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <!-- Left: Bench Ledger -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 0.75rem;">
          <h3 style="margin: 0 0 0.5rem; font-size: 0.95rem; color: #5aa5ff;">⚗ The Bench Ledger</h3>
          ${
            data.benchLedger.length === 0
              ? '<p style="font-size: 0.85rem; color: var(--muted); font-style: italic;">No active experiments in flight.</p>'
              : `<ul style="margin: 0; padding-left: 1.2rem; font-size: 0.85rem;">${data.benchLedger
                  .map((b) => `<li>${b.done ? '✓ <strong>' + b.label + '</strong> (Finished)' : '⏳ ' + b.label + ' (' + b.turnsLeft + ' turns left)'}</li>`)
                  .join('')}</ul>`
          }
        </div>

        <!-- Right: Deeds & Omens -->
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 0.75rem;">
            <h3 style="margin: 0 0 0.5rem; font-size: 0.95rem; color: #98c379;">✦ Deeds of the Craft</h3>
            ${renderEventList(deeds, 'No major discoveries or deliveries this dawn.')}
          </div>
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 0.75rem;">
            <h3 style="margin: 0 0 0.5rem; font-size: 0.95rem; color: #e5b567;">⚠ Omens & Forewarnings</h3>
            ${renderEventList(omens, 'The frontier sleeps in peace.')}
          </div>
        </div>
      </div>

      ${
        losses.length > 0 || other.length > 0
          ? `
        <div style="margin-top: 0.75rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 0.75rem;">
          <h3 style="margin: 0 0 0.5rem; font-size: 0.95rem; color: #e06c75;">Losses & General Chronicle</h3>
          ${renderEventList([...losses, ...other], 'Quiet hours.')}
        </div>
      `
          : ''
      }

      <div style="margin-top: 1.2rem; display: flex; justify-content: flex-end;">
        <button id="btn-dismiss-recap" class="primary" style="padding: 0.5rem 1.2rem;" autofocus>Begin Day ${data.turn} ▸</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    globalOverlayStack.remove(entry);
    if (onDismiss) onDismiss();
  };

  const entry = { id: overlay.id, close };
  globalOverlayStack.push(entry);

  overlay.querySelector('#btn-dismiss-recap')?.addEventListener('click', close);
}
