/**
 * Biome Tree Panel Component
 *
 * Left panel (width: 340px) displaying the 3-level collapsible DAG:
 * Category -> Species -> Harvestable Part, with tool scaling and kcal costs.
 */

import { BIOME_DAG, type HarvestablePart, type BiomeSpeciesNode } from '../data/biomeNodes';

export function renderBiomeTreePanel(
  container: HTMLElement,
  onHarvest: (part: HarvestablePart, species: BiomeSpeciesNode) => void,
  getHaulKcal?: (part: HarvestablePart, speciesDistanceMeters: number) => number,
): void {
  container.innerHTML = `
    <div class="biome-panel-inner">
      <div class="panel-header">
        <h2>Biome Explorer</h2>
        <span class="badge">Radial Foraging</span>
      </div>
      <p class="panel-hint">Explore native flora, mineral deposits & fauna. Work cost accounts for tool hardness advantage.</p>
      <div class="biome-tree-list">
        ${BIOME_DAG.map((category) => `
          <div class="category-block" data-category="${category.key}">
            <div class="category-title">
              <span>${category.icon}</span> <strong>${category.title}</strong>
            </div>
            <div class="species-list">
              ${category.species.map((sp) => `
                <div class="species-item">
                  <div class="species-name">${sp.name} <small class="text-muted">(${sp.baseDistanceMeters}m)</small></div>
                  <div class="parts-list">
                    ${sp.parts.map((p) => {
                      const estKcal = getHaulKcal ? getHaulKcal(p, sp.baseDistanceMeters) : null;
                      const costDisplay = estKcal !== null ? `<span class="haul-cost" title="Estimated kcal with your equipped tool">≈ ${Math.round(estKcal)} kcal</span>` : '';
                      return `
                      <div class="part-row">
                        <div class="part-info">
                          <span class="part-name">${p.name}</span>
                          <span class="part-desc">${p.description}</span>
                          ${costDisplay}
                        </div>
                        <button class="btn-harvest" data-part-id="${p.id}">Harvest</button>
                      </div>
                    `;}).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Bind harvest clicks
  container.querySelectorAll<HTMLButtonElement>('.btn-harvest').forEach((btn) => {
    btn.addEventListener('click', () => {
      const partId = btn.dataset.partId;
      for (const cat of BIOME_DAG) {
        for (const sp of cat.species) {
          const found = sp.parts.find((p) => p.id === partId);
          if (found) {
            onHarvest(found, sp);
            return;
          }
        }
      }
    });
  });
}
