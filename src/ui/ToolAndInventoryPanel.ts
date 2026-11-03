import { ITEM_BY_ID } from '../data/items';
import { itemIcon } from './icons';
import type { TreatmentAction } from './panelModels';

export interface ToolAndInventoryState {
  backpackUnlocked: boolean;
  bareHands: Array<{ itemId?: string; label: string; count: number } | null>;
  backpack: Array<{ itemId?: string; label: string; count: number } | null>;
  campCache?: Array<{ itemId?: string; label: string; count: number } | null>;
  tools: Record<string, { name: string; slot: string; mohs: number } | null>;
}

export function renderToolAndInventoryPanel(
  container: HTMLElement,
  state: ToolAndInventoryState,
  callbacks: {
    onCraftBackpack: () => void;
    onEatFood?: (itemId: string) => void;
    onEquipTool?: (itemId: string, slot: string) => void;
    onAdministerTreatment?: (itemId: string) => void;
    treatments?: TreatmentAction[];
    isDead?: boolean;
  },
): void {
  const toolSlots = [
    { key: 'CUTTING_SKINNING', label: '1. Cutting / Skinning' },
    { key: 'CHOPPING_CARVING', label: '2. Chopping / Carving' },
    { key: 'PERCUSSION_MINING', label: '3. Mining / Hammer' },
    { key: 'THERMAL_HANDLING', label: '4. Thermal Tongs' },
    { key: 'STITCHING_MEDICAL', label: '5. Stitching Awl' },
    { key: 'EATING_UTENSIL', label: '6. Eating Utensil' },
  ];

  const renderSlotItem = (
    item: { itemId?: string; label: string; count: number } | null,
    idxLabel: string,
  ) => {
    if (!item) {
      return `
        <div class="inv-slot empty">
          <span class="slot-idx">${idxLabel}</span>
          <span class="slot-content">Empty</span>
        </div>
      `;
    }

    const itemDef = item.itemId ? ITEM_BY_ID[item.itemId] : undefined;
    const iconSvg = item.itemId ? itemIcon(item.itemId, 18) : '';
    const descTitle = itemDef ? `title="${itemDef.desc}"` : '';
    const isFood = itemDef?.category === 'food' || itemDef?.foodKcal !== undefined;
    const isTool = itemDef?.category === 'tool' && itemDef.toolSlot;
    const canEquip = isTool && itemDef?.toolSlot && !state.tools[itemDef.toolSlot];

    let actionBtn = '';
    if (isFood) {
      actionBtn = `<button class="btn-slot-action btn-eat" data-item-id="${item.itemId}" ${callbacks.isDead ? 'disabled' : ''}>Eat</button>`;
    } else if (canEquip && itemDef?.toolSlot) {
      actionBtn = `<button class="btn-slot-action btn-equip" data-item-id="${item.itemId}" data-slot="${itemDef.toolSlot}">Equip</button>`;
    }

    return `
      <div class="inv-slot filled" ${descTitle}>
        <span class="slot-idx">${idxLabel}</span>
        <div class="slot-item-view">
          ${iconSvg}
          <span class="slot-content">${item.label} (x${item.count})</span>
          ${actionBtn}
        </div>
      </div>
    `;
  };

  const campSlots = state.campCache ?? new Array(6).fill(null);

  const treatmentsHtml =
    callbacks.treatments && callbacks.treatments.length > 0
      ? `
      <div class="panel-section treatments-section">
        <div class="panel-header">
          <h2>Active Treatments</h2>
          <span class="badge badge-med">Administer</span>
        </div>
        <div class="treatments-list">
          ${callbacks.treatments
            .map(
              t => `
            <div class="treatment-card">
              <div class="treatment-info">
                <strong>${t.name}</strong>
                <p class="treatment-desc">${t.effects}</p>
              </div>
              <button class="btn-administer" data-treatment-id="${t.id}">Administer</button>
            </div>
          `,
            )
            .join('')}
        </div>
      </div>
    `
      : '';

  container.innerHTML = `
    <div class="tool-inv-inner">
      ${treatmentsHtml}

      <div class="panel-section">
        <div class="panel-header">
          <h2>Dedicated Tool Menu</h2>
          <span class="badge">6 Slots</span>
        </div>
        <div class="tool-grid">
          ${toolSlots
            .map(ts => {
              const equipped = state.tools[ts.key];
              return `
              <div class="tool-slot-card ${equipped ? 'equipped' : 'empty'}" aria-pressed="${!!equipped}">
                <span class="slot-title">${ts.label}</span>
                <strong class="item-name">${equipped ? equipped.name : '— Empty —'}</strong>
                ${equipped ? `<small class="mohs-badge">Mohs ${equipped.mohs}</small>` : ''}
              </div>
            `;
            })
            .join('')}
        </div>
      </div>

      <div class="panel-section inventory-section">
        <div class="panel-header">
          <h2>Containers &amp; Storage</h2>
        </div>

        <div class="container-block">
          <div class="container-title">
            <strong>Bare Hands</strong> <span class="capacity-tag">2 Slots (Max 12 kg)</span>
          </div>
          <div class="slot-row">
            ${state.bareHands.slice(0, 2).map((item, idx) => renderSlotItem(item, `H${idx + 1}`)).join('')}
          </div>
        </div>

        <div class="container-block backpack-block ${state.backpackUnlocked ? 'unlocked' : 'locked'}">
          <div class="container-title">
            <strong>Leather Backpack</strong>
            <span class="capacity-tag">${state.backpackUnlocked ? '24 Slots (40 kg payload)' : '🔒 Locked (Requires Tanning)'}</span>
          </div>
          ${
            !state.backpackUnlocked
              ? `
            <div class="lock-banner">
              <p>Locked! Requires dehairing hide in lye (pH 11.2) + vegetable tannin tanning + sinew stitching.</p>
              <button id="btn-quick-stitch" class="btn-craft-pack">Craft &amp; Stitch Leather Backpack</button>
            </div>
          `
              : `
            <div class="backpack-grid">
              ${state.backpack.map((item, idx) => renderSlotItem(item, `${idx + 1}`)).join('')}
            </div>
          `
          }
        </div>

        <div class="container-block camp-cache-block">
          <div class="container-title">
            <strong>Camp Ground Cache</strong> <span class="capacity-tag">6 Slots (Max 150 kg)</span>
          </div>
          <div class="cache-grid">
            ${campSlots.map((item, idx) => renderSlotItem(item, `C${idx + 1}`)).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind actions
  const btnCraft = container.querySelector<HTMLButtonElement>('#btn-quick-stitch');
  if (btnCraft) {
    btnCraft.addEventListener('click', () => {
      callbacks.onCraftBackpack();
    });
  }

  container.querySelectorAll<HTMLButtonElement>('.btn-eat').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.itemId;
      if (id && callbacks.onEatFood) callbacks.onEatFood(id);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('.btn-equip').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.itemId;
      const slot = btn.dataset.slot;
      if (id && slot && callbacks.onEquipTool) callbacks.onEquipTool(id, slot);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('.btn-administer').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.treatmentId;
      if (id && callbacks.onAdministerTreatment) callbacks.onAdministerTreatment(id);
    });
  });
}
