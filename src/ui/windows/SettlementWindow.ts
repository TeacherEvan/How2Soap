/**
 * Settlement Window (WindowManager, Key 5, Size 'wide')
 *
 * Implements §8.3 of Civ VII 4X Conversion Plan (v8):
 * - Overview: Settlement kind (Camp/Town/City), focus, population, food net, 7-yield breakdown.
 * - Buildings & Districts list with overbuild-50% badges.
 * - Focus selector (Farming, Mining, Trade, Fort, Urban, Growing).
 * - Distribute Tunics & Weapons quick actions.
 */

import type { WindowSpec } from '../WindowManager';
import { state, send } from '../../app/state';
import type { Settlement, TownFocus } from '../../engine/campaign/settlements';

export const spec: WindowSpec = {
  id: 'settlement',
  title: 'Settlement & Municipal Works',
  icon: '🏘️',
  size: 'wide',
  mount(body: HTMLElement) {
    const settlementsState = state.settlements;
    const capital: Settlement = settlementsState?.settlements?.[0] ?? {
      id: 'settlement_capital',
      name: 'The Hearth',
      kind: 'CAMP',
      q: 0,
      r: 0,
      population: 4,
      growthPool: 0,
      focus: 'GROWING',
      isCapital: true,
      buildings: [{ id: 'bld_hearth', name: 'Camp Hearth', age: 1, yields: { food: 2, production: 2 } }],
      districts: [],
      workedHexes: ['0,0'],
      overbuilt: [],
      foundedCampaignDay: 1,
      guardCount: 0,
      clothedPairs: 0,
      toolsCount: 4,
      toolsWear: 0,
    };

    const yields = settlementsState?.globalYields ?? {
      food: 2,
      production: 2,
      trade: 1,
      discovery: 1,
      renown: 1,
      morale: 5,
      influence: 1,
    };

    body.innerHTML = `
      <div class="settlement-window-container" style="display: flex; flex-direction: column; gap: 1rem; padding: 0.5rem;">
        <header style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">
          <div>
            <h2 style="margin: 0; font-family: var(--font-heading, serif);">${capital.name} (${capital.kind})</h2>
            <p style="margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--muted);">Coordinates: Hex (${capital.q}, ${capital.r}) · Founded Day ${capital.foundedCampaignDay}</p>
          </div>
          <div style="font-size: 0.9rem; font-weight: bold; color: #5aa5ff;">
            Pop: ${capital.population} · Towns: ${settlementsState?.settlements?.length ?? 1} / ${settlementsState?.settlementLimit ?? 3}
          </div>
        </header>

        <!-- 7-Yield Bar Overview -->
        <section class="settlement-yields-strip" style="display: flex; gap: 0.8rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 0.6rem; overflow-x: auto;">
          <div>🌾 Food: <strong>+${yields.food}</strong></div>
          <div>⚒️ Prod: <strong>+${yields.production}</strong></div>
          <div>🪙 Trade: <strong>+${yields.trade}</strong></div>
          <div>🔬 Science: <strong>+${yields.discovery}</strong></div>
          <div>🎭 Culture: <strong>+${yields.renown}</strong></div>
          <div>😊 Morale: <strong>${yields.morale >= 0 ? '+' : ''}${yields.morale}</strong></div>
          <div>⚖️ Influence: <strong>+${yields.influence}</strong></div>
        </section>

        <!-- Focus & Municipal Operations -->
        <section style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 0.75rem;">
            <h3 style="margin: 0 0 0.5rem; font-size: 0.95rem;">Town Focus</h3>
            <p style="font-size: 0.8rem; color: var(--muted); margin-bottom: 0.5rem;">Locks settlement specialized production for the age.</p>
            <select id="select-town-focus" style="width: 100%; padding: 0.4rem; background: #1a1e28; color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px;">
              <option value="GROWING" ${capital.focus === 'GROWING' ? 'selected' : ''}>Growing (+2 Food)</option>
              <option value="FARMING" ${capital.focus === 'FARMING' ? 'selected' : ''}>Farming (+3 Food)</option>
              <option value="MINING" ${capital.focus === 'MINING' ? 'selected' : ''}>Mining (+3 Production)</option>
              <option value="TRADE_OUTPOST" ${capital.focus === 'TRADE_OUTPOST' ? 'selected' : ''}>Trade Outpost (+3 Trade)</option>
              <option value="FORT" ${capital.focus === 'FORT' ? 'selected' : ''}>Border Fort (+2 Influence)</option>
            </select>
          </div>

          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 0.75rem;">
            <h3 style="margin: 0 0 0.5rem; font-size: 0.95rem;">Garrison & Clotheshorse</h3>
            <div style="font-size: 0.85rem; margin-bottom: 0.4rem;">
              Guards Assigned: <strong>${capital.guardCount} / 5</strong> (+2 Safety each)
            </div>
            <div style="font-size: 0.85rem; margin-bottom: 0.6rem;">
              Clothed Pairs: <strong>${capital.clothedPairs}</strong> (+1 Morale, -10% crisis severity)
            </div>
            <div style="display: flex; gap: 0.4rem;">
              <button id="btn-assign-guard" class="btn-dock" type="button" style="padding: 0.35rem 0.6rem; font-size: 0.78rem;">Arm Guard</button>
              <button id="btn-supply-tunic" class="btn-dock" type="button" style="padding: 0.35rem 0.6rem; font-size: 0.78rem;">Deliver Tunic</button>
            </div>
          </div>
        </section>

        <!-- Buildings & Districts List -->
        <section style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 0.75rem;">
          <h3 style="margin: 0 0 0.5rem; font-size: 0.95rem;">Municipal Buildings & Quarters</h3>
          <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.85rem;">
            ${capital.buildings
              .map(
                (b) => `
              <li>
                <strong>${b.name}</strong> (Age ${b.age})
                ${b.overbuilt ? '<span style="color: #e5b567; font-size: 0.75rem;">[Overbuilt 50%]</span>' : ''}
              </li>
            `,
              )
              .join('')}
          </ul>
        </section>
      </div>
    `;

    body.querySelector('#select-town-focus')?.addEventListener('change', (e) => {
      const focus = (e.target as HTMLSelectElement).value as TownFocus;
      send({ type: 'SET_TOWN_FOCUS', settlementId: capital.id, focus });
    });

    body.querySelector('#btn-assign-guard')?.addEventListener('click', () => {
      send({ type: 'DISTRIBUTE_WEAPONS', weaponsCount: 1 });
    });

    body.querySelector('#btn-supply-tunic')?.addEventListener('click', () => {
      send({ type: 'DISTRIBUTE_CLOTHES', tunics: 1 });
    });
  },
};
