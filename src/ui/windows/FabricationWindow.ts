/**
 * Fabrication Bench window — searchable master/detail recipe browser.
 * Client-side feasibility is a projection; the worker remains the authority.
 */
import { FABRICATION_RECIPES } from '../../engine/fabrication';
import { getApprenticeChemistMultiplier, type ColonyState } from '../../engine/colony';
import { state, send } from '../../app/state';
import {
  aggregateInventory,
  assessRecipe,
  hasFabricated,
} from '../fabricationModel';
import type { WindowSpec } from '../WindowManager';

export const spec: WindowSpec = {
  id: 'fabrication',
  title: 'Fabrication Bench',
  icon: '🔨',
  size: 'full',
  mount(body: HTMLElement) {
    body.innerHTML = `
      <div class="fab-layout">
        <div class="fab-list-pane">
          <input class="fab-search" type="search" placeholder="Search recipes or materials…" aria-label="Search recipes" />
          <div class="fab-tier-filter" role="group" aria-label="Feasibility filter">
            <button class="fab-tier-chip active" data-filter="all">All recipes</button>
            <button class="fab-tier-chip" data-filter="craftable">Craftable now</button>
          </div>
          <div class="fab-list" role="listbox" aria-label="Recipes"></div>
        </div>
        <div class="fab-detail" aria-live="polite"></div>
      </div>
    `;

    const search = body.querySelector<HTMLInputElement>('.fab-search')!;
    const chips = body.querySelectorAll<HTMLButtonElement>('.fab-tier-chip');
    const list = body.querySelector<HTMLElement>('.fab-list')!;
    const detail = body.querySelector<HTMLElement>('.fab-detail')!;

    let filter = 'all';
    let selectedId = FABRICATION_RECIPES[0]?.id ?? null;

    const apprenticeMult = (() => {
      try {
        return state.colony ? getApprenticeChemistMultiplier(state.colony as ColonyState) : 1;
      } catch {
        return 1;
      }
    })();

    const counts = aggregateInventory(state.inventory);
    const assess = (recipeId: string) => {
      const recipe = FABRICATION_RECIPES.find((r) => r.id === recipeId)!;
      return assessRecipe(recipe, counts, state.inventory.tools, state.player.glucoseKcal ?? 0, apprenticeMult);
    };

    const visibleRecipes = () => {
      const q = search.value.trim().toLowerCase();
      return FABRICATION_RECIPES.filter((recipe) => {
        if (filter === 'craftable' && !assess(recipe.id).feasible) return false;
        if (!q) return true;
        const hay = `${recipe.name} ${recipe.description} ${recipe.inputs.map((i) => i.label).join(' ')} ${recipe.outputs.map((o) => o.label).join(' ')}`.toLowerCase();
        return hay.includes(q);
      });
    };

    const renderList = (): void => {
      list.innerHTML = visibleRecipes()
        .map((recipe) => {
          const a = assess(recipe.id);
          const dot = a.feasible ? 'ok' : a.missing.length ? 'miss' : 'warn';
          const fabricated = hasFabricated(recipe.id, state.progression.fabricatedRecipes ?? []);
          return `
            <button class="fab-item${recipe.id === selectedId ? ' selected' : ''}" role="option"
              aria-selected="${recipe.id === selectedId}"
              data-recipe="${recipe.id}" title="${recipe.description}">
              <span class="fab-item-name"><span class="fab-dot ${dot}" aria-hidden="true"></span>${fabricated ? '✓ ' : ''}${recipe.name}</span>
              <span class="fab-item-cost">${recipe.energyCostKcal} kcal · ${recipe.workTicks} h · ${recipe.outputs.map((o) => o.label).join(', ')}</span>
            </button>`;
        })
        .join('') || '<p class="hint">Nothing craftable right now with those filters.</p>';

      list.querySelectorAll<HTMLButtonElement>('.fab-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedId = btn.dataset.recipe!;
          renderList();
          renderDetail();
        });
      });
    };

    const renderDetail = (): void => {
      const recipe = FABRICATION_RECIPES.find((r) => r.id === selectedId);
      if (!recipe) {
        detail.innerHTML = '<p class="hint">No recipe selected.</p>';
        return;
      }
      const a = assess(recipe.id);
      const fabricated = hasFabricated(recipe.id, state.progression.fabricatedRecipes ?? []);

      const inputs = recipe.inputs
        .map((i) => {
          const isVessel = a.vesselInputsNeeded.includes(i.itemId);
          const have = counts.get(i.itemId) ?? 0;
          const need = i.count;
          const cls = have >= need || isVessel ? 'have' : 'lack';
          return `<div class="fab-mat"><span>${i.label} ×${need}${isVessel ? ' <em>(bench)</em>' : ''}</span><span class="${cls}">${isVessel ? 'bench-side' : `have ${have}`}</span></div>`;
        })
        .join('');

      const outputs = recipe.outputs.map((o) => `<span class="mat-badge yield">${o.label} ×${o.count}</span>`).join(' ');
      const missingBlock = a.missing.length ? `<p class="fab-missing">Missing: ${a.missing.join(', ')}</p>` : '';
      const reasonsBlock = a.reasons.filter((r) => !r.startsWith('Missing:')).map((r) => `<p class="fab-missing">⚠ ${r}</p>`).join('');
      const statusBlock = a.feasible ? `<p class="fab-ok">✓ Ready to fabricate${fabricated ? ' (already fabricated before)' : ''}.</p>` : '';

      detail.innerHTML = `
        <h3>${recipe.name} ${fabricated ? '<span class="fab-ok">✓</span>' : ''}</h3>
        <p class="sub">${recipe.description}</p>
        <h4>Requires</h4>
        ${inputs}
        <h4>Yields</h4>
        <div class="mats-out">${outputs}</div>
        <dl class="dossier-kv">
          <dt>Energy</dt><dd>≈ ${a.energyCostKcal.toFixed(0)} kcal${apprenticeMult > 1 ? ` (apprentice ×${apprenticeMult.toFixed(2)})` : ''}</dd>
          <dt>Time</dt><dd>≈ ${recipe.workTicks} h of work</dd>
          ${recipe.requiredToolSlot ? `<dt>Tool</dt><dd>Slot ${recipe.requiredToolSlot}</dd>` : ''}
          ${a.vesselInputsNeeded.length ? `<dt>Bench</dt><dd>${a.vesselInputsNeeded.join(', ')} (worker-validated)</dd>` : ''}
        </dl>
        ${reasonsBlock}
        ${missingBlock}
        ${statusBlock}
        <button class="fab-execute" type="button" ${a.feasible ? '' : 'disabled'} data-autofocus="true">${a.feasible ? 'Fabricate' : 'Cannot fabricate yet'}</button>
      `;

      detail.querySelector<HTMLButtonElement>('.fab-execute')!.addEventListener('click', () => {
        send({ type: 'FABRICATE', recipeId: recipe.id });
      });
    };

    search.addEventListener('input', renderList);
    chips.forEach((chip) =>
      chip.addEventListener('click', () => {
        filter = chip.dataset.filter!;
        chips.forEach((c) => c.classList.toggle('active', c === chip));
        renderList();
      }),
    );

    renderList();
    renderDetail();
  },
};
