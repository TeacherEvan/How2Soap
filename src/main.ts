/**
 * How2Soap — entry point & orchestration only.
 * Views live in src/app/views.ts, panels in src/app/panels.ts, worker dispatch
 * in src/app/workerMessages.ts. Keep this file lean: wire-ups, actions, boot.
 */
import './styles.css';
import { SAB_BYTE_LENGTH, SharedWorldView, TELEMETRY } from './engine/memoryLayout';
import { SPECIES } from './data/speciesRegistry';
import { StrategyMapCanvas } from './ui/StrategyMapCanvas';
import { initMenuAndSettings } from './ui/MenuController';
import type { SerializedWorldSave } from './engine/persistence';
import { showToast } from './ui/Toast';
import { StoryMode } from './ui/StoryMode';
import { CHAPTERS } from './data/story';
import { globalOverlayStack } from './ui/overlayStack';
import { audio } from './ui/audio';
import { migrateSave } from './engine/persistence';
import { predictEquilibriumTempK } from './engine/chemistry';
import { simulateWatchForecast } from './engine/telegraph';
import { levelFromRenown, initialProgression } from './engine/progression';
import { state, send, selectedIndex, formatClock } from './app/state';
import {
  $,
  isoBadge,
  clock,
  pauseButton,
  targetSelect,
  tabStrategy,
  tabReactions,
} from './app/dom';
import { renderLog, renderVessels, renderQuest, renderWorkbench } from './app/views';
import { switchTab, updatePlayerUI, renderBiomeExplorerTree } from './app/panels';
import { AUTO_SAVE_KEY, buildSaveSnapshot, bindAutoSaveOnHide } from './app/autosave';
import { launchSplash } from './app/splash';
import { handleWorkerMessage, type WorkerMessage } from './app/workerMessages';

// Unlock Web Audio context on user gesture
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });

// Global ESC listener for overlay and modal management
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    globalOverlayStack.closeTop();
  }
});

// Offline-first: register the service worker only in production builds.
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal: game remains fully playable online.
    });
  });
}

launchSplash();

let lastRenderedTick = -1;

function frame(): void {
  if (state.view) {
    try {
      const snapshot = state.view.readSnapshot(32);
      if (snapshot) {
        state.snapshot = snapshot;
        clock.textContent = formatClock(snapshot);
        if (snapshot.tick !== lastRenderedTick) {
          lastRenderedTick = snapshot.tick;
          if (state.activeTab === 'REACTIONS') {
            renderWorkbench(snapshot);
          }
          renderQuest(snapshot);
        }
      }
    } catch {
      // Retain last consistent snapshot on transient contention
    }
  }
  requestAnimationFrame(frame);
}

function startWorld(options?: { load?: SerializedWorldSave }): void {
  if (state.worker) {
    state.worker.terminate();
    state.worker = null;
  }

  const isIsolated = window.crossOriginIsolated;
  isoBadge.textContent = isIsolated ? 'Isolated (SAB active)' : 'Fallback (simulated SAB)';
  isoBadge.classList.toggle('good', isIsolated);
  isoBadge.classList.toggle('warn', !isIsolated);

  const sab = new SharedArrayBuffer(SAB_BYTE_LENGTH);
  state.view = new SharedWorldView(sab);

  state.worker = new Worker(new URL('./engine/sim.worker.ts', import.meta.url));
  state.worker.onmessage = (event: MessageEvent<WorkerMessage>) =>
    handleWorkerMessage(event.data, options);

  if (options?.load) {
    state.worker.postMessage({ type: 'LOAD_WORLD', sab, save: options.load });
  } else {
    state.worker.postMessage({ type: 'INIT', sab });
  }

  // Initial Biome DAG rendering
  renderBiomeExplorerTree();

  // Settings & Compendium Modal
  initMenuAndSettings({
    onNewGame: () => {
      $('reset').click();
    },
    onExportSave: async (): Promise<SerializedWorldSave> => {
      return buildSaveSnapshot();
    },
    onImportSave: (save: SerializedWorldSave) => {
      const migrated = migrateSave(save);
      state.progression.renown = migrated.renown ?? 0;
      state.progression.chapter = migrated.chapter ?? 0;
      state.progression.fabricatedRecipes = migrated.fabricatedRecipes ?? [];
      state.progression.objectivesDone = migrated.objectivesDone ?? [];
      state.progression.lettersDone = migrated.lettersDone ?? [];
      state.progression.affinity = migrated.affinity ?? state.progression.affinity;
      state.progression.ever = migrated.ever ?? {};

      startWorld({ load: migrated });
      showToast(`Save restored — Day ${migrated.day ?? 1}`, 'success');
      state.log.push(`Imported game save from Day ${migrated.day}, Tick ${migrated.tick}`);
      renderLog();
    },
  });

  // Instantiate Strategy Map Canvas & Labor Command Dock
  if (state.strategyMap) {
    state.strategyMap.destroy();
    state.strategyMap = null;
  }
  if (!state.bench3d && tabReactions) {
    import('./ui/gl/LabBench3DCanvas').then(({ LabBench3DCanvas }) => {
      state.bench3d = new LabBench3DCanvas(tabReactions, {
        onSelectVessel: (vesselId) => {
          const idx = state.vessels.findIndex((v) => v.id === vesselId);
          if (idx !== -1) {
            state.selected = idx;
            renderVessels();
          }
        },
      });
    });
  }
  state.strategyMap = new StrategyMapCanvas(tabStrategy, {
    onRecruit: (recruit) => {
      audio.recruitHorn();
      send({
        type: 'RECRUIT_COLONIST',
        name: recruit.name,
        archetype: recruit.archetype,
        wageContract: recruit.wageContract,
      });
      state.log.push(`Recruited ${recruit.name} (${recruit.archetype})`);
      renderLog();
    },
    onAssignJob: (colonistId, speciesId, partId) => {
      audio.harvestThud();
      send({
        type: 'ASSIGN_COLONIST_JOB',
        colonistId,
        speciesId,
        partId,
      });
      state.log.push(`Assigned colonist ${colonistId} to ${speciesId}`);
      renderLog();
    },
    onAdministerStimulant: (colonistId, stimulantId) => {
      audio.stimulantShimmer();
      send({
        type: 'ADMINISTER_STIMULANT',
        colonistId,
        stimulantId,
      });
      state.log.push(`Administered ${stimulantId} to ${colonistId}`);
      renderLog();
    },
    onSetWageContract: (colonistId, wageContract) => {
      audio.wageClink();
      send({
        type: 'SET_WAGE_CONTRACT',
        colonistId,
        wageContract,
      });
      state.log.push(`Updated wage contract for ${colonistId} to ${wageContract.commodity}`);
      renderLog();
    },
  });

  // Instantiate 3-Tier Tutorial & Compendium Academy Controller
  import('./ui/TutorialController').then(({ TutorialController: TC }) => {
    state.tutorial = new TC({
      onDispatchWorkerCommand: (cmd) => send(cmd),
      onSwitchTab: (tabKey) => {
        if (tabKey === 'workbench') switchTab('REACTIONS');
        else if (tabKey === 'strategy') switchTab('STRATEGY');
        else if (tabKey === 'council') switchTab('JOURNAL');
      },
    });
    state.tutorial.updateCoachmark();
  });

  switchTab('REACTIONS');
  updatePlayerUI();
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

  const heaterSlider = $<HTMLInputElement>('heater-slider');
  const valHeaterW = $('val-heater-w');
  const heaterTeqPreview = $('heater-teq-preview');
  if (heaterSlider) {
    heaterSlider.addEventListener('input', () => {
      const vessel = state.vessels[selectedIndex()];
      if (!vessel) return;
      const watts = Number(heaterSlider.value);
      if (valHeaterW) valHeaterW.textContent = String(watts);
      const ambK = state.player.ambientTempK ?? 288.15;
      const estTeq = Math.round(predictEquilibriumTempK(vessel.material as any, watts, ambK));
      if (heaterTeqPreview) heaterTeqPreview.textContent = `(Eq: ~${estTeq} K)`;
      send({ type: 'SET_HEATER', vesselId: vessel.id, watts });
    });
  }

  const voltsSlider = $<HTMLInputElement>('volts-slider');
  const valVolts = $('val-volts');
  if (voltsSlider) {
    voltsSlider.addEventListener('input', () => {
      const vessel = state.vessels[selectedIndex()];
      if (!vessel) return;
      const volts = Number(voltsSlider.value);
      if (valVolts) valVolts.textContent = volts.toFixed(1);
      send({ type: 'SET_VOLTS', vesselId: vessel.id, volts });
    });
  }

  const condenserTargetSelect = $<HTMLSelectElement>('condenser-target-select');
  if (condenserTargetSelect) {
    condenserTargetSelect.addEventListener('change', () => {
      const vessel = state.vessels[selectedIndex()];
      if (!vessel) return;
      // Worker expects `targetId` (see sim.worker.ts SET_CONDENSER).
      const targetId = Number(condenserTargetSelect.value);
      send({ type: 'SET_CONDENSER', vesselId: vessel.id, targetId });
    });
  }

  const btnToggleLid = $<HTMLButtonElement>('btn-toggle-lid');
  if (btnToggleLid) {
    btnToggleLid.addEventListener('click', () => {
      const vessel = state.vessels[selectedIndex()];
      if (!vessel) return;
      vessel.closed = !vessel.closed;
      btnToggleLid.textContent = vessel.closed ? 'Lid: Sealed' : 'Lid: Open';
      send({ type: 'SET_CLOSED', vesselId: vessel.id, closed: vessel.closed });
    });
  }

  pauseButton.addEventListener('click', () => {
    state.paused = !state.paused;
    send({ type: 'SET_PAUSED', paused: state.paused });
    pauseButton.textContent = state.paused ? 'Resume' : 'Pause';
  });

  const updateWatchTooltips = () => {
    const s1 = $('sleep1');
    const s8 = $('sleep8');
    if (!state.worker) return;
    const f1 = simulateWatchForecast(null, state.colony, 1);
    const f8 = simulateWatchForecast(null, state.colony, 8);
    if (s1) s1.title = `Rest 1h: est -${f1.estCaloricBurnKcal} kcal, -${f1.estHydrationLossPct}% hydration`;
    if (s8) s8.title = `Sleep 8h: est -${f8.estCaloricBurnKcal} kcal, -${f8.estHydrationLossPct}% hydration`;
  };
  $('sleep1')?.addEventListener('mouseenter', updateWatchTooltips);
  $('sleep8')?.addEventListener('mouseenter', updateWatchTooltips);
  $('sleep1').addEventListener('click', () => send({ type: 'ADVANCE', hours: 1 }));
  $('sleep8').addEventListener('click', () => send({ type: 'ADVANCE', hours: 8 }));
  $('reset').addEventListener('click', () => {
    state.deathModalShown = false;
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
  window.addEventListener('resize', () => {
    if (state.activeTab === 'STRATEGY') {
      state.strategyMap?.resizeCanvas();
    }
  });
  requestAnimationFrame(frame);

  const existingSave = localStorage.getItem(AUTO_SAVE_KEY);
  if (existingSave) {
    try {
      const raw = JSON.parse(existingSave);
      const parsed = migrateSave(raw);
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
            state.progression.renown = parsed.renown ?? 0;
            state.progression.chapter = parsed.chapter ?? 0;
            state.progression.fabricatedRecipes = parsed.fabricatedRecipes ?? [];
            state.progression.objectivesDone = parsed.objectivesDone ?? [];
            state.progression.lettersDone = parsed.lettersDone ?? [];
            state.progression.affinity = parsed.affinity ?? state.progression.affinity;
            state.progression.ever = parsed.ever ?? {};

            startWorld({ load: parsed });
          },
          onNewWorld: () => {
            localStorage.removeItem(AUTO_SAVE_KEY);
            state.progression = initialProgression();
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

bindAutoSaveOnHide();
bootFlow();
