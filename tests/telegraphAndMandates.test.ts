import { describe, it, expect } from 'vitest';
import { simulateWatchForecast } from '../src/engine/telegraph';
import { createInitialMandates, stepTimeline, type TimelineState } from '../src/engine/mandates';
import { createWorld, createWorldVessel } from '../src/engine/world';

describe('Watch Telegraphing & Mandates Engine', () => {
  it('forecasts caloric burn and hydration loss for given hours', () => {
    const forecast = simulateWatchForecast(null, null, 8);
    expect(forecast.hours).toBe(8);
    expect(forecast.ticks).toBe(80);
    expect(forecast.estCaloricBurnKcal).toBeGreaterThanOrEqual(500);
    expect(forecast.estHydrationLossPct).toBeGreaterThanOrEqual(10);
  });

  it('detects boiling risk when a vessel is heated', () => {
    const world = createWorld(288.15);
    const vessel = createWorldVessel(world, 1, 'WOOD', 5, false);
    vessel.heaterWatts = 400;
    vessel.temperatureK = 360;

    const forecast = simulateWatchForecast(world, null, 1);
    expect(forecast.vesselWarnings.length).toBeGreaterThan(0);
    expect(forecast.vesselWarnings[0].message).toContain('Boiling');
  });

  it('steps crisis timeline and decrements remaining mandate hours', () => {
    const mandates = createInitialMandates();
    const state: TimelineState = {
      currentDay: 1,
      currentHour: 0,
      hoursUntilPayroll: 24,
      activeMandates: mandates,
    };

    stepTimeline(state, 6);
    expect(state.hoursUntilPayroll).toBe(18);
    expect(state.activeMandates[0].remainingHours).toBe(42);
  });
});
