/**
 * Autosave: debounced snapshot writer + flush on tab hide.
 */
import { MAX_SPECIES, TELEMETRY, FLAG_CLOSED, FLAG_RUPTURED } from '../engine/memoryLayout';
import { snapshotSignature } from '../engine/saveSignature';
import type { SerializedWorldSave } from '../engine/persistence';
import { state } from './state';

export const AUTO_SAVE_KEY = 'how2soap.save.v3';

let lastSaveSignature = '';
let autoSaveTimer: number | null = null;
let lastSaveWriteMs = 0;
const MIN_AUTOSAVE_INTERVAL_MS = 2000;

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
      let temperatureK = state.player.ambientTempK ?? 288.15;
      let pressureKPa = 101.325;
      let heaterWatts = 0;
      let ruptured = false;
      let headspaceClosed = v.closed;

      if (state.snapshot) {
        if (state.snapshot.moles) {
          moles = Array.from(state.snapshot.moles.slice(i * MAX_SPECIES, (i + 1) * MAX_SPECIES));
        }
        if (state.snapshot.telemetry) {
          const base = i * 8;
          const t = state.snapshot.telemetry[base + TELEMETRY.TEMP_K];
          if (Number.isFinite(t) && t > 0) temperatureK = t;

          const p = state.snapshot.telemetry[base + TELEMETRY.PRESSURE_KPA];
          if (Number.isFinite(p) && p > 0) pressureKPa = p;

          const hw = state.snapshot.telemetry[base + TELEMETRY.HEATER_W];
          if (Number.isFinite(hw) && hw >= 0) heaterWatts = hw;

          const flags = state.snapshot.telemetry[base + TELEMETRY.FLAGS];
          if (Number.isFinite(flags)) {
            const f = flags | 0;
            headspaceClosed = (f & FLAG_CLOSED) !== 0;
            ruptured = (f & FLAG_RUPTURED) !== 0;
          }
        }
      }
      return {
        id: v.id,
        material: v.material,
        capacityL: v.capacityL,
        headspaceClosed,
        closed: headspaceClosed, // Legacy compatibility
        label: v.label,
        temperatureK,
        pressureKPa,
        heaterWatts,
        condenserTargetVesselId: v.condenserTargetVesselId ?? -1,
        ruptured,
        appliedVolts: v.appliedVolts ?? 0,
        cellResistanceOhm: v.cellResistanceOhm ?? 2.0,
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
    campaign: state.influence
      ? {
          influence: state.influence,
          correspondence: state.correspondence ?? undefined,
          builtWorks: state.builtWorks ?? undefined,
          missions: state.missions ?? undefined,
          victories: state.victories ?? undefined,
        }
      : undefined,
    tutorial: state.tutorial ? state.tutorial.snapshot() : undefined,
    featureFlags: state.featureFlags ?? { colonyChemistryLink: true },
  };
}

export function requestAutoSave(): void {
  const currentSig = snapshotSignature({
    tick: state.snapshot?.tick ?? 0,
    glucose: state.player?.glucoseKcal ?? 0,
    seed: state.rngSeed ?? 0,
    day: state.player?.day ?? 1,
  });

  if (currentSig === lastSaveSignature) return;

  // Leading-edge throttle + max-wait: if an autosave timer is already armed, do NOT clear/re-arm it!
  if (autoSaveTimer !== null) return;

  const elapsed = Date.now() - lastSaveWriteMs;
  const delay = Math.max(0, MIN_AUTOSAVE_INTERVAL_MS - elapsed);

  autoSaveTimer = window.setTimeout(() => {
    autoSaveTimer = null;
    try {
      const snap = buildSaveSnapshot();
      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(snap));
      lastSaveSignature = currentSig;
      lastSaveWriteMs = Date.now();
    } catch {
      // Storage quota or private browsing limitation
    }
  }, delay);
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
