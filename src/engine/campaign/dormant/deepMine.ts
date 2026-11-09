/**
 * Deep Mining & Blasting Engine (§6.18.3)
 *
 * Implements:
 * - DEEP_MINE order (settlement + charges):
 *     Opens deep mineral veins: 2.5x ore yield (Cu/Sn/Zn/S).
 *     Every blast rolls a CAVE_IN event.
 * - Cave-in responses:
 *     - "Timber up!": shingle/axe capability prevents collapse
 *     - "Evacuate": production collapses for 3 turns, Morale -4
 *     - "Counter-blast": clears drift with additional charge
 */

export interface DeepMineResult {
  ok: boolean;
  message: string;
  oreYieldMultiplier: number;
  caveInTriggered: boolean;
  sulfurBonusFines: number;
}

export function executeDeepMineOrder(
  settlementId: string,
  tntChargesAvailable: number,
  rngRoll = Math.random(),
): DeepMineResult {
  if (tntChargesAvailable < 1) {
    return {
      ok: false,
      message: 'Deep Mine blasting requires at least 1 TNT_CHARGE.',
      oreYieldMultiplier: 1.0,
      caveInTriggered: false,
      sulfurBonusFines: 0,
    };
  }

  // 35% chance of rockfall / cave-in during deep subterranean blasts
  const caveInTriggered = rngRoll < 0.35;

  return {
    ok: true,
    message: caveInTriggered
      ? `Detonation breached deep veins in ${settlementId}! Overburden shifted — CAVE_IN reported in the drift!`
      : `Detonation successful in ${settlementId}! Deep strata exposed; 2.5x mineral yields active.`,
    oreYieldMultiplier: 2.5,
    caveInTriggered,
    sulfurBonusFines: 2,
  };
}

export interface ResolveCaveInResult {
  productionStalledTurns: number;
  moraleDelta: number;
  message: string;
}

export function resolveCaveInResponse(
  choice: 'TIMBER_UP' | 'EVACUATE' | 'COUNTER_BLAST',
  hasAxes = true,
  tntAvailable = 0,
): ResolveCaveInResult {
  switch (choice) {
    case 'TIMBER_UP':
      if (!hasAxes) {
        return {
          productionStalledTurns: 3,
          moraleDelta: -4,
          message: 'Lacked timber axes! Shoring failed; drift sealed for 3 turns.',
        };
      }
      return {
        productionStalledTurns: 0,
        moraleDelta: 2,
        message: 'Crews迅速 timbered the drift with heavy oak shoring! Mining operations continue unhindered.',
      };

    case 'COUNTER_BLAST':
      if (tntAvailable < 1) {
        return {
          productionStalledTurns: 3,
          moraleDelta: -4,
          message: 'No demolition charges remaining to counter-blast! Drift collapsed.',
        };
      }
      return {
        productionStalledTurns: 0,
        moraleDelta: 4,
        message: 'Secondary charge blasted through the rockfall! Drift cleared with high spirits.',
      };

    case 'EVACUATE':
    default:
      return {
        productionStalledTurns: 3,
        moraleDelta: -4,
        message: 'Lower gallery sealed off. Production stalled for 3 turns while workers clear rubble.',
      };
  }
}
