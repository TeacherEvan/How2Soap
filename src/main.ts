import './styles.css';
import splashMp4 from './media/how2soap-intro.mp4';
import splashWebm from './media/how2soap-intro.webm';
import splashPoster from './media/how2soap-poster.png';
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
import { calculateHarvestTotalCostKcal } from './data/biomeNodes';
import type { SerializedWorldSave } from './engine/persistence';
import { showToast } from './ui/Toast';
import { mountJournal } from './ui/JournalPanel';
import { StoryMode } from './ui/StoryMode';
import { bannerModel, treatmentModel } from './ui/panelModels';
import {
  initialProgression,
  applyProgressEventsWithSensor,
  levelFromRenown,
} from './engine/progression';
import { CHAPTERS } from './data/story';
import { globalOverlayStack } from './ui/overlayStack';

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
    day: 1,
    ambientTempK: 288.15,
    conditions: { fever: false, systemicInfection: false, woundContamination: false, dead: false },
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
  items: [] as Array<{ id: string; count: number; massKg: number }>,
  progression: initialProgression(),
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app missing');

/**
 * Launch the intro splash on every startup. The world boots underneath it;
 * any click, keypress, or the video ending fades it out. Audio autoplay is
 * attempted and falls back to a muted play (browser autoplay policies).
 * Users who prefer reduced motion skip the splash entirely.
 */
function launchSplash(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const overlay = document.createElement('div');
  overlay.className = 'splash-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const video = document.createElement('video');
  video.className = 'splash-video';
  video.autoplay = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.poster = splashPoster;

  const mp4Source = document.createElement('source');
  mp4Source.src = splashMp4;
  mp4Source.type = 'video/mp4';
  const webmSource = document.createElement('source');
  webmSource.src = splashWebm;
  webmSource.type = 'video/webm';
  video.append(mp4Source, webmSource);

  const hint = document.createElement('div');
  hint.className = 'splash-hint';
  hint.textContent = 'Click anywhere to skip';

  overlay.append(video, hint);
  document.body.appendChild(overlay);

  let dismissed = false;
  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    document.removeEventListener('keydown', dismiss);
    overlay.classList.add('splash-fade');
    window.setTimeout(() => overlay.remove(), 650);
  };

  overlay.addEventListener('click', dismiss);
  video.addEventListener('ended', dismiss);
  document.addEventListener('keydown', dismiss);

  video.play().catch(() => {
    // Autoplay with audio blocked: retry muted rather than dropping the splash.
    video.muted = true;
    video.play().catch(() => dismiss());
  });
}

// Global ESC listener for overlay and modal management
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    globalOverlayStack.closeTop();
  }
});

launchSplash();

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
        <div class="hud-chip" id="hud-adipose" title="Adipose reserves — your famine buffer">Adipose <b id="val-adipose">15,000 kcal</b></div>
        <div class="hud-chip" id="hud-hydration" title="Hydration">Hydration <b id="val-hydration">100%</b></div>
        <div class="hud-chip" id="hud-ambient" title="Ambient temperature">Amb <b id="val-ambient">288 K</b></div>
        <div class="hud-chip" id="hud-renown" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" title="Renown progress">
          <span id="val-renown-title">L1 · Scrub Apprentice</span>
          <svg class="renown-ring" viewBox="0 0 36 36"><circle class="ring-bg" cx="18" cy="18" r="15.5"/><circle class="ring-fg" id="ring-renown-fg" cx="18" cy="18" r="15.5"/></svg>
        </div>
      </div>
      <div class="controls">
        <button id="pause" class="ghost">Pause</button>
        <button id="sleep1" class="ghost">Sleep 1 h</button>
        <button id="sleep8" class="ghost">Sleep 8 h</button>
        <button id="reset" class="ghost danger">New world</button>
      </div>
    </header>

    <div class="banners" id="banners" aria-live="polite"></div>

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

        <!-- Tab 4: Journal & Missions -->
        <div id="tab-journal-content" class="tab-pane hidden"></div>

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

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as unknown as T;
};

const isoBadge = $('isolation');
const clock = $('clock');
const pGlucose = $('p-glucose');
const pTemp = $('p-temp');
const pIclo = $('p-iclo');
const valAdipose = $('val-adipose');
const valHydration = $('val-hydration');
const valAmbient = $('val-ambient');
const valRenownTitle = $('val-renown-title');
const ringRenownFg = document.getElementById('ring-renown-fg') as SVGCircleElement | null;
const bannersRow = $('banners');
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
const tabJournal = $('tab-journal-content');

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
  tabJournal.classList.toggle('hidden', tab !== 'JOURNAL');

  if (tab === 'FABRICATION') {
    renderFabricationTab(tabFabrication, (recipeId) => {
      send({ type: 'FABRICATE', recipeId });
      state.log.push(`Fabricated recipe ${recipeId}`);
      renderLog();
    });
  } else if (tab === 'PADDOCKS') {
    updatePaddockUI();
  } else if (tab === 'JOURNAL') {
    mountJournal(tabJournal, state.progression);
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

  if (valAdipose) valAdipose.textContent = `${Math.round(state.player.adiposeKcal).toLocaleString()} kcal`;
  if (valHydration) valHydration.textContent = `${Math.round(state.player.hydrationPct)}%`;
  if (valAmbient) valAmbient.textContent = `${Math.round(state.player.ambientTempK)} K`;

  const renownInfo = levelFromRenown(state.progression.renown);
  if (valRenownTitle) valRenownTitle.textContent = `L${renownInfo.level} · ${renownInfo.title}`;
  if (ringRenownFg) {
    const circumference = 2 * Math.PI * 15.5; // ≈ 97.389
    const pct = renownInfo.span > 0 ? Math.min(1, renownInfo.intoLevel / renownInfo.span) : 1;
    const offset = circumference * (1 - pct);
    ringRenownFg.style.strokeDasharray = `${circumference}`;
    ringRenownFg.style.strokeDashoffset = `${offset}`;
  }

  // Update banners
  const banners = bannerModel(state.player);
  bannersRow.innerHTML = banners
    .map(b => `<div class="banner banner-${b.severity}">${b.text}</div>`)
    .join('');

  // Active treatments
  const treatments = treatmentModel(state.items, state.player);

  renderToolAndInventoryPanel(toolInvPanel, state.inventory, {
    onCraftBackpack: () => {
      send({ type: 'FABRICATE', recipeId: 'RECIPE_STITCH_BACKPACK' });
    },
    onEatFood: (itemId) => {
      send({ type: 'EAT_FOOD', itemId });
    },
    onEquipTool: (itemId, slot) => {
      send({ type: 'EQUIP_TOOL', itemId, slot });
    },
    onAdministerTreatment: (itemId) => {
      send({ type: 'APPLY_TREATMENT', itemId });
    },
    treatments,
    isDead: state.player.conditions?.dead,
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
      | { type: 'PLAYER_SYNC'; player: any; inventory: any & { items?: Array<{ id: string; count: number; massKg: number }> } }
      | { type: 'OBJECTIVE'; kind: 'recipe' | 'eat' | 'treat' | 'harvest' | 'flag'; target: string }
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
        if (
          ev.message.startsWith('Too exhausted') ||
          ev.message.startsWith('Missing:') ||
          ev.message.startsWith('Not a food') ||
          ev.message.startsWith('Cannot treat')
        ) {
          showToast(ev.message, 'failure');
        }
      }
      renderLog();
    } else if (data.type === 'PLAYER_SYNC') {
      state.player = data.player;
      state.inventory = data.inventory;
      state.items = data.inventory.items ?? [];
      updatePlayerUI();
      if (state.player.conditions?.dead) {
        StoryMode.death('sepsis', { days: state.player.day ?? 1, renown: state.progression.renown }, () => {
          localStorage.removeItem('how2soap.save.v2');
          location.reload();
        });
      }
    } else if (data.type === 'OBJECTIVE') {
      const sensor = {
        hasSpecies: (idx: number, minMoles: number) => {
          if (!state.snapshot) return false;
          for (let v = 0; v < state.vessels.length; v++) {
            if (speciesMoles(state.snapshot, v, idx) >= minMoles) return true;
          }
          return false;
        },
        hasItem: (itemId: string, count = 1) => {
          const item = state.items.find(i => i.id === itemId);
          return (item?.count ?? 0) >= count;
        },
        hasFabricated: (id: string) => state.progression.fabricatedRecipes.includes(id),
        hasFlag: (f: string) => !!state.progression.ever[f],
        hasEaten: (id: string) => (state.progression.craftStats.eaten[id] ?? 0) > 0,
        hasTreated: (k: string) => (state.progression.craftStats.treated[k] ?? 0) > 0,
      };

      const res = applyProgressEventsWithSensor(
        state.progression,
        { kind: data.kind, target: data.target },
        sensor,
      );

      for (const objId of res.objectives) {
        showToast(`Objective completed: ${objId} (+25 Renown)`, 'success');
      }
      for (const letId of res.letters) {
        showToast(`Council letter received: ${letId}!`, 'renown');
      }
      for (const lu of res.levelUps) {
        showToast(`⭐ Advanced to Level ${lu.level}: ${lu.title}!`, 'renown');
      }
      for (const chId of res.chapters) {
        const completedCh = CHAPTERS.find(c => c.id === chId);
        if (completedCh) {
          StoryMode.chapterComplete(completedCh, () => {
            if (state.progression.chapter >= CHAPTERS.length) {
              StoryMode.victory(
                {
                  days: state.player.day ?? 1,
                  fabricated: state.progression.fabricatedRecipes.length,
                  renown: state.progression.renown,
                  levelTitle: levelFromRenown(state.progression.renown).title,
                },
                'You stand upon the heights of discovery, master of fire and flesh.',
                {
                  onFreeCraft: () => {},
                  onNewWorld: () => {
                    localStorage.removeItem('how2soap.save.v2');
                    location.reload();
                  },
                },
              );
            }
          });
        }
      }

      if (state.activeTab === 'JOURNAL') {
        mountJournal(tabJournal, state.progression);
      }
    }
  };

  state.worker.postMessage({ type: 'INIT', sab });

  // Initial Biome DAG rendering
  renderBiomeTreePanel(
    biomePanel,
    (part: HarvestablePart) => {
      send({ type: 'HARVEST_PART', partId: part.id });
      state.log.push(`Harvested ${part.name} (${part.description})`);
      renderLog();
    },
    (part, distance) => {
      const equipped = part.requiredToolSlot ? state.inventory.tools[part.requiredToolSlot] : null;
      const mohs = equipped?.mohs ?? 1.0;
      const ma = equipped ? 2.0 : 1.0;
      return calculateHarvestTotalCostKcal(
        part.baseWorkJoules,
        mohs,
        part.targetMohs,
        ma,
        distance,
        0,
      );
    },
  );

  // Settings & Compendium Modal
  initMenuAndSettings({
    onNewGame: () => {
      $('reset').click();
    },
    onExportSave: async (): Promise<SerializedWorldSave> => {
      const rngSeed = (Math.random() * 0xffffffff) >>> 0;
      return {
        version: 2,
        timestamp: Date.now(),
        tick: state.snapshot ? state.snapshot.tick : 0,
        day: state.player.day ?? 1,
        ambientTempK: state.player.ambientTempK ?? 288.15,
        rngSeed,
        player: {
          glucoseKcal: state.player.glucoseKcal,
          adiposeKcal: state.player.adiposeKcal,
          hydrationPct: state.player.hydrationPct,
          coreTempK: state.player.coreTempC ? parseFloat(state.player.coreTempC) + 273.15 : 310.15,
          clothingIclo: state.player.clothingIclo,
          conditions: state.player.conditions,
          dead: false,
          woundOnsetSeconds: 0,
          sepsisOnsetSeconds: 0,
        },
        inventory: state.inventory,
        vessels: state.vessels.map(v => ({
          id: v.id,
          material: v.material,
          capacityL: v.capacityL,
          closed: v.closed,
          label: v.label,
        })),
        ever: state.ever ?? {},
        renown: 0,
        affinity: { apothecary: 0, soapwright: 0, forgewright: 0 },
        chapter: 0,
        fabricatedRecipes: [],
        objectivesDone: [],
        lettersDone: [],
        epilogueSeen: false,
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

function bootFlow(): void {
  bindActions();
  renderVessels();
  renderLog();
  requestAnimationFrame(frame);

  const existingSave = localStorage.getItem('how2soap.save.v2');
  if (existingSave) {
    try {
      const parsed = JSON.parse(existingSave);
      const chTitle = CHAPTERS[parsed.chapter ?? 0]?.title ?? 'The First Fire';
      const lvl = levelFromRenown(parsed.renown ?? 0);
      StoryMode.bootSplash(
        {
          day: parsed.day ?? 1,
          chapterTitle: chTitle,
          renown: parsed.renown ?? 0,
          title: lvl.title,
          hasSave: true,
        },
        {
          onContinue: () => {
            startWorld();
            // load saved progression
            state.progression.renown = parsed.renown ?? 0;
            state.progression.chapter = parsed.chapter ?? 0;
            state.progression.fabricatedRecipes = parsed.fabricatedRecipes ?? [];
            state.progression.objectivesDone = parsed.objectivesDone ?? [];
            state.progression.lettersDone = parsed.lettersDone ?? [];
            state.progression.affinity = parsed.affinity ?? state.progression.affinity;
            state.progression.ever = parsed.ever ?? {};
          },
          onNewWorld: () => {
            localStorage.removeItem('how2soap.save.v2');
            StoryMode.prologue(() => {
              startWorld();
            });
          },
        },
      );
      return;
    } catch {
      // parse failed, proceed fresh
    }
  }

  StoryMode.prologue(() => {
    startWorld();
  });
}

bootFlow();
