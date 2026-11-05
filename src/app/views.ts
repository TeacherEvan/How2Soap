/**
 * Vessel list, workbench table, quest checklist and event log views.
 */
import { SPECIES } from '../data/speciesRegistry';
import { TELEMETRY } from '../engine/memoryLayout';
import {
  state,
  selectedIndex,
  speciesMoles,
  send,
  MATERIAL_LABEL,
  type Snapshot,
} from './state';
import {
  vesselList,
  vesselTitle,
  vesselSub,
  rsTemp,
  rsPh,
  rsPressure,
  rsVolume,
  questList,
  logList,
} from './dom';

export function renderVessels(): void {
  vesselList.replaceChildren();
  state.vessels.forEach((vessel, index) => {
    const button = document.createElement('button');
    button.className = `vessel ${index === selectedIndex() ? 'selected' : ''}`;
    button.innerHTML = `
      <span class="vessel-name">${vessel.label}</span>
      <span class="vessel-meta">${MATERIAL_LABEL[vessel.material] ?? vessel.material} · ${vessel.capacityL} L${vessel.closed ? ' · closed' : ''}</span>
    `;
    button.addEventListener('click', () => {
      state.selected = index;
      renderVessels();
      updateTargets();
    });
    vesselList.append(button);
  });

  const addBucket = document.createElement('button');
  addBucket.className = 'add-vessel';
  addBucket.textContent = '+ Wooden bucket (5 L)';
  if (state.vessels.length >= 32) {
    addBucket.disabled = true;
    addBucket.title = 'Vessel limit reached (max 32 vessels)';
  } else {
    addBucket.addEventListener('click', () => {
      const id = nextVesselId();
      send({ type: 'CREATE_VESSEL', id, material: 'WOOD', capacityL: 5, label: 'Wooden Bucket' });
    });
  }
  vesselList.append(addBucket);
}

function nextVesselId(): number {
  return state.vessels.reduce((max, vessel) => Math.max(max, vessel.id), 0) + 1;
}

export function updateTargets(): void {
  const syncSelect = (selector: string): HTMLSelectElement | null => {
    const select = document.querySelector<HTMLSelectElement>(selector);
    if (!select) return null;
    const current = select.value;
    select.replaceChildren();
    if (selector.includes('condenser')) {
      const noneOpt = document.createElement('option');
      noneOpt.value = '-1';
      noneOpt.textContent = 'None (Vented)';
      select.append(noneOpt);
    }
    state.vessels.forEach((vessel) => {
      if (vessel.id === state.vessels[selectedIndex()]?.id) return;
      const option = document.createElement('option');
      option.value = String(vessel.id);
      option.textContent = `→ ${vessel.label}`;
      select.append(option);
    });
    if (Array.from(select.options).some((o) => o.value === current)) select.value = current;
    return select;
  };
  syncSelect('.target-select');
  syncSelect('.condenser-target-select');
}

export function renderReactionsSummary(snapshot: Snapshot): void {
  const vessel = state.vessels[selectedIndex()];
  if (!vessel) {
    vesselTitle.textContent = 'No vessel';
    vesselSub.textContent = '';
    rsTemp.textContent = '—';
    rsPh.textContent = '—';
    rsPressure.textContent = '—';
    rsVolume.textContent = '—';
    return;
  }
  const index = selectedIndex();
  const base = index * 8;
  const temperatureK = base < snapshot.telemetry.length ? snapshot.telemetry[base + TELEMETRY.TEMP_K] : undefined;
  const ph = base < snapshot.telemetry.length ? snapshot.telemetry[base + TELEMETRY.PH] : undefined;
  const pressure = base < snapshot.telemetry.length ? snapshot.telemetry[base + TELEMETRY.PRESSURE_KPA] : undefined;
  const volume = base < snapshot.telemetry.length ? snapshot.telemetry[base + TELEMETRY.VOLUME_L] : undefined;

  vesselTitle.textContent = vessel.label;
  vesselSub.textContent = `${MATERIAL_LABEL[vessel.material] ?? vessel.material} · ${vessel.closed ? 'closed headspace' : 'open'}`;
  rsTemp.textContent = typeof temperatureK === 'number' && Number.isFinite(temperatureK) ? `${temperatureK.toFixed(1)} K` : '—';
  rsPh.textContent = typeof ph === 'number' && Number.isFinite(ph) && (volume ?? 0) > 0.01 ? ph.toFixed(2) : '—';
  rsPressure.textContent = typeof pressure === 'number' && Number.isFinite(pressure) ? `${pressure.toFixed(0)} kPa` : '—';
  rsVolume.textContent = typeof volume === 'number' && Number.isFinite(volume) ? `${volume.toFixed(2)} L` : '—';
}

export function renderQuest(snapshot: Snapshot): void {
  const any = (speciesIdx: number): number => {
    for (let index = 0; index < state.vessels.length; index += 1) {
      if (speciesMoles(snapshot, index, speciesIdx) > 1e-4) return speciesMoles(snapshot, index, speciesIdx);
    }
    return 0;
  };
  if (any(SPECIES.K2CO3) > 0 || any(SPECIES.CAO) > 0) state.ever.ash = true;
  if (any(SPECIES.KOH) > 0.1) state.ever.lye = true;
  if (any(SPECIES.TRISTEARIN) > 0.01) state.ever.fat = true;
  if (any(SPECIES.K_STEARATE) > 0.01) state.ever.soap = true;
  if (any(SPECIES.NA_STEARATE) > 0.01) state.ever.barSoap = true;
  if (state.inventory.backpackUnlocked) state.ever.backpack = true;
  if (state.inventory.tools.EATING_UTENSIL?.name?.includes('Bronze Fork') || any(SPECIES.BRONZE) > 0) state.ever.bronzeFork = true;
  if (any(SPECIES.SALICYLIC_ACID) > 0 || any(SPECIES.PENICILLIN) > 0 || any(SPECIES.ETHANOL) > 0.1) state.ever.medicine = true;
  if (any(SPECIES.POTASSIUM_METAL) > 0 || any(SPECIES.SODIUM_METAL) > 0 || any(SPECIES.H2SO4) > 0.1) state.ever.voltaicPile = true;

  const steps = [
    { done: state.ever.backpack, text: 'Tier 1: Stitch Leather Backpack (Tanning & Sinew)' },
    { done: state.ever.barSoap, text: 'Tier 2: Potash & Hard Bar Soap (Ash → Lye → Saponification)' },
    { done: state.ever.bronzeFork, text: 'Tier 3: Bronze Fork & Metallurgy (Reduction & Alloying)' },
    { done: state.ever.medicine, text: 'Tier 4: Medicines (Salicylic Acid, Penicillin & Antiseptic)' },
    { done: state.ever.voltaicPile, text: 'Tier 5: Voltaic Pile & Pure Elements (Faraday Electrolysis)' },
  ];
  questList.innerHTML = steps
    .map(
      (step) =>
        `<li class="${step.done ? 'done' : ''}"><span class="check">${step.done ? '✓' : '○'}</span><span>${step.text}</span></li>`,
    )
    .join('');
}

export function renderLog(): void {
  if (state.log.length === 0) {
    logList.innerHTML = '<li class="empty">No events yet.</li>';
    return;
  }
  logList.innerHTML = state.log
    .slice(-8)
    .map((entry) => `<li>${entry}</li>`)
    .join('');
}
