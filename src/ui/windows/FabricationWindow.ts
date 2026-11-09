/**
 * Fabrication Bench & Pack window — searchable master/detail recipe browser and inventory pack.
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
import { itemIcon, ICONS } from '../icons';
import { ITEM_BY_ID } from '../../data/items';

const TOOL_SLOT_ICONS: Record<string, string> = {
  CUTTING_SKINNING: 'blade',
  CHOPPING_CARVING: 'adze',
  PERCUSSION_MINING: 'hammerstone',
  THERMAL_HANDLING: 'tuyere',
  STITCHING_MEDICAL: 'awl',
  EATING_UTENSIL: 'fork',
};

const TOOL_SLOT_LABELS: Record<string, string> = {
  CUTTING_SKINNING: 'Cutting / Skinning',
  CHOPPING_CARVING: 'Chopping / Carving',
  PERCUSSION_MINING: 'Percussion Mining',
  THERMAL_HANDLING: 'Thermal Handling',
  STITCHING_MEDICAL: 'Stitching / Awl',
  EATING_UTENSIL: 'Eating Utensil',
};

export const spec: WindowSpec = {
  id: 'fabrication',
  title: 'Fabrication Bench & Pack',
  icon: '🔨',
  size: 'full',
  mount(body: HTMLElement) {
    body.innerHTML = `
      <div class="fab-pack-container" style="display: flex; flex-direction: column; gap: 1rem; height: 100%;">
        <!-- Pack / Inventory Summary Strip -->
        <section class="pack-inventory-strip" style="background: rgba(18, 21, 28, 0.7); border: 1px solid rgba(197, 160, 89, 0.25); border-radius: 8px; padding: 0.6rem 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <strong style="color: #f1dbb1; font-size: 0.9rem;">🎒 Traveling Pack &amp; Tools</strong>
            <span style="font-size: 0.8rem; color: #8c9ba5;">Glucose: <strong>${state.player.glucoseKcal ?? 1200} kcal</strong></span>
          </div>
          <div class="pack-items-grid" id="pack-items-display" style="display: flex; flex-wrap: wrap; gap: 0.5rem; max-height: 80px; overflow-y: auto;">
            <!-- Dynamically populated -->
          </div>
        </section>

        <!-- Fabrication Workspace -->
        <div class="fab-layout" style="flex: 1; min-height: 0;">
          <div class="fab-list-pane">
            <input class="fab-search" type="search" placeholder="Search recipes or materials…" aria-label="Search recipes" />
            <div class="fab-tier-filter" role="group" aria-label="Feasibility filter">
              <button class="fab-tier-chip active" data-filter="all">All recipes</button>
              <button class="fab-tier-chip" data-filter="craftable">Craftable now</button>
              <button class="fab-tier-chip" data-filter="daybook">The Day Book (In Flight)</button>
            </div>
            <div class="fab-list" role="listbox" aria-label="Recipes"></div>
          </div>
          <div class="fab-detail" aria-live="polite"></div>
        </div>
      </div>
    `;

    // Render pack items from inventory aggregates
    const packDisplay = body.querySelector<HTMLElement>('#pack-items-display');
    const counts = aggregateInventory(state.inventory);
    if (packDisplay) {
      if (counts.size === 0) {
        packDisplay.innerHTML = '<span style="font-size: 0.8rem; color: #8c9ba5;">Pack is empty.</span>';
      } else {
        const rendered: string[] = [];
        counts.forEach((qty, itemId) => {
          const itemDef = ITEM_BY_ID[itemId];
          const iconKey = itemDef?.icon && ICONS[itemDef.icon] ? itemDef.icon : (ICONS[itemId.toLowerCase()] ? itemId.toLowerCase() : 'unknown');
          const categoryClass = itemDef?.category ? `category-${itemDef.category}` : 'category-misc';
          const iconHtml = itemIcon(iconKey, 16);
          rendered.push(`
            <span class="pack-item-chip ${categoryClass}" title="${itemDef?.name ?? itemId}: ${itemDef?.desc ?? ''}">
              <span class="prop-thumb" aria-hidden="true">${iconHtml}</span>
              <span class="item-name">${itemId}</span>
              <strong class="item-qty">×${qty}</strong>
            </span>
          `);
        });
        packDisplay.innerHTML = rendered.slice(0, 16).join('');
      }
    }

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

    const assess = (recipeId: string) => {
      const recipe = FABRICATION_RECIPES.find((r) => r.id === recipeId)!;
      return assessRecipe(recipe, counts, state.inventory.tools, state.player.glucoseKcal ?? 0, apprenticeMult);
    };

    const visibleRecipes = () => {
      const q = search.value.trim().toLowerCase();
      if (filter === 'daybook') {
        const queuedIds = (state.experiments?.experiments ?? []).map((e) => e.recipeId);
        return FABRICATION_RECIPES.filter((r) => queuedIds.includes(r.id));
      }
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
          const toolSlotKey = recipe.requiredToolSlot;
          const toolIconKey = toolSlotKey ? TOOL_SLOT_ICONS[toolSlotKey] ?? 'unknown' : null;
          const toolBadgeHtml = toolIconKey
            ? `<span class="recipe-tool-badge" title="Requires ${TOOL_SLOT_LABELS[toolSlotKey!] ?? toolSlotKey}" aria-hidden="true">${itemIcon(toolIconKey, 14)}</span>`
            : '';
          const benchBadgeHtml = recipe.inputs.some((i) => i.itemId === 'WOODEN_BUCKET' || i.itemId === 'WOODEN_TROUGH' || i.itemId === 'FIRED_CERAMIC_VESSEL')
            ? `<span class="recipe-station-badge" title="Station Apparatus Required" aria-hidden="true">${itemIcon('pot', 14)}</span>`
            : '';

          return `
            <button class="fab-item${recipe.id === selectedId ? ' selected' : ''}" role="option"
              aria-selected="${recipe.id === selectedId}"
              data-recipe="${recipe.id}" title="${recipe.description}">
              <div class="fab-item-header">
                <span class="fab-item-name"><span class="fab-dot ${dot}" aria-hidden="true"></span>${fabricated ? '✓ ' : ''}${recipe.name}</span>
                <span class="fab-item-badges">${toolBadgeHtml}${benchBadgeHtml}</span>
              </div>
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

      const primaryOutput = recipe.outputs[0]?.itemId;
      const primaryItemDef = primaryOutput ? ITEM_BY_ID[primaryOutput] : undefined;
      const primaryIconKey = primaryItemDef?.icon && ICONS[primaryItemDef.icon]
        ? primaryItemDef.icon
        : (primaryOutput && ICONS[primaryOutput.toLowerCase()] ? primaryOutput.toLowerCase() : 'unknown');

      const toolSlot = recipe.requiredToolSlot;
      const toolReqText = toolSlot ? `Requires: ${TOOL_SLOT_LABELS[toolSlot] ?? toolSlot}` : 'Hand work (no dedicated tool slot)';
      const benchReqText = a.vesselInputsNeeded.length ? `Bench vessel: ${a.vesselInputsNeeded.join(', ')}` : 'Camp workbench surface';

      const previewDressing = `
        <div class="fab-detail-preview-card" aria-hidden="true">
          <div class="preview-hero-stage">
            <div class="preview-vessel-halo"></div>
            <div class="preview-hero-icon">${itemIcon(primaryIconKey, 48)}</div>
          </div>
          <div class="preview-hero-info">
            <span class="preview-hero-title">${primaryItemDef?.name ?? recipe.outputs[0]?.label ?? recipe.name}</span>
            <div class="preview-hero-badges">
              <span class="preview-badge ${a.feasible ? 'ready' : 'blocked'}">${a.feasible ? '⚡ Ready' : '⏳ Constrained'}</span>
              <span class="preview-badge slot-badge">${toolReqText}</span>
              <span class="preview-badge bench-badge">${benchReqText}</span>
            </div>
          </div>
        </div>
      `;

      detail.innerHTML = `
        ${previewDressing}
        <h3>${recipe.name} ${fabricated ? '<span class="fab-ok">✓</span>' : ''}</h3>
        <p class="sub">${recipe.description}</p>
        <h4>Requires</h4>
        ${inputs}
        <h4>Yields</h4>
        <div class="mats-out">${outputs}</div>
        <dl class="dossier-kv">
          <dt>Energy</dt><dd>≈ ${a.energyCostKcal.toFixed(0)} kcal${apprenticeMult > 1 ? ` (apprentice ×${apprenticeMult.toFixed(2)})` : ''}</dd>
          <dt>Time</dt><dd>≈ ${recipe.workTicks} h of work</dd>
          ${recipe.requiredToolSlot ? `<dt>Tool</dt><dd>Slot ${recipe.requiredToolSlot} (${TOOL_SLOT_LABELS[recipe.requiredToolSlot] ?? recipe.requiredToolSlot})</dd>` : ''}
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
