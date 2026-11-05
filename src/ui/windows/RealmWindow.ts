/**
 * The Realm Window (WindowManager, Key 6)
 *
 * Implements §6.18.6 & §6.18.8 of the Civ VII 4X Conversion Plan (v8):
 * - Displays Three National Indices: Public Health, Public Safety, Hearth Vigor.
 * - Displays Three Estates: Crown, Army, Public.
 * - Program readouts: The Dose exposure, Tunics delivered, Guards assigned.
 * - Action buttons for Program Releases (The Dose, The Hearth Cloth, The Arsenal).
 */

import type { WindowSpec } from '../WindowManager';
import { state, send } from '../../app/state';
import { COUNTRIES } from '../../engine/campaign/realm';

export const spec: WindowSpec = {
  id: 'realm',
  title: 'The Realm of Science',
  icon: '🏛️',
  size: 'wide',
  mount(body: HTMLElement) {
    const realm = state.realm;
    const country = COUNTRIES.find((c) => c.id === realm?.countryId) ?? COUNTRIES[0];

    const health = realm ? realm.health : country.initialHealth;
    const safety = realm ? realm.safety : country.initialSafety;
    const vigor = realm ? realm.vigor : country.initialVigor;
    const crown = realm ? realm.estates.crown : 60;
    const army = realm ? realm.estates.army : 60;
    const pub = realm ? realm.estates.public : 60;

    body.innerHTML = `
      <div class="realm-window-container" style="display: flex; flex-direction: column; gap: 1rem; padding: 0.5rem;">
        <header style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">
          <h2 style="margin: 0; font-family: var(--font-heading, serif);">${country.name}</h2>
          <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--muted);">Ruler: <strong>${country.ruler}</strong> · Hardship: ${country.hardship}</p>
        </header>

        <section class="realm-indices-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
          <div class="realm-stat-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 0.75rem;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--muted);">Public Health</div>
            <div style="font-size: 1.5rem; font-weight: bold; font-variant-numeric: tabular-nums;">${health}%</div>
            <div style="font-size: 0.75rem; color: #888;">The Wasting: -1%/turn</div>
          </div>
          <div class="realm-stat-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 0.75rem;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--muted);">Public Safety</div>
            <div style="font-size: 1.5rem; font-weight: bold; font-variant-numeric: tabular-nums;">${safety}%</div>
            <div style="font-size: 0.75rem; color: #888;">Crisis Mitigator</div>
          </div>
          <div class="realm-stat-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 0.75rem;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--muted);">Hearth Vigor</div>
            <div style="font-size: 1.5rem; font-weight: bold; font-variant-numeric: tabular-nums;">${vigor}%</div>
            <div style="font-size: 0.75rem; color: #888;">Exposure: ${realm?.doseExposure ?? 0}%</div>
          </div>
        </section>

        <section class="realm-estates" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 0.75rem;">
          <h3 style="margin: 0 0 0.5rem; font-size: 0.95rem;">The Three Estates Mandate</h3>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.2rem;">
                <span>The Crown (Court / Regent)</span>
                <span><strong>${crown}/100</strong></span>
              </div>
              <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${crown}%; background: #e5b567;"></div>
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.2rem;">
                <span>The Army (The Watch / Garrison)</span>
                <span><strong>${army}/100</strong></span>
              </div>
              <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${army}%; background: #e06c75;"></div>
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.2rem;">
                <span>The Public (Towns / Crowd)</span>
                <span><strong>${pub}/100</strong></span>
              </div>
              <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${pub}%; background: #61afef;"></div>
              </div>
            </div>
          </div>
        </section>

        <section class="realm-actions" style="margin-top: 0.5rem;">
          <h3 style="margin: 0 0 0.5rem; font-size: 0.95rem;">Distribution Programs</h3>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button id="btn-distribute-stimulant" class="btn-dock" type="button" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
              Administer Willow Tea (The Dose)
            </button>
            <button id="btn-distribute-clothes" class="btn-dock" type="button" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
              Distribute Tunics (Hearth Cloth)
            </button>
            <button id="btn-distribute-weapons" class="btn-dock" type="button" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
              Arm Watch (The Arsenal)
            </button>
          </div>
        </section>
      </div>
    `;

    body.querySelector('#btn-distribute-stimulant')?.addEventListener('click', () => {
      send({ type: 'DISTRIBUTE_STIMULANTS', commodity: 'WILLOW_TEA', crates: 1 });
    });
    body.querySelector('#btn-distribute-clothes')?.addEventListener('click', () => {
      send({ type: 'DISTRIBUTE_CLOTHES', tunics: 1 });
    });
    body.querySelector('#btn-distribute-weapons')?.addEventListener('click', () => {
      send({ type: 'DISTRIBUTE_WEAPONS', weaponsCount: 1 });
    });
  },
};
