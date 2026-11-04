/**
 * Biome Explorer window — searchable DAG + species dossier.
 * The left panel stays as a quick glance; this is the working view.
 */
import {
  BIOME_DAG,
  calculateHarvestTotalCostKcal,
  type HarvestablePart,
  type BiomeSpeciesNode,
  type BiomeCategoryKey,
} from '../../data/biomeNodes';
import { state, send } from '../../app/state';
import type { WindowSpec } from '../WindowManager';

const CATEGORY_FILTERS: Array<{ key: BiomeCategoryKey | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'TREES', label: '🌳 Trees' },
  { key: 'ROCKS_MINERALS', label: '⛏️ Minerals' },
  { key: 'MUSHROOMS_FLORA', label: '🌿 Flora' },
  { key: 'ANIMALS', label: '🐾 Fauna' },
];

export const spec: WindowSpec = {
  id: 'biome',
  title: 'Biome Explorer',
  icon: '🧭',
  size: 'full',
  mount(body: HTMLElement) {
    body.innerHTML = `
      <div class="biome-win-layout">
        <div class="biome-win-left">
          <input class="fab-search" type="search" placeholder="Search species or parts…" aria-label="Search species" />
          <div class="biome-chips" role="group" aria-label="Filter by class">
            ${CATEGORY_FILTERS.map((f) => `<button class="fab-tier-chip${f.key === 'ALL' ? ' active' : ''}" data-filter="${f.key}">${f.label}</button>`).join('')}
          </div>
          <div class="biome-tree-list biome-win-list"></div>
        </div>
        <div class="biome-dossier" aria-live="polite"></div>
      </div>
    `;

    const search = body.querySelector<HTMLInputElement>('.fab-search')!;
    const chips = body.querySelectorAll<HTMLButtonElement>('.fab-tier-chip');
    const list = body.querySelector<HTMLElement>('.biome-win-list')!;
    const dossier = body.querySelector<HTMLElement>('.biome-dossier')!;

    let filter: BiomeCategoryKey | 'ALL' = 'ALL';
    let selected: { part: HarvestablePart; species: BiomeSpeciesNode; categoryIcon: string } | null = null;

    const haulCost = (part: HarvestablePart, distance: number): number => {
      const toolSlot = part.requiredToolSlot as keyof typeof state.inventory.tools;
      const equipped = state.inventory.tools[toolSlot] ?? null;
      const mohs = equipped?.mohs ?? 1.0;
      const ma = equipped ? 2.0 : 1.0;
      return calculateHarvestTotalCostKcal(part.baseWorkJoules, mohs, part.targetMohs, ma, distance, 0);
    };

    const renderList = (): void => {
      const q = search.value.trim().toLowerCase();
      const rows: string[] = [];
      for (const cat of BIOME_DAG) {
        if (filter !== 'ALL' && cat.key !== filter) continue;
        for (const sp of cat.species) {
          const matchSelf = !q || sp.name.toLowerCase().includes(q);
          const matchingParts = sp.parts.filter((p) => !q || p.name.toLowerCase().includes(q) || matchSelf);
          if (matchingParts.length === 0) continue;
          rows.push(`
            <div class="species-item">
              <div class="species-name">${cat.icon} ${sp.name} <small class="text-muted">· ${sp.baseDistanceMeters}m</small></div>
              <div class="parts-list">
                ${matchingParts.map((p) => `
                  <button class="part-row part-select" data-part="${p.id}" data-species="${sp.id}" data-cat="${cat.key}">
                    <span class="part-name">${p.name}</span>
                    <span class="haul-cost">≈ ${Math.round(haulCost(p, sp.baseDistanceMeters))} kcal</span>
                  </button>
                `).join('')}
              </div>
            </div>
          `);
        }
      }
      list.innerHTML = rows.join('') || '<p class="hint">Nothing matches that search.</p>';

      list.querySelectorAll<HTMLButtonElement>('.part-select').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cat = BIOME_DAG.find((c) => c.key === (btn.dataset.cat as BiomeCategoryKey))!;
          for (const sp of cat.species) {
            const found = sp.parts.find((p) => p.id === btn.dataset.part);
            if (found) {
              selected = { part: found, species: sp, categoryIcon: cat.icon };
              renderDossier();
              return;
            }
          }
        });
      });
    };

    const renderDossier = (): void => {
      if (!selected) {
        dossier.innerHTML = `
          <h3>Species Dossier</h3>
          <p class="hint">Select a harvestable part on the left — you will get the full picture: yield items, work cost, tool fit and the haul.</p>`;
        return;
      }
      const { part, species, categoryIcon } = selected;
      const toolSlot = part.requiredToolSlot as keyof typeof state.inventory.tools;
      const equipped = state.inventory.tools[toolSlot] ?? null;
      const mohs = equipped?.mohs ?? 1.0;
      const kcal = haulCost(part, species.baseDistanceMeters);
      const yields = part.yields.map((y) => {
        const bits = [y.name];
        if (y.molesYield) bits.push(`${y.molesYield} mol`);
        if (y.massKg) bits.push(`${(y.massKg * 1000).toFixed(0)} g`);
        if (y.chemicalFormula) bits.push(y.chemicalFormula);
        return `<li>${bits.join(' · ')}</li>`;
      }).join('');

      dossier.innerHTML = `
        <h3>${categoryIcon} ${species.name}</h3>
        ${species.scientificName ? `<p class="text-muted"><em>${species.scientificName}</em></p>` : ''}
        <dl class="dossier-kv">
          <dt>Class</dt><dd>${species.subtype}</dd>
          <dt>Distance</dt><dd>${species.baseDistanceMeters} m radial</dd>
          <dt>Work</dt><dd>${part.baseWorkJoules.toFixed(0)} J → ≈ ${Math.round(kcal)} kcal</dd>
          <dt>Tool</dt><dd>Slot <code>${toolSlot}</code> · needs Mohs ≥ ${part.minMohs} (you: ${mohs.toFixed(1)})</dd>
          ${part.harvestTimeTicks ? `<dt>Time</dt><dd>≈ ${part.harvestTimeTicks} h</dd>` : ''}
        </dl>
        <p>${part.description}</p>
        <div class="mats-out"><span class="mats-label">Yields:</span><ul class="yields-list">${yields}</ul></div>
        <button class="btn-harvest dossier-harvest" type="button" data-part="${part.id}">Harvest ${part.name}</button>
      `;

      dossier.querySelector<HTMLButtonElement>('.dossier-harvest')!.addEventListener('click', () => {
        send({
          type: 'HARVEST_PART',
          partId: part.id,
          speciesId: species.id,
          carriedMassKg: 0,
          toolSlot: part.requiredToolSlot ?? 'PERCUSSION_MINING',
          distanceMeters: species.baseDistanceMeters,
        });
      });
    };

    search.addEventListener('input', renderList);
    chips.forEach((chip) =>
      chip.addEventListener('click', () => {
        filter = chip.dataset.filter as BiomeCategoryKey | 'ALL';
        chips.forEach((c) => c.classList.toggle('active', c === chip));
        renderList();
      }),
    );

    // First paint: preselect the first part of the first species.
    renderList();
    const first = BIOME_DAG[0]?.species[0];
    if (first?.parts[0]) {
      selected = { part: first.parts[0], species: first, categoryIcon: BIOME_DAG[0].icon };
    }
    renderDossier();
  },
};
