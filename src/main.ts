import './styles.css';
import { SharedWorldView, SAB_BYTE_LENGTH, MAX_SPECIES, TELEMETRY } from './engine/memoryLayout';
import { getSpecies, SPECIES } from './data/speciesRegistry';

interface VesselMeta {
  id: number;
  material: string;
  capacityL: number;
  closed: boolean;
  label: string;
}

interface Snapshot {
  tick: number;
  telemetry: Float64Array;
  moles: Float64Array;
}

const MATERIAL_LABEL: Record<string, string> = {
  WOOD: 'Wood',
  RAW_CLAY: 'Raw clay',
  FIRED_CERAMIC: 'Fired ceramic',
  COPPER: 'Copper',
  BOROSILICATE: 'Borosilicate',
};

const state = {
  worker: null as Worker | null,
  view: null as SharedWorldView | null,
  snapshot: null as Snapshot | null,
  vessels: [] as VesselMeta[],
  selected: 0,
  ever: { ash: false, lye: false, fat: false, soap: false, barSoap: false },
  log: [] as string[],
  paused: false,
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app missing');

app.innerHTML = `
  <div class="game">
    <header class="topbar">
      <div class="brand">
        <span class="flame">△</span>
        <div>
          <h1>Chemistry Survival</h1>
          <p>Emergent thermodynamics &amp; survival engine</p>
        </div>
      </div>
      <div class="telemetry">
        <div class="stat"><span class="stat-label">Isolation</span><strong id="isolation">checking…</strong></div>
        <div class="stat"><span class="stat-label">Day / Hour</span><strong id="clock">—</strong></div>
        <div class="stat"><span class="stat-label">Sim speed</span><strong>1 h / s</strong></div>
      </div>
      <div class="controls">
        <button id="pause" class="ghost">Pause</button>
        <button id="sleep1" class="ghost">Sleep 1 h</button>
        <button id="sleep8" class="ghost">Sleep 8 h</button>
        <button id="reset" class="ghost danger">New world</button>
      </div>
    </header>
    <main class="layout">
      <aside class="panel vessels-panel">
        <h2>Vessels</h2>
        <div id="vessel-list" class="vessel-list"></div>
        <p class="hint">Wood chars at 523 K. Clay survives 1473 K. Copper conducts heat fast.</p>
      </aside>
      <section class="panel workbench">
        <div class="workbench-head">
          <div>
            <h2 id="vessel-title">No vessel</h2>
            <p id="vessel-sub" class="sub"></p>
          </div>
          <div class="readouts">
            <div class="readout"><span>Temperature</span><strong id="r-temp">—</strong></div>
            <div class="readout"><span>pH</span><strong id="r-ph">—</strong></div>
            <div class="readout"><span>Pressure</span><strong id="r-pressure">—</strong></div>
            <div class="readout"><span>Liquid</span><strong id="r-volume">—</strong></div>
          </div>
        </div>

        <div class="actions">
          <button data-action="water">+ 1 L water</button>
          <button data-action="ash">+ 200 g hardwood ash</button>
          <button data-action="tallow">+ 200 g raw fat</button>
          <button data-action="salt">+ 50 g halite</button>
          <button data-action="heat" class="accent">Toggle 400 W heater</button>
          <button data-action="decant">Decant 1 L →</button>
          <button data-action="skim">Skim soap curds →</button>
          <select id="target" class="target" aria-label="Target vessel"></select>
        </div>

        <div class="contents">
          <h3>Contents</h3>
          <table>
            <thead><tr><th>Species</th><th>mol</th><th>grams</th><th>Phase</th></tr></thead>
            <tbody id="contents-body"><tr><td colspan="4" class="empty">Empty vessel.</td></tr></tbody>
          </table>
        </div>
      </section>
      <aside class="panel quest-panel">
        <h2>The soap trail</h2>
        <ul class="quest" id="quest"></ul>
        <h2>Event log</h2>
        <ul class="log" id="log"><li class="empty">No events yet.</li></ul>
      </aside>
    </main>
  </div>
`;

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
};

const isoBadge = $('isolation');
const clock = $('clock');
const vesselList = $('vessel-list');
const vesselTitle = $('vessel-title');
const vesselSub = $('vessel-sub');
const rTemp = $('r-temp');
const rPh = $('r-ph');
const rPressure = $('r-pressure');
const rVolume = $('r-volume');
const contentsBody = $('contents-body');
const questList = $('quest');
const logList = $('log');
const targetSelect = $<HTMLSelectElement>('target');
const pauseButton = $<HTMLButtonElement>('pause');

function send(command: unknown): void {
  state.worker?.postMessage(command);
}

function formatClock(snapshot: Snapshot): string {
  const seconds = snapshot.tick * 360;
  const day = Math.floor(seconds / 86400) + 1;
  const hour = Math.floor((seconds % 86400) / 3600);
  return `Day ${day} · ${String(hour).padStart(2, '0')}:00`;
}

function selectedIndex(): number {
  return Math.min(state.selected, Math.max(0, state.vessels.length - 1));
}

function speciesMoles(snapshot: Snapshot, vesselIndex: number, speciesIdx: number): number {
  return snapshot.moles[vesselIndex * MAX_SPECIES + speciesIdx];
}

function renderVessels(): void {
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

function updateTargets(): void {
  const current = targetSelect.value;
  targetSelect.replaceChildren();
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

function renderWorkbench(snapshot: Snapshot): void {
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
  for (let speciesIdx = 0; speciesIdx < 32; speciesIdx += 1) {
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
}

function renderQuest(snapshot: Snapshot): void {
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

  const steps = [
    { done: state.ever.ash, text: 'Burn hardwood, gather 200 g ash' },
    { done: state.ever.lye, text: 'Leach ash in water (pH > 13)' },
    { done: state.ever.ash && state.ever.lye, text: 'Decant the lye off the chalk' },
    { done: state.ever.fat, text: 'Render 200 g animal fat' },
    { done: state.ever.soap, text: 'Saponify: warm lye + tallow' },
    { done: state.ever.barSoap, text: 'Salt out hard bar soap' },
  ];
  questList.innerHTML = steps
    .map(
      (step) =>
        `<li class="${step.done ? 'done' : ''}"><span class="tick">${step.done ? '✓' : '○'}</span>${step.text}</li>`,
    )
    .join('');
}

function renderLog(): void {
  if (state.log.length === 0) {
    logList.innerHTML = '<li class="empty">No events yet.</li>';
    return;
  }
  logList.innerHTML = state.log
    .slice(-14)
    .map((line) => `<li>${line}</li>`)
    .join('');
}

function handleEvent(message: string, vesselId: number): void {
  const vessel = state.vessels.find((item) => item.id === vesselId);
  const clean = message.replace(/:[0-9.]+$/, '');
  const [kind, detail] = clean.split(':');
  const label: Record<string, string> = {
    reaction: 'reaction',
    boil: 'boiling',
    condense: 'condensing',
    precipitate: 'precipitate',
    material_failure: 'material failure',
    vessel_rupture: 'VESSEL RUPTURE',
    electrolysis: 'electrolysis',
  };
  const line = `${vessel?.label ?? `Vessel ${vesselId}`}: ${label[kind] ?? kind}${detail ? ` ${detail}` : ''}`;
  if (state.log[state.log.length - 1] === line) return;
  state.log.push(line);
  if (state.log.length > 60) state.log.shift();
  renderLog();
}

function frame(): void {
  if (state.view) {
    try {
      const snapshot = state.view.readSnapshot();
      state.snapshot = snapshot;
      clock.textContent = formatClock(snapshot);
      renderWorkbench(snapshot);
      renderQuest(snapshot);
    } catch {
      // A transient inconsistent read is retried next frame.
    }
  }
  requestAnimationFrame(frame);
}

function startWorld(): void {
  if (!self.crossOriginIsolated) {
    isoBadge.textContent = 'NOT ISOLATED';
    isoBadge.className = 'bad';
    logList.innerHTML =
      '<li class="error">SharedArrayBuffer requires COOP/COEP headers. Run via webpack-dev-server or the Vercel deployment.</li>';
    return;
  }
  isoBadge.textContent = 'COOP / COEP OK';
  isoBadge.className = 'good';

  const sab = new SharedArrayBuffer(SAB_BYTE_LENGTH);
  state.view = new SharedWorldView(sab);
  state.worker = new Worker(new URL('./engine/sim.worker.ts', import.meta.url), {
    type: 'module',
  });
  state.worker.onmessage = (event: MessageEvent) => {
    const data = event.data as
      | { type: 'VESSELS'; vessels: VesselMeta[] }
      | { type: 'EVENTS'; events: Array<{ vesselId: number; message: string }> }
      | { type: 'READY' };
    if (data.type === 'VESSELS') {
      state.vessels = data.vessels;
      renderVessels();
      updateTargets();
    } else if (data.type === 'EVENTS') {
      for (const item of data.events) handleEvent(item.message, item.vesselId);
    }
  };
  state.worker.postMessage({ type: 'INIT', sab });
  state.worker.postMessage({
    type: 'CREATE_VESSEL',
    id: 1,
    material: 'WOOD',
    capacityL: 5,
    label: 'Wooden Bucket',
  });
  state.worker.postMessage({
    type: 'CREATE_VESSEL',
    id: 2,
    material: 'FIRED_CERAMIC',
    capacityL: 2,
    label: 'Clay Pot',
  });
  state.worker.postMessage({
    type: 'CREATE_VESSEL',
    id: 3,
    material: 'COPPER',
    capacityL: 1,
    closed: true,
    label: 'Copper Still',
  });
}

function bindActions(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const vessel = state.vessels[selectedIndex()];
      if (!vessel) return;
      const action = button.dataset.action;
      if (action === 'water') send({ type: 'ADD_WATER', vesselId: vessel.id, litres: 1 });
      if (action === 'ash') send({ type: 'ADD_ASH', vesselId: vessel.id, grams: 200 });
      if (action === 'tallow')
        send({
          type: 'ADD_SPECIES',
          vesselId: vessel.id,
          speciesIdx: SPECIES.TRISTEARIN,
          moles: 150 / 891.5,
        });
      if (action === 'salt')
        send({
          type: 'ADD_SPECIES',
          vesselId: vessel.id,
          speciesIdx: SPECIES.NACL,
          moles: 50 / 58.44,
        });
      if (action === 'heat') {
        const current = state.snapshot
          ? state.snapshot.telemetry[selectedIndex() * 8 + TELEMETRY.HEATER_W]
          : 0;
        send({ type: 'SET_HEATER', vesselId: vessel.id, watts: current > 0 ? 0 : 400 });
        button.classList.toggle('active', current === 0);
      }
      if (action === 'decant') {
        const targetId = Number(targetSelect.value);
        if (targetId) send({ type: 'DECANT', fromId: vessel.id, toId: targetId, litres: 1 });
      }
      if (action === 'skim') {
        const targetId = Number(targetSelect.value);
        if (targetId) send({ type: 'SKIM', fromId: vessel.id, toId: targetId, speciesIdx: SPECIES.NA_STEARATE });
      }
    });
  });

  pauseButton.addEventListener('click', () => {
    state.paused = !state.paused;
    send({ type: 'SET_PAUSED', paused: state.paused });
    pauseButton.textContent = state.paused ? 'Resume' : 'Pause';
  });

  $('sleep1').addEventListener('click', () => send({ type: 'ADVANCE', hours: 1 }));
  $('sleep8').addEventListener('click', () => send({ type: 'ADVANCE', hours: 8 }));
  $('reset').addEventListener('click', () => {
    state.worker?.terminate();
    state.worker = null;
    state.view = null;
    state.vessels = [];
    state.log = [];
    state.ever = { ash: false, lye: false, fat: false, soap: false, barSoap: false };
    startWorld();
  });
}

startWorld();
bindActions();
renderVessels();
renderLog();
requestAnimationFrame(frame);
