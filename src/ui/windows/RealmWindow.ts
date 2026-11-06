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
import {
  evaluateVictoryEligibilities,
  calculateTestOfTimeScore,
  createInitialVictoryState,
  type VictoryType,
} from '../../engine/campaign/victories';
import { createInitialBuiltWorks } from '../../engine/campaign/builtWorks';

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

    const settlementsState = state.settlements ?? { settlements: [], settlementLimit: 3, globalYields: { food: 0, production: 0, trade: 0, discovery: 0, renown: 0, morale: 50, influence: 0 } };
    const builtWorksState = state.builtWorks ?? createInitialBuiltWorks();
    const victoryState = state.victories ?? createInitialVictoryState();
    const currentAge = state.ageProgress?.currentAge ?? 1;

    const eligibilities = evaluateVictoryEligibilities(
      victoryState,
      realm ?? { countryId: country.id, turn: 1, health, safety, vigor, doseExposure: 0, doseImmunityTurns: 0, tunicsDeliveredTotal: 0, guardsAssignedTotal: 0, estates: { crown, army, public: pub, crownWarned25: false, crownWarned10: false, armyWarned25: false, armyWarned10: false, publicWarned25: false, publicWarned10: false }, deposal: null },
      settlementsState,
      currentAge,
      builtWorksState,
    );

    const scoreCalc = calculateTestOfTimeScore(
      victoryState,
      realm ?? { countryId: country.id, turn: 1, health, safety, vigor, doseExposure: 0, doseImmunityTurns: 0, tunicsDeliveredTotal: 0, guardsAssignedTotal: 0, estates: { crown, army, public: pub, crownWarned25: false, crownWarned10: false, armyWarned25: false, armyWarned10: false, publicWarned25: false, publicWarned10: false }, deposal: null },
      settlementsState,
      state.player?.day ?? 1,
    );

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

        <!-- Test of Time & Victory Paths Ledger (§6.10, §6.18.5, M8) -->
        <section class="realm-victories" style="margin-top: 0.5rem; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 0.8rem;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.6rem;">
            <h3 style="margin: 0; font-size: 0.95rem; color: #e5b567;">Test of Time: Victory Horizons</h3>
            <span style="font-size: 0.8rem; color: #5aa5ff;">Campaign Score: ${scoreCalc.totalScore} (${scoreCalc.rankTitle})</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 0.8rem; font-size: 0.8rem; text-align: center;">
            <div style="background: rgba(255,255,255,0.02); padding: 0.4rem; border-radius: 4px;">
              <div style="color: var(--muted);">Dominion</div>
              <strong style="color: #e06c75;">${victoryState.scores.dominion}</strong>
            </div>
            <div style="background: rgba(255,255,255,0.02); padding: 0.4rem; border-radius: 4px;">
              <div style="color: var(--muted);">Tourism</div>
              <strong style="color: #98c379;">${victoryState.scores.tourism}</strong>
            </div>
            <div style="background: rgba(255,255,255,0.02); padding: 0.4rem; border-radius: 4px;">
              <div style="color: var(--muted);">GDP</div>
              <strong style="color: #e5b567;">${victoryState.scores.gdp}</strong>
            </div>
            <div style="background: rgba(255,255,255,0.02); padding: 0.4rem; border-radius: 4px;">
              <div style="color: var(--muted);">Innovation</div>
              <strong style="color: #61afef;">${victoryState.scores.innovation}</strong>
            </div>
          </div>

          <div class="victories-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${eligibilities
              .map(
                (v) => `
              <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid ${v.eligible ? 'rgba(152,195,121,0.4)' : 'rgba(255,255,255,0.05)'}; padding: 0.5rem 0.8rem; border-radius: 4px;">
                <div style="flex: 1; padding-right: 0.5rem;">
                  <div style="font-weight: bold; font-size: 0.85rem; color: ${v.eligible ? '#98c379' : '#abb2bf'};">${v.title}</div>
                  <div style="font-size: 0.75rem; color: var(--muted);">${v.description}</div>
                  ${
                    v.missingRequirements && v.missingRequirements.length > 0
                      ? `<div style="font-size: 0.75rem; color: #e5c07b; margin-top: 0.2rem;">Missing: ${v.missingRequirements.join(' · ')}</div>`
                      : '<div style="font-size: 0.75rem; color: #98c379; margin-top: 0.2rem;">✓ All requirements fulfilled! Ready to claim.</div>'
                  }
                </div>
                <div>
                  <button class="btn-surgical btn-claim-victory" data-victory="${v.type}" ${v.eligible ? '' : 'disabled'} style="padding: 4px 10px; font-size: 0.75rem; ${v.eligible ? 'background: #98c379; color: #12151c; font-weight: bold;' : 'opacity: 0.5;'}">
                    Claim
                  </button>
                </div>
              </div>
            `,
              )
              .join('')}
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

    body.querySelectorAll<HTMLButtonElement>('.btn-claim-victory').forEach((btn) => {
      btn.addEventListener('click', () => {
        const vicType = btn.dataset.victory as VictoryType;
        import('../VictoryDeposalOverlay').then(({ openVictoryDeposalModal }) => {
          openVictoryDeposalModal({
            endingType: vicType,
            victoryState: victoryState,
            realm: realm ?? { countryId: country.id, turn: 1, health, safety, vigor, doseExposure: 0, doseImmunityTurns: 0, tunicsDeliveredTotal: 0, guardsAssignedTotal: 0, estates: { crown, army, public: pub, crownWarned25: false, crownWarned10: false, armyWarned25: false, armyWarned10: false, publicWarned25: false, publicWarned10: false }, deposal: null },
            settlements: settlementsState,
            builtWorks: builtWorksState,
            patronId: state.patron?.patronId ?? null,
            turn: state.player?.day ?? 1,
            onMuseumMode: () => {
              victoryState.isMuseumMode = true;
              victoryState.claimedVictory = vicType;
            },
            onNewWorld: () => {
              localStorage.removeItem('how2soap.save.v3');
              localStorage.removeItem('how2soap.save.v2');
              location.reload();
            },
          });
        });
      });
    });
  },
};
