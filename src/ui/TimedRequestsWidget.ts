/**
 * TimedRequestsWidget — Renders active town requests in the Right Sidebar / Workbench
 */
import './timedRequests.css';
import { itemIcon } from './icons';
import { ITEM_BY_ID } from '../data/items';
import type { TimedRequest } from '../engine/timedRequests';

export function renderTimedRequestsHTML(
  requests: Array<TimedRequest | null> | undefined,
  currentTick: number,
): string {
  const activeReqs = (requests ?? []).filter((r): r is TimedRequest => r !== null && r.status === 'active');

  if (activeReqs.length === 0) {
    return `
      <div class="timed-requests-card empty">
        <div class="tr-header">
          <h4>🏛️ Town & Clinic Requests</h4>
          <span class="tr-badge">Quiet</span>
        </div>
        <p class="tr-hint">All town orders fulfilled. Next request arriving shortly…</p>
      </div>
    `;
  }

  return `
    <div class="timed-requests-card">
      <div class="tr-header">
        <h4>🏛️ Town & Clinic Requests</h4>
        <span class="tr-badge active">${activeReqs.length} Active</span>
      </div>
      <div class="tr-list">
        ${activeReqs.map((req) => {
          const itemDef = ITEM_BY_ID[req.requiredItemId];
          const icon = itemIcon(req.requiredItemId, 20);
          const totalDuration = req.deadlineTick - req.spawnTick;
          const remaining = Math.max(0, req.deadlineTick - currentTick);
          const ratio = totalDuration > 0 ? Math.min(1, remaining / totalDuration) : 0;
          const pct = Math.round(ratio * 100);

          let barColor = '#4caf50'; // Green
          if (ratio < 0.2) barColor = '#f44336'; // Red
          else if (ratio < 0.5) barColor = '#ff9800'; // Amber

          return `
            <div class="request-slot-card" data-slot="${req.slot}">
              <div class="req-title-row">
                <strong>${req.title}</strong>
                <span class="req-urgency tier-${req.urgencyTier}">${req.urgencyTier === 3 ? 'EMERGENCY' : req.urgencyTier === 2 ? 'URGENT' : 'STANDARD'}</span>
              </div>
              <div class="req-details-row">
                <div class="req-item-info">
                  ${icon}
                  <span>${itemDef?.name ?? req.requiredItemId} &times;${req.requiredQty}</span>
                </div>
                <div class="req-reward">
                  <span class="renown-gain">+${req.rewardRenown} Renown</span>
                </div>
              </div>
              <div class="req-progress-bar-wrap">
                <div class="req-progress-fill" style="transform: scaleX(${Math.max(0, Math.min(1, pct / 100))}); background: ${barColor};"></div>
              </div>
              <div class="req-actions-row">
                <span class="req-timer-text">${remaining}s remaining</span>
                <button class="btn btn-primary btn-sm btn-deliver-request" data-slot="${req.slot}">Deliver</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

export function renderTimedRequestsWidget(
  container: HTMLElement,
  requests: Array<TimedRequest | null> | undefined,
  currentTick: number,
  onDeliver: (slot: number) => void,
): void {
  if (!container) return;

  const activeReqs = (requests ?? []).filter((r): r is TimedRequest => r !== null && r.status === 'active');

  if (activeReqs.length === 0) {
    container.innerHTML = `
      <div class="timed-requests-card empty">
        <div class="tr-header">
          <h4>🏛️ Town &amp; Clinic Requests</h4>
          <span class="tr-badge">Quiet</span>
        </div>
        <p class="tr-hint">All town orders fulfilled. Next request arriving shortly…</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="timed-requests-card">
      <div class="tr-header">
        <h4>🏛️ Town &amp; Clinic Requests</h4>
        <span class="tr-badge active">${activeReqs.length} Active</span>
      </div>
      <div class="tr-list">
        ${activeReqs.map((req) => {
          const itemDef = ITEM_BY_ID[req.requiredItemId];
          const icon = itemIcon(req.requiredItemId, 20);
          const totalDuration = req.deadlineTick - req.spawnTick;
          const remaining = Math.max(0, req.deadlineTick - currentTick);
          const ratio = totalDuration > 0 ? Math.min(1, remaining / totalDuration) : 0;
          const pct = Math.round(ratio * 100);

          let barColor = '#4caf50'; // Green
          if (ratio < 0.2) barColor = '#f44336'; // Red
          else if (ratio < 0.5) barColor = '#ff9800'; // Amber

          return `
            <div class="request-slot-card" data-slot="${req.slot}">
              <div class="req-title-row">
                <strong>${req.title}</strong>
                <span class="req-urgency tier-${req.urgencyTier}">${req.urgencyTier === 3 ? 'EMERGENCY' : req.urgencyTier === 2 ? 'URGENT' : 'STANDARD'}</span>
              </div>
              <div class="req-details-row">
                <div class="req-item-info">
                  ${icon}
                  <span>${itemDef?.name ?? req.requiredItemId} &times;${req.requiredQty}</span>
                </div>
                <div class="req-reward">
                  <span class="renown-gain">+${req.rewardRenown} Renown</span>
                </div>
              </div>
              <div class="req-progress-bar-wrap">
                <div class="req-progress-fill" style="transform: scaleX(${Math.max(0, Math.min(1, pct / 100))}); background: ${barColor};"></div>
              </div>
              <div class="req-actions-row">
                <span class="req-timer-text">${remaining}s remaining</span>
                <button class="btn btn-primary btn-sm btn-deliver-request" data-slot="${req.slot}">Deliver</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll<HTMLButtonElement>('.btn-deliver-request').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slot = Number(btn.dataset.slot);
      if (!isNaN(slot)) onDeliver(slot);
    });
  });
}
