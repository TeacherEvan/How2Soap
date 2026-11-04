/**
 * Vessel list, workbench table, quest checklist and event log views.
 */
import { getSpecies, SPECIES, MAX_DEFINED_SPECIES } from '../data/speciesRegistry';
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
  rTemp,
  rPh,
  rPressure,
  rVolume,
  contentsBody,
  questList,
  logList,
  targetSelect,
  $,
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
  addBucket.addEventListener('click', () => {
    const id = nextVesselId();
    send({ type: 'CREATE_VESSEL', id, material: 'WOOD', capacityL: 5, label: 'Wooden Bucket' });
  });
  vesselList.append(addBucket);
}

function nextVesselId(): number {
  return state.vessels.reduce((max, vessel) => Math.max(max, vessel.id), 0) + 1;
}

export function updateTargets(): void {
  const current = targetSelect.value;
  targetSelect.replaceChildren();
  const condenserSelect = $<HTMLSelectElement>('condenser-target-select');
  if (condenserSelect) {
    const curCond = condenserSelect.value;
    condenserSelect.replaceChildren();
    const noneOpt = document.createElement('option');
    noneOpt.value = '-1';
    noneOpt.textContent = 'None (Vented)';
    condenserSelect.append(noneOpt);
    state.vessels.forEach((vessel) => {
      if (vessel.id === state.vessels[selectedIndex()]?.id) return;
      const option = document.createElement('option');
      option.value = String(vessel.id);
      option.textContent = `→ ${vessel.label}`;
      condenserSelect.append(option);
    });
    condenserSelect.value = curCond || '-1';
  }

  state.vessels.forEach((vessel) => {
    if (vessel.id === state.vessels[selectedIndex()]?.id) return;
    const option = document.createElement('option');
    option.value = String(vessel.id);
    option.textContent = `→ ${vessel.label}`;
    targetSelect.append(option);
  });
  if (Array.from(targetSelect.options).some((option) => option.value === current)) {
    targetSelect.value = current;
  }
}

export function renderWorkbench(snapshot: Snapshot): void {
  const vessel = state.vessels[selectedIndex()];
  if (!vessel) {
    vesselTitle.textContent = 'No vessel';
    vesselSub.textContent = '';
    return;
  }
  const index = selectedIndex();
  const base = index * 8;
  const temperatureK = snapshot.telemetry[base + TELEMETRY.TEMP_K];
  const ph = snapshot.telemetry[base + TELEMETRY.PH];
  const pressure = snapshot.telemetry[base + TELEMETRY.PRESSURE_KPA];
  const volume = snapshot.telemetry[base + TELEMETRY.VOLUME_L];

  vesselTitle.textContent = vessel.label;
  vesselSub.textContent = `${MATERIAL_LABEL[vessel.material] ?? vessel.material} · ${vessel.closed ? 'closed headspace' : 'open'}`;
  rTemp.textContent = `${temperatureK.toFixed(1)} K / ${(temperatureK - 273.15).toFixed(1)} °C`;
  rPh.textContent = volume > 0.01 ? ph.toFixed(2) : '—';
  rPressure.textContent = `${pressure.toFixed(0)} kPa`;
  rVolume.textContent = `${volume.toFixed(2)} L`;

  const rows: string[] = [];
  for (let speciesIdx = 0; speciesIdx < MAX_DEFINED_SPECIES; speciesIdx += 1) {
    let species;
    try {
      species = getSpecies(speciesIdx);
    } catch {
      continue;
    }
    const moles = speciesMoles(snapshot, index, speciesIdx);
    if (moles <= 1e-6) continue;
    rows.push(
      `<tr><td><span class="formula">${species.code}</span><span class="name">${species.name}</span></td>` +
        `<td>${moles.toFixed(4)}</td><td>${(moles * species.molarMass).toFixed(2)}</td>` +
        `<td class="phase">${species.standardPhase.toLowerCase()}</td></tr>`,
    );
  }
  contentsBody.innerHTML = rows.length
    ? rows.join('')
    : '<tr><td colspan="4" class="empty">Empty vessel.</td></tr>';

  if (state.bench3d) {
    const vesselStates = state.vessels.map((v, i) => {
      const b = i * 8;
      return {
        id: v.id,
        material: v.material as any,
        capacityL: v.capacityL,
        headspaceClosed: v.closed,
        temperatureK: snapshot.telemetry[b + TELEMETRY.TEMP_K],
        moles: new Float64Array(MAX_DEFINED_SPECIES),
        precipitated: new Float64Array(MAX_DEFINED_SPECIES),
        heaterWatts: snapshot.telemetry[b + TELEMETRY.HEATER_W],
        condenserTargetVesselId: -1,
        pressureKPa: snapshot.telemetry[b + TELEMETRY.PRESSURE_KPA],
        ruptured: false,
        appliedVolts: 0,
        cellResistanceOhm: 10,
      };
    });
    state.bench3d.render(vesselStates, vessel.id);
  }
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
