/**
 * Pure thermodynamic calculation for Tier III PhD Telemetry Mode
 */
import type { WorldSnapshot } from './memoryLayout';

export interface PhdTelemetryData {
  tempK: number;
  ph: number;
  sidMolL: number;
  arrheniusRateK: number;
  newtonCoolingWatts: number;
}

export function computeVesselPhdTelemetry(
  vesselIndex: number,
  snapshot: WorldSnapshot,
): PhdTelemetryData {
  if (!snapshot || !snapshot.telemetry) {
    return {
      tempK: 288.15,
      ph: 7.0,
      sidMolL: 0,
      arrheniusRateK: 0,
      newtonCoolingWatts: 0,
    };
  }

  const tBase = vesselIndex * 8;
  const rawTemp = snapshot.telemetry[tBase + 0];
  const tempK = typeof rawTemp === 'number' && Number.isFinite(rawTemp) ? rawTemp : 288.15;
  const rawPh = snapshot.telemetry[tBase + 1];
  const ph = typeof rawPh === 'number' && Number.isFinite(rawPh) ? Math.min(14, Math.max(0, rawPh)) : 7.0;

  // SID estimate from pH quadratic relation: [H+] = 10^(-pH)
  const hConc = Math.pow(10, -ph);
  const kw = 1e-14;
  const ohConc = kw / Math.max(1e-15, hConc);
  const sidMolL = ohConc - hConc;

  // Arrhenius rate constant for saponification: k(T) = A * exp(-Ea / RT)
  // At tempK <= 0, reaction rate is 0.
  const R = 8.314;
  const Ea = 48000;
  const A = 1.2e7;
  const arrheniusRateK = tempK <= 0 ? 0 : A * Math.exp(-Ea / (R * tempK));

  // Newton cooling loss Q = U * A * (T - T_amb)
  const U_A = 12.5; // W/K
  const ambientK = 288.15;
  const newtonCoolingWatts = Math.max(0, U_A * (tempK - ambientK));

  return {
    tempK,
    ph,
    sidMolL,
    arrheniusRateK,
    newtonCoolingWatts,
  };
}
