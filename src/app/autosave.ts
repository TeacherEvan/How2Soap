/**
 * Autosave: debounced snapshot writer + flush on tab hide.
 */
import { MAX_SPECIES } from '../engine/memoryLayout';
import { snapshotSignature } from '../engine/saveSignature';
import type { SerializedWorldSave } from '../engine/persistence';
import { state } from './state';

export const AUTO_SAVE_KEY = 'how2soap.save.v3';

let lastSaveSignature = '';
let autoSaveTimer: number | null = null;

export function buildSaveSnapshot(): SerializedWorldSave {
  const rngSeed = state.rngSeed || ((Math.random() * 0xffffffff) >>> 0);
  return {
    version: 3,
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
      dead: !!state.player.conditions?.dead,
      woundOnsetSeconds: 0,
      sepsisOnsetSeconds: 0,
    },
    inventory: state.inventory,
    vessels: state.vessels.map((v, i) => {
      let moles: number[] = [];
      if (state.snapshot && state.snapshot.moles) {
        moles = Array.from(state.snapshot.moles.slice(i * MAX_SPECIES, (i + 1) * MAX_SPECIES));
      }
      return {
        id: v.id,
        material: v.material,
        capacityL: v.capacityL,
        closed: v.closed,
        label: v.label,
        moles,
        precipitated: [], // precipitated cloudiness resets on Continue; harmlessly re-settles
      };
    }),
    ever: state.progression.ever ?? {},
    renown: state.progression.renown ?? 0,
    affinity: state.progression.affinity ?? { apothecary: 0, soapwright: 0, forgewright: 0 },
    chapter: state.progression.chapter ?? 0,
    fabricatedRecipes: state.progression.fabricatedRecipes ?? [],
    objectivesDone: state.progression.objectivesDone ?? [],
    lettersDone: state.progression.lettersDone ?? [],
    epilogueSeen: false,
    colony: state.colony ? {
      colonists: state.colony.colonists ?? [],
      ledger: state.colony.ledger ?? [],
      desirePathGrid: Array.from(state.colony.desirePathGrid ?? []),
      nextColonistId: state.colony.nextColonistId ?? 1,
      lastDecayTick: state.colony.lastDecayTick,
    } : undefined,
    paddock: state.paddock,
    timedRequests: state.timedRequests,
    experiments: state.experiments ?? undefined,
    realm: state.realm ?? undefined,
    patron: state.patron ?? undefined,
    ageProgress: state.ageProgress ?? undefined,
    settlements: state.settlements ?? undefined,
    blacksmith: state.blacksmith ?? undefined,
  };
}

export function requestAutoSave(): void {
  const currentSig = snapshotSignature({
    tick: state.snapshot?.tick ?? 0,
    glucose: state.player?.glucoseKcal ?? 0,
    seed: 0,
    day: state.player?.day ?? 1,
  });

  if (currentSig === lastSaveSignature) return;

  if (autoSaveTimer !== null) {
    window.clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = window.setTimeout(() => {
    try {
      const snap = buildSaveSnapshot();
      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(snap));
      lastSaveSignature = currentSig;
    } catch {
      // Storage quota or private browsing limitation
    }
  }, 2000);
}

/** Flush a save immediately when the tab is hidden (PWA/Alt-Tab survival). */
export function bindAutoSaveOnHide(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      try {
        const snap = buildSaveSnapshot();
        localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(snap));
      } catch {
        // Storage unavailable — non-fatal
      }
    }
  });
}
