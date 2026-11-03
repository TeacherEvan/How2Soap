/**
 * Workbench Canvas Component
 *
 * Implements Section 2.2 Center Panel:
 * - Tabbed workspace:
 *   1. Reaction Workbench (thermal heaters, condenser routing, electrolysis wiring, decant & skim)
 *   2. Mechanical Fabrication Bench (knapping, carving, dehairing, tanning, stitching)
 *   3. Domestication Paddocks & Agriculture (feeding animals, collecting milk/butterfat, manure)
 */

import { FABRICATION_RECIPES } from '../engine/fabrication';

export type WorkbenchTab = 'REACTIONS' | 'FABRICATION' | 'PADDOCKS' | 'JOURNAL';

export interface WorkbenchProps {
  currentTab: WorkbenchTab;
  onSelectTab: (tab: WorkbenchTab) => void;
  onExecuteRecipe: (recipeId: string) => void;
  onFeedPaddock: () => void;
  onWaterPaddock: () => void;
}

export function renderWorkbenchTabs(
  container: HTMLElement,
  props: WorkbenchProps,
): void {
  const tabs = [
    { key: 'REACTIONS' as WorkbenchTab, label: '🔬 Chemical Workbench' },
    { key: 'FABRICATION' as WorkbenchTab, label: '🔨 Fabrication Bench' },
    { key: 'PADDOCKS' as WorkbenchTab, label: '🌾 Animal Paddocks' },
    { key: 'JOURNAL' as WorkbenchTab, label: '📖 Journal & Missions' },
  ];

  container.innerHTML = `
    <div class="workbench-tabs-nav">
      ${tabs.map((tab) => `
        <button class="tab-btn ${props.currentTab === tab.key ? 'active' : ''}" data-tab="${tab.key}">
          ${tab.label}
        </button>
      `).join('')}
    </div>
  `;

  container.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab as WorkbenchTab;
      props.onSelectTab(tab);
    });
  });
}

export function renderFabricationTab(
  container: HTMLElement,
  onExecuteRecipe: (recipeId: string) => void,
): void {
  container.innerHTML = `
    <div class="fabrication-view">
      <div class="view-header">
        <h3>Mechanical Tool-Shaping &amp; Leathercrafting</h3>
        <p class="sub">Craft primitive stone implements, dugout troughs, and tan leather.</p>
      </div>

      <div class="recipes-grid">
        ${FABRICATION_RECIPES.map((recipe) => `
          <div class="recipe-card">
            <div class="recipe-header">
              <strong>${recipe.name}</strong>
              <span class="recipe-cost">${recipe.energyCostKcal} kcal · ${recipe.workTicks} h</span>
            </div>
            <p class="recipe-desc">${recipe.description}</p>
            <div class="recipe-mats">
              <div class="mats-in">
                <span class="mats-label">Requires:</span>
                ${recipe.inputs.map((i) => `<span class="mat-badge">${i.label} (x${i.count})</span>`).join(' ')}
              </div>
              <div class="mats-out">
                <span class="mats-label">Yields:</span>
                ${recipe.outputs.map((o) => `<span class="mat-badge yield">${o.label} (x${o.count})</span>`).join(' ')}
              </div>
            </div>
            <button class="btn-execute-recipe" data-recipe-id="${recipe.id}">Fabricate</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll<HTMLButtonElement>('.btn-execute-recipe').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.recipeId;
      if (id) onExecuteRecipe(id);
    });
  });
}

export function renderPaddockTab(
  container: HTMLElement,
  paddockState: {
    animalsCount: number;
    feedKg: number;
    waterL: number;
    manureKg: number;
  },
  onFeed: () => void,
  onWater: () => void,
): void {
  container.innerHTML = `
    <div class="paddock-view">
      <div class="view-header">
        <h3>Split-Rail Domestication Paddock</h3>
        <p class="sub">Care for captured livestock to sustainably yield milk, butterfat for soap, and fertilizer.</p>
      </div>

      <div class="paddock-stats-card">
        <div class="p-stat"><span>Livestock</span><strong>${paddockState.animalsCount} animals</strong></div>
        <div class="p-stat"><span>Stored Fodder</span><strong>${paddockState.feedKg.toFixed(1)} kg</strong></div>
        <div class="p-stat"><span>Fresh Water</span><strong>${paddockState.waterL.toFixed(1)} L</strong></div>
        <div class="p-stat"><span>Niter / Manure</span><strong>${paddockState.manureKg.toFixed(2)} kg</strong></div>
      </div>

      <div class="paddock-actions">
        <button id="btn-add-feed" class="ghost">+ Add 5 kg Fodder</button>
        <button id="btn-add-water" class="ghost">+ Refill 10 L Water Trough</button>
      </div>

      <div class="paddock-roster">
        <h4>Stocked Animals</h4>
        <div class="animal-row">
          <span>Capra hircus (Farmed Dairy Goat)</span>
          <span class="yield-tag">1.2 L milk / 54 g butterfat per day</span>
        </div>
        <div class="animal-row">
          <span>Gallus gallus (Red Jungle Fowl)</span>
          <span class="yield-tag">1 Egg / 40 g Guano per day</span>
        </div>
      </div>
    </div>
  `;

  container.querySelector<HTMLButtonElement>('#btn-add-feed')?.addEventListener('click', onFeed);
  container.querySelector<HTMLButtonElement>('#btn-add-water')?.addEventListener('click', onWater);
}
