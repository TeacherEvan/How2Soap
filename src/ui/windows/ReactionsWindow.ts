/**
 * Chemical Workbench window — the full bench, full width.
 * 3D diorama + telemetry + furnace/voltaic controls + contents table.
 */
import { getSpecies, MAX_DEFINED_SPECIES } from '../../data/speciesRegistry';
import { REACTIONS } from '../../data/reactionRules';
import { escapeHtml } from '../escapeHtml';
import { TELEMETRY } from '../../engine/memoryLayout';
import {
  state,
  selectedIndex,
  speciesMoles,
  MATERIAL_LABEL,
  type Snapshot,
} from '../../app/state';
import { updateTargets } from '../../app/views';
import { bindBenchControls } from '../../app/actions';
import type { WindowSpec } from '../WindowManager';

let benchCanvas: import('../gl/LabBench3DCanvas').LabBench3DCanvas | null = null;
const sparklineHistory: Array<{ tempK: number; ph: number; pressureKpa: number }> = [];

function drawSparkline(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || sparklineHistory.length < 2) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Background grid line
  ctx.strokeStyle = '#1b242e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h);
  ctx.stroke();

  const len = sparklineHistory.length;
  const dx = w / Math.max(29, len - 1);

  // Draw Temp (mapped 250K - 450K)
  ctx.strokeStyle = '#e07a5f';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  sparklineHistory.forEach((pt, idx) => {
    const y = h - Math.max(2, Math.min(h - 2, ((pt.tempK - 273) / 120) * h));
    if (idx === 0) ctx.moveTo(0, y);
    else ctx.lineTo(idx * dx, y);
  });
  ctx.stroke();

  // Draw Pressure (mapped 80 - 250 kPa)
  ctx.strokeStyle = '#81b29a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  sparklineHistory.forEach((pt, idx) => {
    const y = h - Math.max(2, Math.min(h - 2, ((pt.pressureKpa - 80) / 170) * h));
    if (idx === 0) ctx.moveTo(0, y);
    else ctx.lineTo(idx * dx, y);
  });
  ctx.stroke();
}

const BENCH_HTML = `
  <div class="bench-win">
    <div class="bench-win-left">
      <p class="bench-vessel-label" aria-live="polite"></p>
      <div class="bench-3d-host" aria-label="3D vessel diorama — click a vessel to select it"></div>
      <div class="bench-quick mono" aria-label="Quick reagents">
        <button data-action="water" type="button">+ 1 L water</button>
        <button data-action="ash" type="button">+ 200 g ash</button>
        <button data-action="tallow" type="button">+ 200 g fat</button>
        <button data-action="salt" type="button">+ 50 g halite</button>
        <button data-action="heat" class="accent" type="button">Toggle 400 W</button>
        <button data-action="decant" type="button">Decant 1 L →</button>
        <button data-action="skim" type="button">Skim curds →</button>
        <select class="target-select" aria-label="Target vessel"></select>
      </div>
      <div class="advanced-vessel-controls bench-controls">
        <div class="bench-control-row">
          <label><strong>Heater:</strong> <span class="val-heater-w">0</span> W</label>
          <input type="range" class="heater-slider" min="0" max="1200" step="50" value="0" style="width:110px" aria-label="Heater power in watts">
          <span class="heater-teq-preview">(Eq: ~288 K)</span>
        </div>
        <div class="bench-control-row">
          <label><strong>Voltaic Pile:</strong> <span class="val-volts">0.0</span> V</label>
          <input type="range" class="volts-slider" min="0" max="13.2" step="0.6" value="0" style="width:90px" aria-label="Electrolysis voltage">
        </div>
        <div class="bench-control-row">
          <label for="condenser-window-select"><strong>Distill To:</strong></label>
          <select class="condenser-target-select" id="condenser-window-select" aria-label="Condenser target vessel">
            <option value="-1">None (Vented)</option>
          </select>
        </div>
        <div class="bench-control-row">
          <button class="ghost btn-toggle-lid" type="button">Lid: Open</button>
        </div>
      </div>
    </div>
    <div class="bench-win-right">
      <div class="readout-grid">
        <div class="readout"><span>Temperature</span><strong class="bench-temp">—</strong></div>
        <div class="readout"><span>pH</span><strong class="bench-ph">—</strong></div>
        <div class="readout"><span>Pressure</span><strong class="bench-pressure">—</strong></div>
        <div class="readout"><span>Liquid</span><strong class="bench-volume">—</strong></div>
      </div>
      <div class="phd-telemetry-panel" style="display:none; background:rgba(18,24,30,0.85); border:1px solid #3b82f6; border-radius:6px; padding:6px 10px; margin-bottom:0.5rem; font-size:0.75rem; color:#bfdbfe;">
        <div style="font-weight:600; color:#60a5fa; margin-bottom:2px;">🔬 PhD Telemetry (Tier III)</div>
        <div style="display:flex; justify-content:space-between; gap:8px;">
          <span>SID: <strong class="phd-sid">—</strong></span>
          <span>Arrhenius k: <strong class="phd-arrhenius">—</strong></span>
          <span>Newton Cooling: <strong class="phd-cooling">—</strong></span>
        </div>
      </div>
      <div class="active-reactions-card" style="background:rgba(20,24,32,0.85); border:1px solid #4a5568; border-radius:6px; padding:6px 10px; margin-bottom:0.5rem; font-size:0.75rem;">
        <div style="font-weight:600; color:#e2e8f0; margin-bottom:4px; display:flex; justify-content:space-between;">
          <span>⚗️ Stoichiometry & Active Reactions</span>
          <span class="active-rxn-count" style="color:var(--muted); font-weight:normal;">0 active</span>
        </div>
        <div class="active-rxn-list" style="display:flex; flex-direction:column; gap:4px; max-height:100px; overflow-y:auto;">
          <div style="color:var(--muted); font-style:italic;">No reactants present for known pathways.</div>
        </div>
      </div>
      <div class="bench-sparkline-box">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
          <span style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted)">Telemetry History (T / P / pH)</span>
          <span class="sparkline-legend" style="font-size:0.68rem; color:#ecdfc8;"><span style="color:#e07a5f">■</span> Temp <span style="color:#81b29a">■</span> Press <span style="color:#f2cc8f">■</span> pH</span>
        </div>
        <canvas class="bench-sparkline-canvas" width="380" height="48" style="width:100%; height:48px; background:#10151b; border:1px solid #22303a; border-radius:6px; display:block;"></canvas>
      </div>
      <div class="contents">
        <h3>Contents</h3>
        <table>
          <thead><tr><th>Species</th><th>mol</th><th>grams</th><th>Phase</th></tr></thead>
          <tbody class="contents-body"><tr><td colspan="4" class="empty">Empty vessel.</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
`;

function renderContentsTable(body: HTMLElement, snapshot: Snapshot, vesselIndex: number): void {
  const rows: string[] = [];
  for (let speciesIdx = 0; speciesIdx < MAX_DEFINED_SPECIES; speciesIdx += 1) {
    let species;
    try {
      species = getSpecies(speciesIdx);
    } catch {
      continue;
    }
    const moles = speciesMoles(snapshot, vesselIndex, speciesIdx);
    if (moles <= 1e-6) continue;
    rows.push(
      `<tr><td><span class="formula">${escapeHtml(species.code)}</span><span class="name">${escapeHtml(species.name)}</span></td>` +
        `<td>${moles.toFixed(4)}</td><td>${(moles * species.molarMass).toFixed(2)}</td>` +
        `<td class="phase">${species.standardPhase.toLowerCase()}</td></tr>`,
    );
  }
  const tbody = body.querySelector<HTMLElement>('.contents-body')!;
  tbody.innerHTML = rows.length
    ? rows.join('')
    : '<tr><td colspan="4" class="empty">Empty vessel.</td></tr>';
}

function renderActiveReactions(body: HTMLElement, snapshot: Snapshot, vesselIndex: number): void {
  const container = body.querySelector<HTMLElement>('.active-rxn-list');
  const countEl = body.querySelector<HTMLElement>('.active-rxn-count');
  if (!container || !countEl) return;

  const activeRxns: Array<{ label: string; limitingCode: string; limitingMoles: number }> = [];

  for (const rxn of REACTIONS) {
    let allReactantsPresent = true;
    let minEquivalent = Infinity;
    let limitingCode = '';
    let limitingMoles = 0;

    for (const reactant of rxn.reactants) {
      const moles = speciesMoles(snapshot, vesselIndex, reactant.speciesIdx);
      if (moles <= 1e-6) {
        allReactantsPresent = false;
        break;
      }
      const equivalent = moles / reactant.stoich;
      if (equivalent < minEquivalent) {
        minEquivalent = equivalent;
        try {
          limitingCode = getSpecies(reactant.speciesIdx).code;
        } catch {
          limitingCode = `Species#${reactant.speciesIdx}`;
        }
        limitingMoles = moles;
      }
    }

    if (allReactantsPresent && minEquivalent > 0 && minEquivalent !== Infinity) {
      activeRxns.push({
        label: rxn.label,
        limitingCode,
        limitingMoles,
      });
    }
  }

  countEl.textContent = `${activeRxns.length} active`;

  if (activeRxns.length === 0) {
    container.innerHTML = '<div style="color:var(--muted); font-style:italic;">No reactants present for known pathways.</div>';
    return;
  }

  container.innerHTML = activeRxns
    .map((rxn) => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25); padding:3px 6px; border-radius:4px;">
        <span style="color:#f1fa8c; font-family:monospace; font-size:0.75rem;">${escapeHtml(rxn.label)}</span>
        <span title="Limiting Reagent (${rxn.limitingMoles.toFixed(3)} mol)" style="background:#ef4444; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:3px; font-weight:600;">
          Limiting: ${escapeHtml(rxn.limitingCode)}
        </span>
      </div>
    `)
    .join('');
}

function renderBench(body: HTMLElement, snapshot: Snapshot): void {
  const vessel = state.vessels[selectedIndex()];
  const label = body.querySelector<HTMLElement>('.bench-vessel-label')!;
  if (!vessel) {
    label.textContent = 'No vessel — add a bucket from the vessels list.';
    return;
  }
  const index = selectedIndex();
  const base = index * 8;
  const temperatureK = snapshot.telemetry[base + TELEMETRY.TEMP_K];
  const ph = snapshot.telemetry[base + TELEMETRY.PH];
  const pressure = snapshot.telemetry[base + TELEMETRY.PRESSURE_KPA];
  const volume = snapshot.telemetry[base + TELEMETRY.VOLUME_L];

  label.textContent = `${vessel.label} — ${MATERIAL_LABEL[vessel.material] ?? vessel.material} · ${vessel.closed ? 'closed headspace' : 'open'}`;
  body.querySelector<HTMLElement>('.bench-temp')!.textContent = `${temperatureK.toFixed(1)} K / ${(temperatureK - 273.15).toFixed(1)} °C`;
  body.querySelector<HTMLElement>('.bench-ph')!.textContent = volume > 0.01 ? ph.toFixed(2) : '—';
  body.querySelector<HTMLElement>('.bench-pressure')!.textContent = `${pressure.toFixed(0)} kPa`;
  body.querySelector<HTMLElement>('.bench-volume')!.textContent = `${volume.toFixed(2)} L`;

  const phdPanel = body.querySelector<HTMLElement>('.phd-telemetry-panel');
  if (phdPanel) {
    if (state.tutorial?.isPhdTelemetryEnabled()) {
      phdPanel.style.display = 'block';
      const phd = state.tutorial.computePhdTelemetry(index, snapshot);
      const sidEl = phdPanel.querySelector('.phd-sid');
      const arrEl = phdPanel.querySelector('.phd-arrhenius');
      const coolEl = phdPanel.querySelector('.phd-cooling');
      if (sidEl) sidEl.textContent = `${phd.sidMolL >= 0 ? '+' : ''}${phd.sidMolL.toExponential(2)} mol/L`;
      if (arrEl) arrEl.textContent = phd.arrheniusRateK.toExponential(2);
      if (coolEl) coolEl.textContent = `${phd.newtonCoolingWatts.toFixed(1)} W`;
    } else {
      phdPanel.style.display = 'none';
    }
  }

  // Update sparkline ring buffer (max 30 samples)
  sparklineHistory.push({ tempK: temperatureK, ph, pressureKpa: pressure });
  if (sparklineHistory.length > 30) sparklineHistory.shift();
  const sparkCanvas = body.querySelector<HTMLCanvasElement>('.bench-sparkline-canvas');
  if (sparkCanvas) drawSparkline(sparkCanvas);

  renderContentsTable(body, snapshot, index);
  renderActiveReactions(body, snapshot, index);

  if (benchCanvas) {
    const vesselStates = state.vessels.map((v, i) => {
      const b = i * 8;
      // Real species moles from the snapshot (M1 Task 9: LabBench liquid-fill
      // morph scales with these). Precipitated solids stay in the vessel and
      // are not modelled by the snapshot, so they read as zero.
      const moles = new Float64Array(MAX_DEFINED_SPECIES);
      for (let speciesIdx = 0; speciesIdx < MAX_DEFINED_SPECIES; speciesIdx += 1) {
        moles[speciesIdx] = speciesMoles(snapshot, i, speciesIdx);
      }
      return {
        id: v.id,
        material: v.material as any,
        capacityL: v.capacityL,
        headspaceClosed: v.closed,
        temperatureK: snapshot.telemetry[b + TELEMETRY.TEMP_K],
        moles,
        precipitated: new Float64Array(MAX_DEFINED_SPECIES),
        heaterWatts: snapshot.telemetry[b + TELEMETRY.HEATER_W],
        condenserTargetVesselId: v.id === vessel.id ? -1 : -1,
        pressureKPa: snapshot.telemetry[b + TELEMETRY.PRESSURE_KPA],
        ruptured: false,
        appliedVolts: 0,
        cellResistanceOhm: 10,
      };
    });
    benchCanvas.render(vesselStates, vessel.id);
  }
}

export const spec: WindowSpec = {
  id: 'reactions',
  title: 'Chemical Workbench',
  icon: '🔬',
  size: 'full',
  mount(body: HTMLElement) {
    body.innerHTML = BENCH_HTML;
    bindBenchControls(body);
    updateTargets();

    // Instantiate the 3D diorama inside the window — lazy-loaded chunk.
    const host = body.querySelector<HTMLElement>('.bench-3d-host')!;
    import('../gl/LabBench3DCanvas').then(({ LabBench3DCanvas }) => {
      benchCanvas = new LabBench3DCanvas(host, {
        onSelectVessel: (vesselId: number) => {
          const idx = state.vessels.findIndex((v) => v.id === vesselId);
          if (idx !== -1) {
            state.selected = idx;
          }
        },
      });
      state.bench3d = benchCanvas as never;
      if (state.snapshot) renderBench(body, state.snapshot);
    });

    if (state.snapshot) {
      renderBench(body, state.snapshot);
    }
  },
  unmount() {
    if (benchCanvas) {
      benchCanvas.destroy();
      benchCanvas = null;
    }
    state.bench3d = null;
  },
  onSnapshot(snapshot, body) {
    renderBench(body, snapshot);
  },
};
