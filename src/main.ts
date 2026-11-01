import './styles.css';
import { SharedWorldView, SAB_BYTE_LENGTH, MAX_SPECIES, TELEMETRY } from './engine/memoryLayout';
import { getSpecies, SPECIES, MAX_DEFINED_SPECIES } from './data/speciesRegistry';
import { renderBiomeTreePanel } from './ui/BiomeTreePanel';
import { renderToolAndInventoryPanel, type ToolAndInventoryState } from './ui/ToolAndInventoryPanel';
import {
  renderWorkbenchTabs,
  renderFabricationTab,
  renderPaddockTab,
  type WorkbenchTab,
} from './ui/WorkbenchCanvas';
import { initMenuAndSettings } from './ui/MenuController';
import type { HarvestablePart } from './data/biomeNodes';
import type { SerializedWorldSave } from './engine/persistence';

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
  activeTab: 'REACTIONS' as WorkbenchTab,
  ever: {
    ash: false,
    lye: false,
    fat: false,
    soap: false,
    barSoap: false,
    backpack: false,
    bronzeFork: false,
    medicine: false,
    voltaicPile: false,
  },
  log: [] as string[],
  paused: false,
  player: {
    glucoseKcal: 1200,
    adiposeKcal: 15000,
    hydrationPct: 100,
    coreTempC: '37.0',
    clothingIclo: 0.05,
  },
  inventory: {
    backpackUnlocked: false,
    bareHands: [null, null],
    backpack: new Array(24).fill(null),
    tools: {
      CUTTING_SKINNING: null,
      CHOPPING_CARVING: null,
      PERCUSSION_MINING: { name: 'River Hammerstone', slot: 'PERCUSSION_MINING', mohs: 6.5 },
      THERMAL_HANDLING: null,
      STITCHING_MEDICAL: null,
      EATING_UTENSIL: null,
    },
  } as ToolAndInventoryState,
  paddock: {
    animalsCount: 2,
    feedKg: 20.0,
    waterL: 50.0,
    manureKg: 0.84,
  },
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
        <div class="stat"><span class="stat-label">Glucose</span><strong id="p-glucose">1200 kcal</strong></div>
        <div class="stat"><span class="stat-label">Body Temp</span><strong id="p-temp">37.0 °C</strong></div>
        <div class="stat"><span class="stat-label">Insulation</span><strong id="p-iclo">0.05 clo</strong></div>
      </div>
      <div class="controls">
        <button id="pause" class="ghost">Pause</button>
        <button id="sleep1" class="ghost">Sleep 1 h</button>
        <button id="sleep8" class="ghost">Sleep 8 h</button>
        <button id="reset" class="ghost danger">New world</button>
      </div>
    </header>

    <main class="layout-4panel">
      <!-- Panel 1: Left Biome Tree -->
      <aside class="panel biome-panel" id="biome-panel-container"></aside>

      <!-- Panel 2: Center Left Vessels List -->
      <aside class="panel vessels-panel">
        <h2>Vessels</h2>
        <div id="vessel-list" class="vessel-list"></div>
        <p class="hint">Wood chars at 523 K. Clay survives 1473 K. Copper conducts heat fast.</p>
      </aside>

      <!-- Panel 3: Center Tabbed Workbench -->
      <section class="panel workbench">
        <div id="workbench-tabs-container"></div>

        <!-- Tab 1: Chemical Reactions -->
        <div id="tab-reactions-content" class="tab-pane active">
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
        </div>

        <!-- Tab 2: Mechanical Fabrication -->
        <div id="tab-fabrication-content" class="tab-pane hidden"></div>

        <!-- Tab 3: Domesticated Paddocks -->
        <div id="tab-paddocks-content" class="tab-pane hidden"></div>

        <div class="workbench-foot">
          <div class="quest-box">
            <h3>Master Tech Progression</h3>
            <ul class="quest" id="quest"></ul>
          </div>
          <div class="event-box">
            <h3>Event Log</h3>
            <ul class="log" id="log"><li class="empty">No events yet.</li></ul>
          </div>
        </div>
      </section>

      <!-- Panel 4: Right Dedicated Tools & Inventory -->
      <aside class="panel tool-inv-panel" id="tool-inv-container"></aside>
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
const pGlucose = $('p-glucose');
const pTemp = $('p-temp');
const pIclo = $('p-iclo');
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

const biomePanel = $('biome-panel-container');
const toolInvPanel = $('tool-inv-container');
const tabsNavContainer = $('workbench-tabs-container');
const tabReactions = $('tab-reactions-content');
const tabFabrication = $('tab-fabrication-content');
const tabPaddocks = $('tab-paddocks-content');

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

function renderLog(): void {
  if (state.log.length === 0) {
    logList.innerHTML = '<li class="empty">No events yet.</li>';
    return;
  }
  logList.innerHTML = state.log
    .slice(-8)
    .map((entry) => `<li>${entry}</li>`)
    .join('');
}

function switchTab(tab: WorkbenchTab): void {
  state.activeTab = tab;
  renderWorkbenchTabs(tabsNavContainer, {
    currentTab: tab,
    onSelectTab: switchTab,
    onExecuteRecipe: (recipeId) => send({ type: 'FABRICATE', recipeId }),
    onFeedPaddock: () => {
      state.paddock.feedKg += 5;
      state.log.push('Refilled paddock feeder (+5 kg)');
      renderLog();
      updatePaddockUI();
    },
    onWaterPaddock: () => {
      state.paddock.waterL += 10;
      state.log.push('Refilled paddock water trough (+10 L)');
      renderLog();
      updatePaddockUI();
    },
  });

  tabReactions.classList.toggle('hidden', tab !== 'REACTIONS');
  tabFabrication.classList.toggle('hidden', tab !== 'FABRICATION');
  tabPaddocks.classList.toggle('hidden', tab !== 'PADDOCKS');

  if (tab === 'FABRICATION') {
    renderFabricationTab(tabFabrication, (recipeId) => {
      send({ type: 'FABRICATE', recipeId });
      state.log.push(`Fabricated recipe ${recipeId}`);
      renderLog();
    });
  } else if (tab === 'PADDOCKS') {
    updatePaddockUI();
  }
}

function updatePaddockUI(): void {
  renderPaddockTab(
    tabPaddocks,
    state.paddock,
    () => {
      state.paddock.feedKg += 5;
      state.log.push('Refilled paddock feeder (+5 kg)');
      renderLog();
      updatePaddockUI();
    },
    () => {
      state.paddock.waterL += 10;
      state.log.push('Refilled paddock water trough (+10 L)');
      renderLog();
      updatePaddockUI();
    },
  );
}

function updatePlayerUI(): void {
  pGlucose.textContent = `${state.player.glucoseKcal} kcal`;
  pTemp.textContent = `${state.player.coreTempC} °C`;
  pIclo.textContent = `${state.player.clothingIclo.toFixed(2)} clo`;
  renderToolAndInventoryPanel(toolInvPanel, state.inventory, () => {
    send({ type: 'FABRICATE', recipeId: 'RECIPE_STITCH_BACKPACK' });
  });
}

function frame(): void {
  if (state.view) {
    const snapshot = state.view.readSnapshot();
    if (snapshot) {
      state.snapshot = snapshot;
      clock.textContent = formatClock(snapshot);
      if (state.activeTab === 'REACTIONS') {
        renderWorkbench(snapshot);
      }
      renderQuest(snapshot);
    }
  }
  requestAnimationFrame(frame);
}

function startWorld(): void {
  const isIsolated = window.crossOriginIsolated;
  isoBadge.textContent = isIsolated ? 'Isolated (SAB active)' : 'Fallback (simulated SAB)';
  isoBadge.classList.toggle('good', isIsolated);
  isoBadge.classList.toggle('warn', !isIsolated);

  const sab = new SharedArrayBuffer(SAB_BYTE_LENGTH);
  state.view = new SharedWorldView(sab);

  state.worker = new Worker(new URL('./engine/sim.worker.ts', import.meta.url));
  state.worker.onmessage = (
    event: MessageEvent<
      | { type: 'READY' }
      | { type: 'VESSELS'; vessels: VesselMeta[] }
      | { type: 'EVENTS'; events: Array<{ vesselId: number; message: string }> }
      | { type: 'PLAYER_SYNC'; player: any; inventory: any }
    >,
  ) => {
    const data = event.data;
    if (data.type === 'READY') {
      createSeedVessels();
    } else if (data.type === 'VESSELS') {
      state.vessels = data.vessels;
      renderVessels();
      updateTargets();
    } else if (data.type === 'EVENTS') {
      for (const ev of data.events) {
        state.log.push(ev.message);
      }
      renderLog();
    } else if (data.type === 'PLAYER_SYNC') {
      state.player = data.player;
      state.inventory = data.inventory;
      updatePlayerUI();
    }
  };

  state.worker.postMessage({ type: 'INIT', sab });

  // Initial Biome DAG rendering
  renderBiomeTreePanel(biomePanel, (part: HarvestablePart) => {
    state.log.push(`Harvested ${part.name} (${part.description})`);
    renderLog();
  });

  // Settings & Compendium Modal
  initMenuAndSettings({
    onNewGame: () => {
      $('reset').click();
    },
    onExportSave: async (): Promise<SerializedWorldSave> => {
      return {
        version: 1,
        timestamp: Date.now(),
        tick: state.snapshot ? state.snapshot.tick : 0,
        day: 1,
        ambientTempK: 288.15,
        player: {
          glucoseKcal: state.player.glucoseKcal,
          adiposeKcal: state.player.adiposeKcal,
          hydrationPct: state.player.hydrationPct,
          coreTempK: 310.15,
          clothingIclo: state.player.clothingIclo,
        },
        inventory: state.inventory,
        vessels: state.vessels,
      };
    },
    onImportSave: (save: SerializedWorldSave) => {
      state.log.push(`Imported game save from Day ${save.day}, Tick ${save.tick}`);
      renderLog();
    },
  });

  switchTab('REACTIONS');
  updatePlayerUI();
}

function createSeedVessels(): void {
  if (!state.worker) return;
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
    state.ever = {
      ash: false,
      lye: false,
      fat: false,
      soap: false,
      barSoap: false,
      backpack: false,
      bronzeFork: false,
      medicine: false,
      voltaicPile: false,
    };
    startWorld();
  });
}

startWorld();
bindActions();
renderVessels();
renderLog();
requestAnimationFrame(frame);
