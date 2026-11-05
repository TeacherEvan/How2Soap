/**
 * The Turning Overlay (Age I -> Age II)
 *
 * Implements §6.2, §6.3, §8.4 of the Civ VII 4X Conversion Plan (v8):
 * - (1) Choose your Civ lineage (Ash Walkers, Shore Clan, Salt Gatherers).
 * - (2) Choose three Dedications.
 * - (3) Spend Leader Attribute Points.
 */

import { globalOverlayStack } from './overlayStack';
import { AGE_I_CIVS, DEDICATIONS } from '../engine/campaign/ageProgress';

export function openTheTurningOverlay(
  attributePoints: number,
  onComplete: (selection: { civId: string; dedications: string[]; spentPoints: number }) => void,
): void {
  const existing = document.getElementById('the-turning-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'the-turning-overlay';
  overlay.className = 'story-overlay turning-overlay';

  let selectedCiv = AGE_I_CIVS[0].id;
  const selectedDedications = new Set<string>();

  overlay.innerHTML = `
    <div class="story-card" style="max-width: 860px; width: 92vw; max-height: 90vh; overflow-y: auto;">
      <header style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; margin-bottom: 1rem;">
        <h2 style="margin: 0; font-family: var(--font-heading, serif); font-size: 1.6rem; color: #e5b567;">The Turning — Age I Closes</h2>
        <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--muted);">The Ash recedes; the Crown recognizes your works. Shape your legacy into the Brass Age.</p>
      </header>

      <section style="margin-bottom: 1.2rem;">
        <h3 style="margin: 0 0 0.5rem; font-size: 1rem; color: #5aa5ff;">1. Choose Your Civilization Lineage</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.8rem;">
          ${AGE_I_CIVS.map(
            (civ, idx) => `
            <div class="civ-card" data-civ="${civ.id}" style="padding: 0.8rem; background: ${idx === 0 ? 'rgba(90, 165, 255, 0.15)' : 'rgba(255,255,255,0.03)'}; border: 1px solid ${idx === 0 ? '#5aa5ff' : 'rgba(255,255,255,0.1)'}; border-radius: 6px; cursor: pointer;">
              <div style="font-weight: bold; margin-bottom: 0.3rem;">${civ.name}</div>
              <div style="font-size: 0.8rem; color: var(--muted); margin-bottom: 0.4rem;">${civ.description}</div>
              <div style="font-size: 0.75rem; color: #98c379;"><strong>Perk:</strong> ${civ.perk}</div>
            </div>
          `,
          ).join('')}
        </div>
      </section>

      <section style="margin-bottom: 1.2rem;">
        <h3 style="margin: 0 0 0.5rem; font-size: 1rem; color: #5aa5ff;">2. Select Three Dedications (<span id="dedication-count">0</span> / 3)</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.8rem;">
          ${DEDICATIONS.map(
            (ded) => `
            <div class="dedication-card" data-ded="${ded.id}" style="padding: 0.8rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; cursor: pointer;">
              <div style="font-weight: bold; font-size: 0.9rem;">${ded.name}</div>
              <div style="font-size: 0.75rem; color: var(--muted); margin-bottom: 0.3rem;">${ded.description}</div>
              <div style="font-size: 0.75rem; color: #e5b567;">${ded.effect}</div>
            </div>
          `,
          ).join('')}
        </div>
      </section>

      <section style="margin-bottom: 1.2rem;">
        <h3 style="margin: 0 0 0.5rem; font-size: 1rem; color: #5aa5ff;">3. Leader Attribute Points</h3>
        <p style="font-size: 0.85rem; color: var(--muted); margin: 0;">You have earned <strong>${attributePoints}</strong> milestone points for your mastery over early chemistry.</p>
      </section>

      <div style="margin-top: 1.2rem; display: flex; justify-content: flex-end;">
        <button id="btn-seal-turning" class="primary" style="padding: 0.5rem 1.4rem;" disabled>Seal the Turning ▸</button>
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

  const civCards = overlay.querySelectorAll<HTMLElement>('.civ-card');
  civCards.forEach((c) => {
    c.addEventListener('click', () => {
      selectedCiv = c.dataset.civ!;
      civCards.forEach((other) => {
        const isSel = other.dataset.civ === selectedCiv;
        other.style.background = isSel ? 'rgba(90, 165, 255, 0.15)' : 'rgba(255,255,255,0.03)';
        other.style.borderColor = isSel ? '#5aa5ff' : 'rgba(255,255,255,0.1)';
      });
    });
  });

  const dedCards = overlay.querySelectorAll<HTMLElement>('.dedication-card');
  const countSpan = overlay.querySelector<HTMLElement>('#dedication-count')!;
  const sealBtn = overlay.querySelector<HTMLButtonElement>('#btn-seal-turning')!;

  dedCards.forEach((d) => {
    d.addEventListener('click', () => {
      const dedId = d.dataset.ded!;
      if (selectedDedications.has(dedId)) {
        selectedDedications.delete(dedId);
        d.style.background = 'rgba(255,255,255,0.03)';
        d.style.borderColor = 'rgba(255,255,255,0.08)';
      } else {
        if (selectedDedications.size >= 3) return;
        selectedDedications.add(dedId);
        d.style.background = 'rgba(152, 195, 121, 0.15)';
        d.style.borderColor = '#98c379';
      }
      countSpan.textContent = String(selectedDedications.size);
      sealBtn.disabled = selectedDedications.size !== 3;
    });
  });

  sealBtn.addEventListener('click', () => {
    close();
    onComplete({
      civId: selectedCiv,
      dedications: Array.from(selectedDedications),
      spentPoints: attributePoints,
    });
  });
}
