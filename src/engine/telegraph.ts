/**
 * Watch Forecast & Telegraphing Engine ("Into the Breach" tactical determinism)
 * Simulates a dry-run advance of 1, 10, or 80 ticks to forecast:
 * - Vessel temperature shifts and boilover/rupture risks
 * - Caloric & hydration depletion
 * - Payroll deficit & worker strike countdowns
 */

import { type WorldState } from './world';
import { type ColonyState } from './colony';

export interface WatchForecast {
  hours: number;
  ticks: number;
  estCaloricBurnKcal: number;
  estHydrationLossPct: number;
  strikeRisk: boolean;
  projectedStrikes: string[];
  vesselWarnings: Array<{ vesselId: number; message: string; severity: 'info' | 'warn' | 'danger' }>;
}

export function simulateWatchForecast(
  world: WorldState | null,
  colony: ColonyState | null,
  hours: number,
): WatchForecast {
  const ticks = Math.round(hours * 10);
  const estCaloricBurnKcal = Math.round(hours * 75); // ~75 kcal/hour resting basal rate
  const estHydrationLossPct = Number((hours * 1.8).toFixed(1)); // ~1.8%/hour

  const vesselWarnings: Array<{ vesselId: number; message: string; severity: 'info' | 'warn' | 'danger' }> = [];
  let strikeRisk = false;
  const projectedStrikes: string[] = [];

  if (world) {
    for (const vessel of world.vessels) {
      if (vessel.heaterWatts > 0) {
        // Simple thermal extrapolation
        const estTemp = vessel.temperatureK + (vessel.heaterWatts / 500) * Math.min(hours * 20, 80);
        if (estTemp >= 373.15) {
          vesselWarnings.push({
            vesselId: vessel.id,
            message: `Boiling risk: Temperature will reach ~${Math.round(estTemp)} K`,
            severity: 'warn',
          });
        }
        if (vessel.headspaceClosed && estTemp > 380) {
          vesselWarnings.push({
            vesselId: vessel.id,
            message: `Pressure hazard: Sealed vessel will exceed burst safety threshold!`,
            severity: 'danger',
          });
        }
      }
    }
  }

  if (colony) {
    for (const c of colony.colonists) {
      if (c.morale < 30 || c.status === 'STRIKE') {
        strikeRisk = true;
        projectedStrikes.push(c.name);
      }
    }
  }

  return {
    hours,
    ticks,
    estCaloricBurnKcal,
    estHydrationLossPct,
    strikeRisk,
    projectedStrikes,
    vesselWarnings,
  };
}
