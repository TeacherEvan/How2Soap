/**
 * How2Soap — entry point & orchestration only.
 * Views live in src/app/views.ts, panels in src/app/panels.ts, worker dispatch
 * in src/app/workerMessages.ts. Keep this file lean: wire-ups, actions, boot.
 */
import './styles.css';
import './ui/council/council.css';
import { SAB_BYTE_LENGTH, SharedWorldView } from './engine/memoryLayout';
// StrategyMapCanvas loaded dynamically to preserve < 200,000 byte entrypoint budget
import type { SerializedWorldSave } from './engine/persistence';
import { showToast } from './ui/Toast';
import { StoryMode } from './ui/StoryMode';
import { CHAPTERS } from './data/story';
import { globalOverlayStack } from './ui/overlayStack';
import { audio } from './ui/audio';
import { migrateSave } from './engine/persistence';
import { levelFromRenown, initialProgression } from './engine/progression';
import { state, send, formatClock, pushLog } from './app/state';
import {
  isoBadge,
  clock,
  endTurnButton,
  skipTurnsButton,
  dawnReportButton,
  tabStrategy,
} from './app/dom';
import { renderLog, renderQuest, renderReactionsSummary } from './app/views';
import { updatePlayerUI, renderBiomeExplorerTree } from './app/panels';
import { AUTO_SAVE_KEY, buildSaveSnapshot, bindAutoSaveOnHide } from './app/autosave';
import { launchSplash } from './app/splash';
import { handleWorkerMessage, type WorkerMessage } from './app/workerMessages';
import { WindowManager } from './ui/WindowManager';
import { initLauncher, openWindowById } from './app/launcher';
import { Council } from './ui/council/Council';

// Global Council instance
export let councilInstance: Council | null = null;

// Unlock Web Audio context on user gesture & start generative score
document.addEventListener(
  'pointerdown',
  () => {
    audio.unlock();
    import('./ui/score').then(({ score }) => {
      score.start();
    });
  },
  { once: true },
);

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
        const clkText = formatClock(snapshot);
        clock.textContent = clkText;
        const turnCaption = document.getElementById('turn-caption');
        if (turnCaption) {
          turnCaption.textContent = clkText;
        }

        if (snapshot.tick !== lastRenderedTick) {
          lastRenderedTick = snapshot.tick;
          WindowManager.broadcastSnapshot(snapshot);
          if (state.activeTab === 'REACTIONS') {
            renderReactionsSummary(snapshot);
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

  const isIsolated = window.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined';
  isoBadge.textContent = isIsolated ? 'Isolated (SAB active)' : 'Unisolated (COOP/COEP required)';
  isoBadge.classList.toggle('good', isIsolated);
  isoBadge.classList.toggle('warn', !isIsolated);

  let sab: SharedArrayBuffer | null = null;
  if (isIsolated) {
    sab = new SharedArrayBuffer(SAB_BYTE_LENGTH);
    state.view = new SharedWorldView(sab);
  } else {
    state.view = null;
  }

  state.worker = new Worker(new URL('./engine/sim.worker.ts', import.meta.url));
  state.worker.onerror = (err) => {
    showToast(`Worker Fatal Error: ${err.message || 'Worker failure'}`, 'failure');
  };
  state.worker.onmessageerror = () => {
    showToast('Worker serialization error encountered.', 'failure');
  };
  state.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    if (event.data?.type === 'LOAD_ERROR') {
      showToast(
        `Save could not be loaded: ${(event.data as any).message}. Starting a new world.`,
        'failure',
      );
      localStorage.removeItem(AUTO_SAVE_KEY);
      localStorage.removeItem('how2soap.save.v2');
      startWorld();
      return;
    }
    handleWorkerMessage(event.data, options);
  };

  if (options?.load) {
    state.worker.postMessage({ type: 'LOAD_WORLD', sab, save: options.load });
  } else {
    state.worker.postMessage({ type: 'INIT', sab, featureFlags: state.featureFlags });
  }

  renderBiomeExplorerTree();

  import('./ui/MenuController').then(({ initMenuAndSettings }) => {
    initMenuAndSettings({
      onNewGame: () => {
        document.getElementById('reset')?.click();
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
        pushLog(`Imported game save from Day ${migrated.day}, Tick ${migrated.tick}`);
        renderLog();
      },
    });
  });

  // Instantiate Strategy Map Canvas in World Viewport
  if (state.strategyMap) {
    state.strategyMap.destroy();
    state.strategyMap = null;
  }
  import('./ui/StrategyMapCanvas').then(({ StrategyMapCanvas }) => {
    state.strategyMap = new StrategyMapCanvas(tabStrategy, {
      onRecruit: (recruit) => {
        audio.recruitHorn();
        send({
          type: 'RECRUIT_COLONIST',
          name: recruit.name,
          archetype: recruit.archetype,
          wageContract: recruit.wageContract,
        });
        pushLog(`Recruited ${recruit.name} (${recruit.archetype})`);
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
        pushLog(`Assigned colonist ${colonistId} to ${speciesId}`);
        renderLog();
      },
      onAdministerStimulant: (colonistId, stimulantId) => {
        audio.stimulantShimmer();
        send({
          type: 'ADMINISTER_STIMULANT',
          colonistId,
          stimulantId,
        });
        pushLog(`Administered ${stimulantId} to ${colonistId}`);
        renderLog();
      },
      onSetWageContract: (colonistId, wageContract) => {
        audio.wageClink();
        send({
          type: 'SET_WAGE_CONTRACT',
          colonistId,
          wageContract,
        });
        pushLog(`Updated wage contract for ${colonistId} to ${wageContract.commodity}`);
        renderLog();
      },
    });
  });

  // Tutorial
  if (state.tutorial) {
    state.tutorial.destroy();
    state.tutorial = null;
  }
  import('./ui/TutorialController').then(({ TutorialController: TC }) => {
    state.tutorial = new TC({
      onDispatchWorkerCommand: (cmd) => send(cmd),
      onSwitchTab: () => {},
    });
    if (options?.load?.tutorial) {
      state.tutorial.restore(options.load.tutorial);
    }
    state.tutorial.updateCoachmark();
  });

  state.activeTab = 'STRATEGY';
  updatePlayerUI();
}

function bindActions(): void {
  const triggerEndTurn = (hours = 24) => {
    send({ type: 'ADVANCE', hours });
  };

  if (endTurnButton) {
    endTurnButton.addEventListener('click', () => triggerEndTurn(24));
  }
  if (skipTurnsButton) {
    skipTurnsButton.addEventListener('click', () => triggerEndTurn(24 * 8));
  }
  if (dawnReportButton) {
    dawnReportButton.addEventListener('click', () => {
      void import('./engine/telegraph').then(({ simulateWatchForecast }) => {
        const f = simulateWatchForecast(null, state.colony, 24);
        import('./ui/TurnRecapModal').then(({ openTurnRecapModal }) => {
          openTurnRecapModal({
            turn: state.player.day ?? 1,
            events: [{ vesselId: -1, message: `Dawn Forecast: est -${f.estCaloricBurnKcal} kcal, -${f.estHydrationLossPct}% hydration.` }],
            benchLedger: (state.experiments?.experiments ?? []).map((e) => ({ label: e.recipeName || e.recipeId, turnsLeft: e.turnsLeft, done: e.turnsLeft <= 0 })),
          });
        });
      });
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target as HTMLElement).closest('input, select, textarea, [contenteditable="true"], [role="button"], button')) return;
    if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      triggerEndTurn(24);
    }
  });

  const mandateChip = document.getElementById('hud-mandate');
  if (mandateChip) {
    mandateChip.addEventListener('click', () => {
      void openWindowById('realm');
    });
  }

  // Top-Left New World button
  const resetBtn = document.getElementById('reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Start a new world? All unsaved progress will be cleared.')) {
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
      }
    });
  }

  // Top-Right Council Menu FAB
  const councilMenuBtn = document.getElementById('btn-council-menu');
  if (councilMenuBtn) {
    councilMenuBtn.addEventListener('click', () => {
      councilInstance?.toggle();
    });
  }
}

function bootFlow(): void {
  councilInstance = new Council();
  bindActions();
  window.addEventListener('resize', () => {
    state.strategyMap?.resizeCanvas();
  });
  requestAnimationFrame(frame);

  const existingSave = localStorage.getItem(AUTO_SAVE_KEY) || localStorage.getItem('how2soap.save.v2');
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
            localStorage.removeItem('how2soap.save.v2');
            state.progression = initialProgression();
            import('./ui/FirstCommissionOverlay').then(({ openCountrySelectOverlay, openMudPortOpener }) => {
              openCountrySelectOverlay((country) => {
                openMudPortOpener(country, () => {
                  StoryMode.prologue(() => {
                    startWorld();
                  });
                });
              });
            });
          },
        },
      );
      return;
    } catch {
      // parse failed, proceed fresh
    }
  }

  import('./ui/FirstCommissionOverlay').then(({ openCountrySelectOverlay, openMudPortOpener }) => {
    openCountrySelectOverlay((country) => {
      openMudPortOpener(country, () => {
        StoryMode.prologue(() => {
          startWorld();
        });
      });
    });
  });
}

initLauncher();
// QA deep-link: ?window=reactions|fabrication|paddocks|biome opens that window after boot.
const deepLinkWindow = new URLSearchParams(window.location.search).get('window');
if (deepLinkWindow) {
  window.setTimeout(() => {
    void openWindowById(deepLinkWindow);
  }, 1200);
}

bindAutoSaveOnHide();
bootFlow();
