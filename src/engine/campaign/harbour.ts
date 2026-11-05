/**
 * Milestone M6: The Harbour, Buoyancy Assay & Quarantine Gate
 * (§6.20.3)
 *
 * Grounded physical chemistry:
 * - Archimedes assay: phase-pure density calculations.
 *   E.g. Bronze = 88 wt% Cu (8.96 g/cm3) + 12 wt% Sn (7.30 g/cm3) -> ~8.80 g/cm3.
 *   Verifies ore/alloy shipments to catch gilded fakes and gate MA bonuses.
 * - Quarantine Gate: handles foreign incoming vessels against the Wasting.
 *   Choices: ACCEPT (Trade +, GDP +, mystery risk),
 *            FUMIGATE (Soap cost, Public Health safe, moderate trade),
 *            BURN (Safety 100%, trade -, Crown grumbles).
 */

export interface ArchimedesCargo {
  cargoId: string;
  declaredMaterial: 'BRONZE' | 'COPPER' | 'SALT_BRINE' | 'TIN';
  measuredMassGrams: number;
  measuredVolumeCm3: number;
}

export interface AssayResult {
  declaredMaterial: string;
  measuredDensity: number; // g/cm3
  expectedDensity: number;
  isPure: boolean;
  notes: string;
}

// Density table (g/cm3)
export const MATERIAL_DENSITIES: Record<string, number> = {
  COPPER: 8.96,
  TIN: 7.30,
  BRONZE: 8.80, // 88% Cu, 12% Sn nominal
  SALT_BRINE: 1.20,
};

export function performArchimedesAssay(cargo: ArchimedesCargo): AssayResult {
  const measuredDensity = Number((cargo.measuredMassGrams / cargo.measuredVolumeCm3).toFixed(2));
  const expected = MATERIAL_DENSITIES[cargo.declaredMaterial] ?? 8.0;
  const tolerance = 0.15; // 0.15 g/cm3 allowable margin

  const isPure = Math.abs(measuredDensity - expected) <= tolerance;
  let notes = '';
  if (isPure) {
    notes = `Assay verified: measured ${measuredDensity} g/cm³, closely matching pure ${cargo.declaredMaterial} (${expected} g/cm³). Approved for royal minting.`;
  } else if (measuredDensity < expected) {
    notes = `Counterfeit / Slag detected: measured density ${measuredDensity} g/cm³ is significantly below expected ${expected} g/cm³ (likely adulterated with lead or porous slag).`;
  } else {
    notes = `Heavy adulterant detected: measured density ${measuredDensity} g/cm³ exceeds expected ${expected} g/cm³.`;
  }

  return {
    declaredMaterial: cargo.declaredMaterial,
    measuredDensity,
    expectedDensity: expected,
    isPure,
    notes,
  };
}

export type QuarantineAction = 'ACCEPT' | 'FUMIGATE' | 'BURN';

export interface QuarantineVessel {
  vesselId: string;
  shipName: string;
  originPort: string;
  carrierType: 'MERCHANT' | 'REFUGEE' | 'DIPLOMAT';
  suspectedFever: boolean;
  cargoValueTrade: number;
}

export interface QuarantineResolution {
  action: QuarantineAction;
  tradeDelta: number;
  publicHealthDelta: number;
  crownDelta: number;
  soapConsumed: number;
  message: string;
}

export function resolveQuarantineGate(
  vessel: QuarantineVessel,
  action: QuarantineAction,
  soapOnHand: number,
): QuarantineResolution {
  switch (action) {
    case 'ACCEPT': {
      if (vessel.suspectedFever) {
        return {
          action,
          tradeDelta: vessel.cargoValueTrade,
          publicHealthDelta: -6,
          crownDelta: 1,
          soapConsumed: 0,
          message: `${vessel.shipName} docked freely. Trade increased by ${vessel.cargoValueTrade}, but fever spread into the dock tenements (-6 Public Health).`,
        };
      }
      return {
        action,
        tradeDelta: vessel.cargoValueTrade,
        publicHealthDelta: 0,
        crownDelta: 2,
        soapConsumed: 0,
        message: `${vessel.shipName} docked with a clean bill of health! Gained +${vessel.cargoValueTrade} Trade.`,
      };
    }

    case 'FUMIGATE': {
      const soapReq = 1;
      const hasSoap = soapOnHand >= soapReq;
      if (!hasSoap) {
        return {
          action: 'ACCEPT',
          tradeDelta: vessel.cargoValueTrade,
          publicHealthDelta: -4,
          crownDelta: 0,
          soapConsumed: 0,
          message: `Attempted fumigation but lacked Bar Soap! Dock workers exposed to tainted hold (-4 Public Health).`,
        };
      }
      return {
        action,
        tradeDelta: Math.round(vessel.cargoValueTrade * 0.85),
        publicHealthDelta: +1,
        crownDelta: +1,
        soapConsumed: 1,
        message: `Vessel thoroughly scrubbed and fumigated with soap wash. Cargo cleared safely without contagion!`,
      };
    }

    case 'BURN': {
      return {
        action,
        tradeDelta: 0,
        publicHealthDelta: 0,
        crownDelta: -2,
        soapConsumed: 0,
        message: `Quarantine watch torched ${vessel.shipName} at the outer shoals. Contagion prevented, but Crown traders protest the harsh measure (-2 Crown).`,
      };
    }
  }
}
