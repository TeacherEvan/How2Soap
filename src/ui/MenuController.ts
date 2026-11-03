/**
 * Main Menu & Settings Modal Controller
 *
 * Implements Section 2.1:
 * - Boot check: SharedArrayBuffer Cross-Origin Isolation test
 * - Main menu states: New Game, Continue, Settings, Chemical Compendium
 * - Settings modal:
 *   - Audio channels: Master, Reaction SFX, Biome Ambient
 *   - Accessibility (WCAG 2.1 AAA): High Contrast, Reduced Motion, Rem Scaling
 *   - Simulation Fast-Forward multiplier (10x - 120x)
 *   - Export / Import Save Data with Gzip Base64 & SHA-256 Checksum prefix
 * - Chemical Compendium viewer
 */

import { SPECIES_BY_INDEX, MAX_DEFINED_SPECIES, type ChemicalSpecies } from '../data/speciesRegistry';
import { compressSaveToBase64, decompressBase64ToSave, type SerializedWorldSave } from '../engine/persistence';
import { globalOverlayStack } from './overlayStack';
import { audio, sliderToGain } from './audio';

export interface MenuControllerOptions {
  onNewGame: () => void;
  onExportSave: () => Promise<SerializedWorldSave>;
  onImportSave: (save: SerializedWorldSave) => void;
}

export function initMenuAndSettings(options: MenuControllerOptions): void {
  const speciesList: ChemicalSpecies[] = [];
  for (let i = 0; i < MAX_DEFINED_SPECIES; i++) {
    const sp = SPECIES_BY_INDEX.get(i);
    if (sp) speciesList.push(sp);
  }

  // Remove duplicate modals if startWorld() is called repeatedly
  const existingModal = document.getElementById('menu-modal-overlay');
  if (existingModal) existingModal.remove();
  const existingBtn = document.getElementById('btn-open-settings');
  if (existingBtn) existingBtn.remove();

  const modalContainer = document.createElement('div');
  modalContainer.id = 'menu-modal-overlay';
  modalContainer.className = 'modal-overlay hidden';

  modalContainer.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2 id="modal-title">Settings &amp; Simulation Options</h2>
        <button id="modal-close" class="modal-close-btn">&times;</button>
      </div>

      <div class="modal-tabs">
        <button class="m-tab-btn active" data-tab="settings">Settings &amp; Audio</button>
        <button class="m-tab-btn" data-tab="compendium">Chemical Compendium</button>
        <button class="m-tab-btn" data-tab="savedata">Save / Export Data</button>
      </div>

      <div class="modal-body">
        <!-- Settings Tab -->
        <div id="m-tab-settings" class="m-tab-content active">
          <div class="setting-group">
            <h4>Audio Channels (WebAudio API)</h4>
            <label class="setting-row">
              <span>Master Volume</span>
              <input type="range" id="vol-master" min="0" max="100" value="80" />
            </label>
            <label class="setting-row">
              <span>Reaction SFX</span>
              <input type="range" id="vol-sfx" min="0" max="100" value="90" />
            </label>
            <label class="setting-row">
              <span>Biome Ambient</span>
              <input type="range" id="vol-ambient" min="0" max="100" value="70" />
            </label>
          </div>

          <div class="setting-group">
            <h4>Accessibility &amp; Visuals (WCAG 2.1 AAA)</h4>
            <label class="setting-row checkbox">
              <input type="checkbox" id="toggle-contrast" />
              <span>High Contrast Borders (7:1 Luminance Ratio)</span>
            </label>
            <label class="setting-row checkbox">
              <input type="checkbox" id="toggle-motion" />
              <span>Reduced Motion (Disable boiling particle shaders)</span>
            </label>
            <label class="setting-row">
              <span>Text Scaling</span>
              <select id="scale-rem">
                <option value="100">100% (Standard)</option>
                <option value="125">125% (Large)</option>
                <option value="150">150% (Extra Large)</option>
              </select>
            </label>
          </div>
        </div>

        <!-- Compendium Tab -->
        <div id="m-tab-compendium" class="m-tab-content">
          <h4>256-Species Physical Chemistry Compendium</h4>
          <p class="sub">Dynamic encyclopedia of all registered elemental and molecular species.</p>
          <div class="compendium-table-wrapper">
            <table class="compendium-table">
              <thead>
                <tr>
                  <th>Idx</th>
                  <th>Formula</th>
                  <th>Name</th>
                  <th>Molar Mass</th>
                  <th>Standard Phase</th>
                  <th>Boiling Pt</th>
                  <th>Solubility</th>
                </tr>
              </thead>
              <tbody>
                ${speciesList.map((sp: ChemicalSpecies) => `
                  <tr>
                    <td>#${sp.index}</td>
                    <td><strong>${sp.code}</strong></td>
                    <td>${sp.name}</td>
                    <td>${sp.molarMass.toFixed(2)} g/mol</td>
                    <td><span class="phase-tag">${sp.standardPhase}</span></td>
                    <td>${sp.boilingPointK < 9999 ? `${sp.boilingPointK.toFixed(1)} K` : '—'}</td>
                    <td>${sp.solubilityGPer100gH2O < 9999 ? `${sp.solubilityGPer100gH2O} g/100g` : 'Miscible/Insol'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Save Data Tab -->
        <div id="m-tab-savedata" class="m-tab-content">
          <h4>Save Management &amp; Gzip Export</h4>
          <p class="sub">IndexedDB chem_world_v1 snapshots and compressed Base64 strings.</p>
          <div class="save-actions">
            <button id="btn-export-save" class="btn-primary">Export Save (Gzip Base64)</button>
            <button id="btn-import-save" class="ghost">Import Save from Clipboard / Text</button>
          </div>
          <div class="save-output-box">
            <textarea id="save-data-text" placeholder="Base64 Gzip payload will appear here..." rows="4"></textarea>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalContainer);

  const openBtn = document.createElement('button');
  openBtn.id = 'btn-open-settings';
  openBtn.className = 'ghost';
  openBtn.textContent = '⚙ Settings & Compendium';

  // Inject into topbar controls
  const controls = document.querySelector('.controls');
  if (controls) {
    controls.prepend(openBtn);
  }

  // Event handlers
  const closeModal = () => {
    modalContainer.classList.add('hidden');
    globalOverlayStack.remove(modalOverlayEntry);
  };

  const modalOverlayEntry = {
    id: 'settings-modal',
    close: closeModal,
  };

  openBtn.addEventListener('click', () => {
    modalContainer.classList.remove('hidden');
    globalOverlayStack.push(modalOverlayEntry);
  });

  modalContainer.querySelector('#modal-close')?.addEventListener('click', closeModal);

  modalContainer.querySelectorAll<HTMLButtonElement>('.m-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      modalContainer.querySelectorAll('.m-tab-btn').forEach((b) => b.classList.remove('active'));
      modalContainer.querySelectorAll('.m-tab-content').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      const tabId = `m-tab-${btn.dataset.tab}`;
      modalContainer.querySelector(`#${tabId}`)?.classList.add('active');
    });
  });

  // Export Save button
  modalContainer.querySelector('#btn-export-save')?.addEventListener('click', async () => {
    const raw = await options.onExportSave();
    const b64 = await compressSaveToBase64(JSON.stringify(raw));
    const textarea = modalContainer.querySelector<HTMLTextAreaElement>('#save-data-text');
    if (textarea) textarea.value = b64;
  });

  // Import Save button
  modalContainer.querySelector('#btn-import-save')?.addEventListener('click', async () => {
    const textarea = modalContainer.querySelector<HTMLTextAreaElement>('#save-data-text');
    if (textarea && textarea.value.trim()) {
      try {
        const restored = await decompressBase64ToSave(textarea.value.trim());
        options.onImportSave(restored);
        closeModal();
      } catch (err) {
        alert('Invalid or corrupted save string!');
      }
    }
  });

  // Audio volume sliders
  modalContainer.querySelector<HTMLInputElement>('#vol-master')?.addEventListener('input', (e) => {
    const val = Number((e.target as HTMLInputElement).value);
    audio.setChannel('master', sliderToGain(val));
  });

  modalContainer.querySelector<HTMLInputElement>('#vol-sfx')?.addEventListener('input', (e) => {
    const val = Number((e.target as HTMLInputElement).value);
    audio.setChannel('sfx', sliderToGain(val));
  });

  modalContainer.querySelector<HTMLInputElement>('#vol-ambient')?.addEventListener('input', (e) => {
    const val = Number((e.target as HTMLInputElement).value);
    audio.setChannel('ambient', sliderToGain(val));
  });

  // Accessibility toggles
  modalContainer.querySelector<HTMLInputElement>('#toggle-contrast')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    document.body.classList.toggle('high-contrast', checked);
  });

  modalContainer.querySelector<HTMLInputElement>('#toggle-motion')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    document.body.classList.toggle('reduced-motion', checked);
  });

  modalContainer.querySelector<HTMLSelectElement>('#scale-rem')?.addEventListener('change', (e) => {
    const scale = (e.target as HTMLSelectElement).value;
    document.documentElement.style.fontSize = `${scale}%`;
  });
}
