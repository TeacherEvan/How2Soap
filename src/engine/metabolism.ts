/**
 * Bio-Thermodynamic Player Metabolism Model
 *
 * Implements Section 4.1 of the Master Technical Specification:
 * - Two-compartment bio-energetic model:
 *   - Blood Glucose & Glycogen: 0 to 2000 kcal (instant mechanical work pool)
 *   - Adipose Reserves: 15,000 kcal starting baseline (mobilized during fast/sleep)
 * - Basal Metabolic Rate (BMR): 70 kcal/hour
 * - Muscular Efficiency: eta_human = 0.22 (22% dietary kcal -> mechanical Joules)
 * - Environmental thermal dissipation with clothing insulation (I_clo):
 *   E_burn = BMR + (W_mech / eta_human) + max(0, (T_core - T_ambient) / (0.155 * I_clo))
 * - Core body temperature tracking:
 *   Nominal: 37.0 C
 *   Hypothermia threshold: < 35.0 C (critical shivering / unconsciousness)
 *   Hyperthermia threshold: > 39.5 C (heat stroke)
 */

export interface PlayerConditions {
  fever: boolean;                  // elevates coreTemp above nominal (+1.8 to +2.5 K)
  systemicInfection: boolean;      // metabolic drain (+60 kcal/hr) & systemic deterioration
  woundContamination: boolean;     // infection risk; can escalate to systemic infection
}

export interface PlayerMetabolismState {
  glucoseKcal: number;       // 0 .. 2000 kcal
  adiposeKcal: number;       // starting 15,000 kcal
  hydrationPct: number;      // 0 .. 100 %
  coreTempK: number;         // 310.15 K nominal (37.0 C)
  clothingIclo: number;      // 0.05 nude baseline, 1.15 leather backpack/tunic
  isSleeping: boolean;
  conditions: PlayerConditions;
  dead?: boolean;
  woundOnsetSeconds?: number;
  sepsisOnsetSeconds?: number;
}

export const METABOLIC_CONSTANTS = {
  BMR_KCAL_PER_HOUR: 70.0,
  HUMAN_MECHANICAL_EFFICIENCY: 0.22, // eta_human
  JOULES_PER_KCAL: 4184.0,
  NOMINAL_CORE_TEMP_K: 310.15, // 37.0 C
  HYPOTHERMIA_CRITICAL_K: 308.15, // 35.0 C
  HYPERTHERMIA_CRITICAL_K: 312.65, // 39.5 C
  MAX_GLUCOSE_KCAL: 2000.0,
  FAT_MOBILIZATION_RATE_KCAL_PER_HOUR: 120.0,
  BODY_MASS_KG: 70.0,
  BODY_SPECIFIC_HEAT_J_PER_KG_K: 3470.0, // Avg human specific heat
};

export function createPlayerMetabolism(initialIclo = 0.05): PlayerMetabolismState {
  return {
    glucoseKcal: 1200.0,
    adiposeKcal: 15000.0,
    hydrationPct: 100.0,
    coreTempK: METABOLIC_CONSTANTS.NOMINAL_CORE_TEMP_K,
    clothingIclo: initialIclo,
    isSleeping: false,
    dead: false,
    conditions: {
      fever: false,
      systemicInfection: false,
      woundContamination: false,
    },
  };
}

export interface MetabolicStepOptions {
  dtSeconds: number;
  ambientTempK: number;
  mechanicalWorkJoules?: number;
}

export interface MetabolicStepResult {
  totalBurnKcal: number;
  thermalDissipationKcal: number;
  workKcal: number;
  bmrKcal: number;
  isHypothermic: boolean;
  isHyperthermic: boolean;
  shivering: boolean;
}

/**
 * Step player metabolism forward in time by dtSeconds.
 */
export function stepPlayerMetabolism(
  player: PlayerMetabolismState,
  options: MetabolicStepOptions,
): MetabolicStepResult {
  const dtHours = options.dtSeconds / 3600.0;
  const mechanicalWorkJoules = Math.max(0, options.mechanicalWorkJoules ?? 0);

  // 1. Mechanical work cost in kcal
  const workKcal = mechanicalWorkJoules / (METABOLIC_CONSTANTS.HUMAN_MECHANICAL_EFFICIENCY * METABOLIC_CONSTANTS.JOULES_PER_KCAL);

  // 2. Basal metabolic rate & pathological metabolic drain
  const bmrMultiplier = player.isSleeping ? 0.85 : 1.0;
  const infectionDrainKcal = player.conditions.systemicInfection ? 60.0 * dtHours : 0;
  const woundDrainKcal = player.conditions.woundContamination ? 10.0 * dtHours : 0;
  const bmrKcal = (METABOLIC_CONSTANTS.BMR_KCAL_PER_HOUR * dtHours * bmrMultiplier) + infectionDrainKcal + woundDrainKcal;

  // 3. Environmental thermal dissipation (in Watts -> converted to kcal)
  // Heat loss = (T_core - T_ambient) / (0.155 * I_clo) in W/m2.
  // Standard human surface area = 1.8 m2.
  // When nude (I_clo 0.05), heat dissipation is high in cool air.
  const deltaT = player.coreTempK - options.ambientTempK;
  const effectiveIclo = Math.max(0.05, player.clothingIclo);
  const heatLossWattsPerM2 = Math.max(0, deltaT) / (0.155 * effectiveIclo);
  const totalHeatLossWatts = heatLossWattsPerM2 * 1.8;
  const thermalLossJoules = totalHeatLossWatts * options.dtSeconds;
  const thermalDissipationKcal = Math.max(0, thermalLossJoules / METABOLIC_CONSTANTS.JOULES_PER_KCAL);

  // 4. Shivering thermogenesis if cold (or fever chills driving temp toward pyrogenic setpoint)
  let shiveringKcal = 0;
  let shivering = false;
  const nominalSetpoint = player.conditions.fever
    ? METABOLIC_CONSTANTS.NOMINAL_CORE_TEMP_K + 2.0 // Fever elevates hypothalamic setpoint to ~39.0 C
    : METABOLIC_CONSTANTS.NOMINAL_CORE_TEMP_K;

  if (player.coreTempK < nominalSetpoint - 0.5) {
    shivering = true;
    shiveringKcal = 50.0 * dtHours; // up to 50 kcal/hr shivering heat production
  }

  // Total energy burned in this time interval
  // Human metabolism produces basal heat continuously
  const totalBurnKcal = bmrKcal + workKcal + shiveringKcal;

  // 5. Deduct energy from Glucose first, then mobilize Adipose
  if (player.glucoseKcal >= totalBurnKcal) {
    player.glucoseKcal -= totalBurnKcal;
  } else {
    const deficit = totalBurnKcal - player.glucoseKcal;
    player.glucoseKcal = 0;
    const mobilizedFat = Math.min(deficit, player.adiposeKcal);
    player.adiposeKcal -= mobilizedFat;
  }

  // 6. Thermal regulation: update core body temperature
  // Normal thermoregulation keeps core temp steady unless exposed to severe net loss
  // Heat produced internally vs dissipation to environment:
  const metabolicHeatWatts = ((bmrKcal + workKcal * 0.8 + shiveringKcal) * METABOLIC_CONSTANTS.JOULES_PER_KCAL) / options.dtSeconds;
  const netHeatWatts = metabolicHeatWatts - totalHeatLossWatts;

  const totalHeatCapacity = METABOLIC_CONSTANTS.BODY_MASS_KG * METABOLIC_CONSTANTS.BODY_SPECIFIC_HEAT_J_PER_KG_K;
  // Body actively maintains homeostatic setpoint (nominal or pyrogenic fever) when difference is small
  const deltaTempK = (netHeatWatts * options.dtSeconds) / totalHeatCapacity;
  const homeostaticDamping = 0.02;
  const pyrogenicFeverShift = player.conditions.fever ? 0.001 * options.dtSeconds : 0;
  player.coreTempK = Math.max(300.0, Math.min(316.0, player.coreTempK + deltaTempK * homeostaticDamping + pyrogenicFeverShift));

  // 7. Hydration loss: 0.05% per hour base + sweating under high work or heat
  const sweatFactor = deltaT < 0 ? 2.5 : 1.0;
  player.hydrationPct = Math.max(0, player.hydrationPct - 0.05 * dtHours * sweatFactor);

  return {
    totalBurnKcal,
    thermalDissipationKcal,
    workKcal,
    bmrKcal,
    isHypothermic: player.coreTempK < METABOLIC_CONSTANTS.HYPOTHERMIA_CRITICAL_K,
    isHyperthermic: player.coreTempK > METABOLIC_CONSTANTS.HYPERTHERMIA_CRITICAL_K,
    shivering,
  };
}

export interface ConsumeFoodOptions {
  hydrationBonus?: number;
  hasCleanUtensil?: boolean;
}

export interface ConsumeFoodResult {
  absorbedKcal: number;
  bonusKcal: number;
  pathogenRiskEliminated: boolean;
}

/**
 * Consume food items to replenish glucose and fat.
 * If hasCleanUtensil is true (or options.hasCleanUtensil is true),
 * digestive return is boosted by +15% net caloric digestion efficiency,
 * and pathogen risk is eliminated.
 */
export function consumeFood(
  player: PlayerMetabolismState,
  kcal: number,
  hydrationBonusOrOptions: number | ConsumeFoodOptions = 0,
): ConsumeFoodResult {
  let hydrationBonus = 0;
  let hasCleanUtensil = false;

  if (typeof hydrationBonusOrOptions === 'number') {
    hydrationBonus = hydrationBonusOrOptions;
  } else if (hydrationBonusOrOptions) {
    hydrationBonus = hydrationBonusOrOptions.hydrationBonus ?? 0;
    hasCleanUtensil = hydrationBonusOrOptions.hasCleanUtensil ?? false;
  }

  const effectiveKcal = hasCleanUtensil ? kcal * 1.15 : kcal;
  const bonusKcal = effectiveKcal - kcal;

  const roomInGlucose = METABOLIC_CONSTANTS.MAX_GLUCOSE_KCAL - player.glucoseKcal;
  if (effectiveKcal <= roomInGlucose) {
    player.glucoseKcal += effectiveKcal;
  } else {
    player.glucoseKcal = METABOLIC_CONSTANTS.MAX_GLUCOSE_KCAL;
    player.adiposeKcal += (effectiveKcal - roomInGlucose);
  }
  player.hydrationPct = Math.min(100, player.hydrationPct + hydrationBonus);

  return {
    absorbedKcal: effectiveKcal,
    bonusKcal,
    pathogenRiskEliminated: hasCleanUtensil,
  };
}

/**
 * Apply Salicylic Acid febrifuge tincture:
 * Reduces fever and hyperthermia by -1.8 °C (-1.8 K).
 * Resolves fever condition.
 */
export function applySalicylicAcid(player: PlayerMetabolismState): { tempDropC: number; feverCured: boolean } {
  const tempDropC = 1.8;
  player.coreTempK = Math.max(METABOLIC_CONSTANTS.NOMINAL_CORE_TEMP_K, player.coreTempK - tempDropC);
  player.conditions.fever = false;
  return {
    tempDropC,
    feverCured: true,
  };
}

/**
 * Apply Penicillin dose:
 * Cures systemic bacterial infection and halts pathological metabolic drain.
 */
export function applyPenicillin(player: PlayerMetabolismState): { infectionCured: boolean } {
  const wasInfected = player.conditions.systemicInfection;
  player.conditions.systemicInfection = false;
  return {
    infectionCured: wasInfected,
  };
}

/**
 * Apply Ethanol disinfectant:
 * Eliminates wound contamination and prevents systemic infection.
 */
export function applyEthanolDisinfectant(player: PlayerMetabolismState): { contaminationCleared: boolean } {
  const wasContaminated = player.conditions.woundContamination;
  player.conditions.woundContamination = false;
  return {
    contaminationCleared: wasContaminated,
  };
}
