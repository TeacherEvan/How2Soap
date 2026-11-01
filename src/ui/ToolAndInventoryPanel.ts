/**
 * Tool and Inventory Panel Component
 *
 * Right panel (width: 360px):
 * - Top: 6 dedicated tool slots
 * - Bottom: Bare Hands (2 slots) and Backpack (24 slots, locked/unlocked)
 */

export interface ToolAndInventoryState {
  backpackUnlocked: boolean;
  bareHands: Array<{ label: string; count: number } | null>;
  backpack: Array<{ label: string; count: number } | null>;
  tools: Record<string, { name: string; slot: string; mohs: number } | null>;
}

export function renderToolAndInventoryPanel(
  container: HTMLElement,
  state: ToolAndInventoryState,
  onCraftBackpack: () => void,
): void {
  const toolSlots = [
    { key: 'CUTTING_SKINNING', label: '1. Cutting / Skinning' },
    { key: 'CHOPPING_CARVING', label: '2. Chopping / Carving' },
    { key: 'PERCUSSION_MINING', label: '3. Mining / Hammer' },
    { key: 'THERMAL_HANDLING', label: '4. Thermal Tongs' },
    { key: 'STITCHING_MEDICAL', label: '5. Stitching Awl' },
    { key: 'EATING_UTENSIL', label: '6. Eating Utensil' },
  ];

  container.innerHTML = `
    <div class="tool-inv-inner">
      <div class="panel-section">
        <div class="panel-header">
          <h2>Dedicated Tool Menu</h2>
          <span class="badge">6 Slots</span>
        </div>
        <div class="tool-grid">
          ${toolSlots.map((ts) => {
            const equipped = state.tools[ts.key];
            return `
              <div class="tool-slot-card ${equipped ? 'equipped' : 'empty'}">
                <span class="slot-title">${ts.label}</span>
                <strong class="item-name">${equipped ? equipped.name : '— Empty —'}</strong>
                ${equipped ? `<small class="mohs-badge">Mohs ${equipped.mohs}</small>` : ''}
              </div>
            `;
          }).join('')}
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
            ${state.bareHands.slice(0, 2).map((item, idx) => `
              <div class="inv-slot ${item ? 'filled' : ''}">
                <span class="slot-idx">H${idx + 1}</span>
                <span class="slot-content">${item ? `${item.label} (x${item.count})` : 'Empty'}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="container-block backpack-block ${state.backpackUnlocked ? 'unlocked' : 'locked'}">
          <div class="container-title">
            <strong>Leather Backpack</strong>
            <span class="capacity-tag">${state.backpackUnlocked ? '24 Slots (40 kg payload)' : '🔒 Locked (Requires Tanning)'}</span>
          </div>
          ${!state.backpackUnlocked ? `
            <div class="lock-banner">
              <p>Locked! Requires dehairing hide in lye (pH 11.2) + vegetable tannin tanning + sinew stitching.</p>
              <button id="btn-quick-stitch" class="btn-craft-pack">Craft &amp; Stitch Leather Backpack</button>
            </div>
          ` : `
            <div class="backpack-grid">
              ${state.backpack.map((item, idx) => `
                <div class="inv-slot mini ${item ? 'filled' : ''}">
                  <span class="slot-idx">${idx + 1}</span>
                  <span class="slot-content">${item ? `${item.label} (${item.count})` : ''}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  const btnCraft = container.querySelector<HTMLButtonElement>('#btn-quick-stitch');
  if (btnCraft) {
    btnCraft.addEventListener('click', () => {
      onCraftBackpack();
    });
  }
}
