/**
 * Worker → UI message protocol. The worker runs the simulation; everything it
 * says lands here. Kept separate from startWorld so the dispatch table can be
 * read (and tested) without booting the renderer.
 */
import { applyProgressEventsWithSensor, levelFromRenown, type ObjectiveSensor } from '../engine/progression';
import { CHAPTERS } from '../data/story';
import { StoryMode } from '../ui/StoryMode';
import { showToast } from '../ui/Toast';
// JournalPanel is dynamically imported for code-splitting
import { audio } from '../ui/audio';
import { state, speciesMoles, send } from './state';
import { tabJournal } from './dom';
import { openCrisisModal, closeCrisisModal } from '../ui/CrisisModal';
import type { CrisisSeverity, CrisisId } from '../engine/crisis';
import { renderVessels, updateTargets, renderLog } from './views';
import { updatePlayerUI, updatePaddockUI } from './panels';
import { requestAutoSave, AUTO_SAVE_KEY } from './autosave';

export type WorkerMessage =
  | { type: 'READY'; rngSeed?: number }
  | { type: 'VESSELS'; vessels: typeof state.vessels }
  | { type: 'EVENTS'; events: Array<{ vesselId: number; message: string }> }
  | { type: 'PLAYER_SYNC'; player: any; inventory: any & { items?: Array<{ id: string; count: number; massKg: number }> }; paddock?: any }
  | { type: 'COLONY_SYNC'; colony: any }
  | { type: 'EXPERIMENTS_SYNC'; experiments: any }
  | { type: 'REALM_SYNC'; realm: any }
  | { type: 'SETTLEMENTS_SYNC'; settlements: any }
  | { type: 'BLACKSMITH_SYNC'; blacksmith: any }
  | { type: 'TURN_RECAP'; turn: number; events: Array<{ vesselId: number; message: string }>; benchLedger: any[] }
  | { type: 'OBJECTIVE'; kind: 'recipe' | 'eat' | 'treat' | 'harvest' | 'flag'; target: string }
  | {
      type: 'CRISIS_SYNC';
      telegraph: { crisisId: string; severity: number; watchesUntil: number } | null;
      active: {
        crisisId: string;
        title: string;
        description: string;
        severity: number;
        startedTick: number;
        choices: Array<{ id: string; label: string; detail: string; requiresOtherVessel: boolean }>;
      } | null;
    }
  | {
      type: 'REQUEST_SYNC';
      slots: any[];
    }
  | {
      type: 'SIM_ERROR';
      command?: string;
      message: string;
    }
  | {
      type: 'LEDGER_SYNC';
      ledger: any;
    };

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

export function handleWorkerMessage(data: WorkerMessage, options?: { load?: unknown }): void {
  if (data.type === 'SIM_ERROR') {
    showToast(`Simulation Error: ${data.message}`, 'failure');
    state.log.push(`SIM_ERROR: ${data.message}`);
    renderLog();
    return;
  }

  if (data.type === 'READY') {
    if (data.rngSeed !== undefined) {
      state.rngSeed = data.rngSeed;
    }
    // LOAD_WORLD also emits READY — only seed fresh worlds.
    if (!options?.load) {
      createSeedVessels();
    }
    return;
  }

  if (data.type === 'VESSELS') {
    state.vessels = data.vessels;
    renderVessels();
    updateTargets();
    return;
  }

  if (data.type === 'EVENTS') {
    for (const ev of data.events) {
      state.log.push(ev.message);
      if (ev.message.includes('strike') || ev.message.includes('Strike') || ev.message.includes('unpaid')) {
        audio.strikeBell();
      } else if (ev.message.includes('payroll') || ev.message.includes('paid') || ev.message.includes('Wage')) {
        audio.wageClink();
      }
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
    requestAutoSave();
    return;
  }

  if (data.type === 'PLAYER_SYNC') {
    state.player = data.player;
    state.inventory = data.inventory;
    state.items = data.inventory.items ?? [];
    if (data.paddock) {
      state.paddock = data.paddock;
      updatePaddockUI();
    }
    updatePlayerUI();
    requestAutoSave();
    if (state.tutorial) {
      state.tutorial.checkProgress({ state, snapshot: state.snapshot });
    }
    if ((state.player.conditions?.dead || (state.player as any).dead) && !state.deathModalShown) {
      state.deathModalShown = true;
      StoryMode.death('sepsis', { days: state.player.day ?? 1, renown: state.progression.renown }, () => {
        localStorage.removeItem(AUTO_SAVE_KEY);
        localStorage.removeItem('how2soap.save.v2');
        location.reload();
      });
    }
    return;
  }

  if (data.type === 'COLONY_SYNC') {
    state.colony = data.colony;
    const seconds = (state.snapshot?.tick ?? 0) * 360;
    const minuteOfDay = Math.floor((seconds % 86400) / 60);
    if (state.strategyMap) {
      state.strategyMap.update(data.colony, minuteOfDay);
    }
    return;
  }

  if (data.type === 'EXPERIMENTS_SYNC') {
    state.experiments = data.experiments;
    return;
  }

  if (data.type === 'REALM_SYNC') {
    state.realm = data.realm;
    updatePlayerUI();

    if (data.realm.deposal && !state.deposalModalShown) {
      state.deposalModalShown = true;
      const deposalType = data.realm.deposal;
      import('../ui/VictoryDeposalOverlay').then(({ openVictoryDeposalModal }) => {
        import('../engine/campaign/victories').then(({ createInitialVictoryState }) => {
          import('../engine/campaign/builtWorks').then(({ createInitialBuiltWorks }) => {
            const vicState = createInitialVictoryState();
            vicState.deposalOccurred = deposalType;
            openVictoryDeposalModal({
              endingType: deposalType,
              victoryState: vicState,
              realm: data.realm,
              settlements: state.settlements ?? { settlements: [], settlementLimit: 3, globalYields: { food: 0, production: 0, trade: 0, discovery: 0, renown: 0, morale: 50, influence: 0 } },
              builtWorks: createInitialBuiltWorks(),
              patronId: state.patron?.patronId ?? null,
              turn: state.player?.day ?? 1,
              onMuseumMode: () => {
                vicState.isMuseumMode = true;
              },
              onNewWorld: () => {
                localStorage.removeItem(AUTO_SAVE_KEY);
                localStorage.removeItem('how2soap.save.v2');
                location.reload();
              },
            });
          });
        });
      });
    }
    return;
  }

  if (data.type === 'SETTLEMENTS_SYNC') {
    state.settlements = data.settlements;
    return;
  }

  if (data.type === 'BLACKSMITH_SYNC') {
    state.blacksmith = data.blacksmith;
    return;
  }

  if (data.type === 'LEDGER_SYNC') {
    state.ledger = data.ledger;
    // Lazy-load JournalPanel if journal is open
    if (state.activeTab === 'JOURNAL' || document.querySelector('.journal')) {
      import('../ui/JournalPanel').then(({ mountJournal: mj }) => {
        const tabJournal = document.getElementById('tab-journal');
        if (tabJournal) mj(tabJournal, state.progression);
      });
    }
    return;
  }

  if (data.type === 'TURN_RECAP') {
    import('../ui/TurnRecapModal').then(({ openTurnRecapModal }) => {
      openTurnRecapModal({
        turn: data.turn,
        events: data.events,
        benchLedger: data.benchLedger,
      });
    });
    return;
  }

  if (data.type === 'CRISIS_SYNC') {
    const phase: 'idle' | 'telegraph' | 'active' = data.active ? 'active' : data.telegraph ? 'telegraph' : 'idle';
    state.crisis = {
      phase,
      telegraph: data.telegraph
        ? { ...data.telegraph, crisisId: data.telegraph.crisisId as CrisisId, severity: data.telegraph.severity as CrisisSeverity }
        : null,
      active: data.active
        ? { ...data.active, crisisId: data.active.crisisId as CrisisId, severity: data.active.severity as CrisisSeverity }
        : null,
    };
    updatePlayerUI();
    const active = state.crisis.active;
    if (active) {
      audio.strikeBell();
      import('../ui/score').then(({ score }) => score.setTheme('crisis'));
      openCrisisModal(active, state.vessels.length, (choiceId: string) => {
        send({ type: 'CRISIS_CHOICE', crisisId: active.crisisId, choiceId });
      });
    } else {
      import('../ui/score').then(({ score }) => score.setTheme('hearth'));
      closeCrisisModal();
    }
    return;
  }

  if (data.type === 'REQUEST_SYNC') {
    const prevSlots = (state as any).timedRequests ?? [];
    if (data.slots && prevSlots.length > 0) {
      for (const slot of data.slots) {
        if (!slot) continue;
        const isActive = slot.active ?? (slot.status === 'active');
        if (!isActive && prevSlots.some((p: any) => p && p.slot === slot.slot && (p.active ?? (p.status === 'active')))) {
          state.completedRequestsCount = (state.completedRequestsCount || 0) + 1;
        }
      }
    }
    (state as any).timedRequests = data.slots;
    updatePlayerUI();
    return;
  }

  // OBJECTIVE
  const sensor: ObjectiveSensor = {
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
    // ES-1 Tutorial sensors
    hasHarvestedSpeciesPart: () => false,
    hasCompletedSoapKettleBatch: () => false,
    hasFulfilledTimedRequest: () => false,
  };

  const res = applyProgressEventsWithSensor(
    state.progression,
    { kind: data.kind, target: data.target },
    sensor,
  );

  for (const objId of res.objectives) {
    audio.uiMetalPing();
    showToast(`Objective completed: ${objId} (+25 Renown)`, 'success');
  }
  for (const letId of res.letters) {
    audio.stamp();
    audio.uiMetalPing();
    showToast(`Council letter received: ${letId}!`, 'renown');
  }
  for (const lu of res.levelUps) {
    audio.levelUp();
    showToast(`⭐ Advanced to Level ${lu.level}: ${lu.title}!`, 'renown');
  }
  for (const chId of res.chapters) {
    const completedCh = CHAPTERS.find(c => c.id === chId);
    if (completedCh) {
      StoryMode.chapterComplete(completedCh, () => {
        if (state.progression.chapter >= CHAPTERS.length) {
          import('../ui/score').then(({ score }) => score.setTheme('victory'));
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
                localStorage.removeItem(AUTO_SAVE_KEY);
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
    import('../ui/JournalPanel').then(({ mountJournal: mj }) => {
      mj(tabJournal, state.progression);
    });
  }
}
