/**
 * The First Commission & Country Selection Overlay
 *
 * Implements §6.18.0 & §6.22 of the Civ VII 4X Conversion Plan (v8):
 * - Country Selection screen on New Game (5 countries).
 * - Mud-port opener with the heap of scrap.
 * - First Craft assigns the first patron.
 */

import { globalOverlayStack } from './overlayStack';
import { COUNTRIES, type CountryDefinition } from '../engine/campaign/realm';

export function openCountrySelectOverlay(onSelect: (country: CountryDefinition) => void): void {
  const existing = document.getElementById('country-select-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'country-select-overlay';
  overlay.className = 'story-overlay country-select-overlay';

  overlay.innerHTML = `
    <div class="story-card" style="max-width: 820px; width: 92vw;">
      <header style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; margin-bottom: 1rem;">
        <h2 style="margin: 0; font-family: var(--font-heading, serif); font-size: 1.6rem;">Choose Your Country</h2>
        <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: var(--muted);">The Wasting sweeps across the land. Which kingdom will you answer?</p>
      </header>

      <div class="country-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.8rem;">
        ${COUNTRIES.map(
          (c) => `
          <button class="country-card btn-surgical" data-id="${c.id}" type="button" style="text-align: left; padding: 0.8rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; cursor: pointer; display: flex; flex-direction: column; gap: 0.4rem;">
            <div style="font-size: 1.1rem; font-weight: bold; color: #5aa5ff;">${c.name}</div>
            <div style="font-size: 0.78rem; color: var(--muted);">Ruler: <strong>${c.ruler}</strong></div>
            <div style="font-size: 0.78rem; color: #98c379;"><strong>Endowments:</strong> ${c.endowments}</div>
            <div style="font-size: 0.78rem; color: #e06c75;"><strong>Hardship:</strong> ${c.hardship}</div>
            <div style="font-size: 0.75rem; color: #e5b567; margin-top: auto;">Temperament: <em>${c.temperament}</em></div>
          </button>
        `,
        ).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    globalOverlayStack.remove(entry);
  };
  const entry = { id: overlay.id, close };
  globalOverlayStack.push(entry);

  overlay.querySelectorAll<HTMLButtonElement>('.country-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const countryId = btn.dataset.id;
      const country = COUNTRIES.find((c) => c.id === countryId)!;
      close();
      onSelect(country);
    });
  });
}

export function openMudPortOpener(country: CountryDefinition, onComplete: () => void): void {
  const existing = document.getElementById('mudport-opener-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'mudport-opener-overlay';
  overlay.className = 'story-overlay mudport-opener-overlay';

  overlay.innerHTML = `
    <div class="story-card" style="max-width: 600px; width: 90vw;">
      <header style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; margin-bottom: 1rem;">
        <h2 style="margin: 0; font-family: var(--font-heading, serif); font-size: 1.4rem;">The Mud-Port of ${country.name}</h2>
        <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--muted);">You are owed nothing. The country knows not your name.</p>
      </header>

      <p style="font-size: 0.9rem; line-height: 1.5; color: #ddd;">
        You arrive at the harbor tavern with no lab, no stock, no title, and no patron.
        Before you sits a meager heap of scrap salvaged from the mud:
        <em>two sticks, one loose river stone, a knife-point of sinew cord, and three handfuls of hearth ash.</em>
      </p>

      <p style="font-size: 0.85rem; color: #5aa5ff;">
        What you forge first at the workbench will reveal your first patron to the Realm.
      </p>

      <div style="margin-top: 1.2rem; display: flex; justify-content: flex-end;">
        <button id="btn-start-mudport" class="primary" style="padding: 0.5rem 1.2rem;" autofocus>Approach the Heap ▸</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    globalOverlayStack.remove(entry);
    onComplete();
  };
  const entry = { id: overlay.id, close };
  globalOverlayStack.push(entry);

  overlay.querySelector('#btn-start-mudport')?.addEventListener('click', close);
}
