/**
 * Animal Paddocks window — live roster, live ledger, honest empty state.
 * Reads state.paddock, which PLAYER_SYNC keeps current from the worker.
 */
import { state, send } from '../../app/state';
import type { WindowSpec } from '../WindowManager';
import { projectPaddock, hungerBand } from '../paddockModel';
import type { DomesticAnimal } from '../../engine/husbandry';

interface PaddockUiState {
  animalsCount?: number;
  animals?: DomesticAnimal[];
  storedFeedKg?: number;
  storedWaterL?: number;
  accumulatedManureKg?: number;
  feedKg?: number;
  waterL?: number;
  manureKg?: number;
}

function refresh(body: HTMLElement): void {
  const paddock = state.paddock as PaddockUiState;
  const animals = paddock.animals ?? [];
  const feed = paddock.storedFeedKg ?? paddock.feedKg ?? 0;
  const water = paddock.storedWaterL ?? paddock.waterL ?? 0;
  const manure = paddock.accumulatedManureKg ?? paddock.manureKg ?? 0;

  body.querySelector<HTMLElement>('[data-stat="count"]')!.textContent = `${animals.length} animal${animals.length === 1 ? '' : 's'}`;
  body.querySelector<HTMLElement>('[data-stat="feed"]')!.textContent = `${feed.toFixed(1)} kg`;
  body.querySelector<HTMLElement>('[data-stat="water"]')!.textContent = `${water.toFixed(1)} L`;
  body.querySelector<HTMLElement>('[data-stat="manure"]')!.textContent = `${manure.toFixed(2)} kg`;

  const proj = projectPaddock(animals as readonly DomesticAnimal[], feed);
  const projEl = body.querySelector<HTMLElement>('.paddock-win-projection')!;
  if (animals.length === 0) {
    projEl.textContent = 'Standing empty — capture livestock to begin milk, butterfat and niter income.';
    projEl.classList.remove('warn');
  } else {
    const days = Number.isFinite(proj.daysOfFeed) ? proj.daysOfFeed.toFixed(1) : '∞';
    const warn = proj.daysOfFeed < 3;
    projEl.textContent = `Daily: ${proj.dailyFeedKg.toFixed(1)} kg fodder · ${proj.dailyWaterL.toFixed(1)} L · ≈ ${proj.milkLPerDay.toFixed(1)} L milk · ${proj.butterfatGPerDay.toFixed(0)} g butterfat · ${proj.eggsPerDay} eggs · ${proj.manureKgPerDay.toFixed(2)} kg manure — fodder lasts ${days} days${warn ? ' (refill soon)' : ''}`;
    projEl.classList.toggle('warn', warn);
  }

  const bodyEl = body.querySelector<HTMLElement>('.paddock-win-body')!;
  if (animals.length === 0) {
    bodyEl.innerHTML = `<div class="paddock-empty"><p>🐾 No livestock yet.</p><p class="hint">Goats, jungle fowl and aurochs are out there. Capture one below; each eats its own fodder per day, and pays it back in butterfat, eggs and niter.</p></div>`;
    return;
  }
  bodyEl.innerHTML = `<div class="animal-cards">
    ${animals.map((a) => `
      <div class="animal-card">
        <h4>${a.species === 'GOAT' ? '🐐' : a.species.includes('FOWL') ? '🐓' : '🦬'} ${a.species.replace(/_/g, ' ')}</h4>
        <div class="hunger-bar ${hungerBand(a.hungerPct)}" title="Hunger ${a.hungerPct.toFixed(0)}%"><div style="width:${Math.min(100, a.hungerPct).toFixed(0)}%"></div></div>
        <dl>
          <dt>Feed</dt><dd>${a.dailyFeedKg.toFixed(1)} kg/day</dd>
          <dt>Water</dt><dd>${a.dailyWaterL.toFixed(1)} L/day</dd>
          <dt>Milk</dt><dd>${a.milkLPerDay.toFixed(1)} L/day</dd>
          <dt>Butterfat</dt><dd>${a.butterfatGramsPerDay.toFixed(0)} g/day</dd>
          <dt>Eggs</dt><dd>${a.eggsPerDay}/day</dd>
          <dt>Manure</dt><dd>${a.manureKgPerDay.toFixed(2)} kg/day</dd>
        </dl>
      </div>`).join('')}
  </div>`;
}

export const spec: WindowSpec = {
  id: 'paddocks',
  title: 'Animal Paddocks',
  icon: '🌾',
  size: 'wide',
  mount(body: HTMLElement) {
    body.innerHTML = `
      <div class="paddock-win-stats">
        <div class="paddock-win-stat"><span>Livestock</span><strong data-stat="count">0</strong></div>
        <div class="paddock-win-stat"><span>Stored Fodder</span><strong data-stat="feed">0 kg</strong></div>
        <div class="paddock-win-stat"><span>Fresh Water</span><strong data-stat="water">0 L</strong></div>
        <div class="paddock-win-stat"><span>Manure / Niter</span><strong data-stat="manure">0 kg</strong></div>
      </div>
      <p class="paddock-win-projection" role="status"></p>
      <div class="paddock-win-body"></div>
      <div class="paddock-actions" style="margin-top:0.75rem;">
        <button class="ghost" data-paddock-action="feed">+ Add 5 kg Fodder</button>
        <button class="ghost" data-paddock-action="water">+ Refill 10 L Water Trough</button>
        <button class="btn btn-primary" data-capture="GOAT" title="Capture a wild dairy goat (−120 kcal)">🐐 Capture Goat</button>
        <button class="btn btn-secondary" data-capture="RED_JUNGLE_FOWL" title="Capture a jungle fowl (−120 kcal)">🐓 Capture Fowl</button>
      </div>
    `;

    body.querySelector<HTMLButtonElement>('[data-paddock-action="feed"]')!
      .addEventListener('click', () => send({ type: 'FEED_PADDOCK', massKg: 5 }));
    body.querySelector<HTMLButtonElement>('[data-paddock-action="water"]')!
      .addEventListener('click', () => send({ type: 'WATER_PADDOCK', liters: 10 }));
    body.querySelectorAll<HTMLButtonElement>('[data-capture]').forEach((btn) =>
      btn.addEventListener('click', () => send({ type: 'CAPTURE_ANIMAL', species: btn.dataset.capture })),
    );

    refresh(body);
  },
  onSnapshot(_snapshot, body) {
    refresh(body);
  },
};
