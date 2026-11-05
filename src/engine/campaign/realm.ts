/**
 * The Realm Model — Science in Service of the Nation
 *
 * Implements §6.18 of the Civ VII 4X Conversion Plan (v8):
 * - Three national indices: Public Health, Public Safety, Hearth Vigor (0–100).
 * - Five starting Countries with endowments, hardships, and estate temperaments.
 * - Three Estates: Crown, Army, Public (0–100, baseline 60).
 * - Warnings at 25 and 10; deposal triggers at 0.
 * - Distribution programs: Stimulants (The Dose), Clothing (The Hearth Cloth), Weapons (The Arsenal).
 */

export interface CountryDefinition {
  readonly id: string;
  readonly name: string;
  readonly endowments: string;
  readonly hardship: string;
  readonly ruler: string;
  readonly temperament: 'measured' | 'proud' | 'desperate' | 'stoic' | 'mercantile';
  readonly initialHealth: number;
  readonly initialSafety: number;
  readonly initialVigor: number;
  readonly estateMultiplier: {
    crown: number;
    army: number;
    public: number;
  };
}

export const COUNTRIES: readonly CountryDefinition[] = [
  {
    id: 'brass_coast',
    name: 'The Brass Coast',
    endowments: 'Abundant copper, tin, gemstones, deepwater quays',
    hardship: 'Food scarce; levy-frontier raids',
    ruler: 'Lord Admiral Corvin Thall',
    temperament: 'measured',
    initialHealth: 65,
    initialSafety: 60,
    initialVigor: 55,
    estateMultiplier: { crown: 0.8, army: 0.8, public: 0.8 },
  },
  {
    id: 'salt_steppes',
    name: 'The Salt Steppes',
    endowments: 'Halite salt flats, vast horse herds, mineral crusts',
    hardship: 'Timber and shelter scarce; brutal winds',
    ruler: 'The Great Khan Baatar',
    temperament: 'proud',
    initialHealth: 60,
    initialSafety: 70,
    initialVigor: 60,
    estateMultiplier: { crown: 1.0, army: 1.4, public: 0.7 },
  },
  {
    id: 'fever_marches',
    name: 'The Fever Marches',
    endowments: 'Willow bark groves, fertile silt, riverways',
    hardship: 'Severe endemic swamp fevers (starts afflicted)',
    ruler: 'Queen Serahl of the Weir',
    temperament: 'desperate',
    initialHealth: 40,
    initialSafety: 50,
    initialVigor: 50,
    estateMultiplier: { crown: 1.3, army: 0.9, public: 1.4 },
  },
  {
    id: 'iron_weald',
    name: 'The Iron Weald',
    endowments: 'Dense hardwood timber, bog iron, stone quarries',
    hardship: 'Bitter winters, slow agriculture',
    ruler: 'High Warden Klaus Ebon',
    temperament: 'stoic',
    initialHealth: 55,
    initialSafety: 65,
    initialVigor: 50,
    estateMultiplier: { crown: 0.9, army: 1.2, public: 0.9 },
  },
  {
    id: 'sunk_capital',
    name: 'The Sunk Capital',
    endowments: 'Ancient alchemical ruins, glassworks, libraries',
    hardship: 'Crumbling aqueducts, rampant civil unrest',
    ruler: 'Chancellor Vane',
    temperament: 'mercantile',
    initialHealth: 50,
    initialSafety: 45,
    initialVigor: 65,
    estateMultiplier: { crown: 1.2, army: 1.0, public: 1.2 },
  },
];

export interface EstatesState {
  crown: number;  // 0 - 100
  army: number;   // 0 - 100
  public: number; // 0 - 100
  crownWarned25: boolean;
  crownWarned10: boolean;
  armyWarned25: boolean;
  armyWarned10: boolean;
  publicWarned25: boolean;
  publicWarned10: boolean;
}

export type DeposalType =
  | 'DISMISSAL'  // Crown hits 0 ("Recalled to the Court")
  | 'MUTINY'     // Army hits 0 ("The Sword Decides")
  | 'PYRE';      // Public hits 0 ("The Crowd Decides")

export interface RealmState {
  countryId: string;
  turn: number;
  health: number;      // 0 - 100
  safety: number;      // 0 - 100
  vigor: number;       // 0 - 100
  doseExposure: number; // 0 - 100
  doseImmunityTurns: number;
  tunicsDeliveredTotal: number;
  guardsAssignedTotal: number;
  estates: EstatesState;
  deposal: DeposalType | null;
}

export function createRealmState(countryId = 'brass_coast'): RealmState {
  const country = COUNTRIES.find(c => c.id === countryId) ?? COUNTRIES[0];
  return {
    countryId: country.id,
    turn: 1,
    health: country.initialHealth,
    safety: country.initialSafety,
    vigor: country.initialVigor,
    doseExposure: 0,
    doseImmunityTurns: 0,
    tunicsDeliveredTotal: 0,
    guardsAssignedTotal: 0,
    estates: {
      crown: 60,
      army: 60,
      public: 60,
      crownWarned25: false,
      crownWarned10: false,
      armyWarned25: false,
      armyWarned10: false,
      publicWarned25: false,
      publicWarned10: false,
    },
    deposal: null,
  };
}

export interface RealmTurnResult {
  state: RealmState;
  warnings: string[];
  crashOccurred: boolean;
  deposalOccurred: DeposalType | null;
}

/**
 * Steps the Realm forward by 1 turn (daily rollover).
 * - Applies natural Wasting decay (-1 Health, -1 Safety baseline).
 * - Exposure recovers by -8/turn.
 * - At exposure >= 60, checks crash roll.
 * - Updates Estates and checks 25/10 warnings or deposal.
 */
export function stepRealmTurn(
  realm: RealmState,
  rngNextFloat: () => number = Math.random,
): RealmTurnResult {
  realm.turn++;
  const warnings: string[] = [];
  let crashOccurred = false;

  // 1. Natural Wasting decay: -1 Health/turn, -1 Safety/turn
  realm.health = Math.max(0, Math.min(100, realm.health - 1));
  realm.safety = Math.max(0, Math.min(100, realm.safety - 1));

  // If Public Health stays at 0, Public Estate bleeds -5 per turn (§6.18.8)
  if (realm.health === 0) {
    realm.estates.public = Math.max(0, realm.estates.public - 5);
    warnings.push('The Wasting consumes the unwashed: Public unrest intensifies (-5 Public Estate).');
  }

  // 2. Exposure recovery and Crash Check
  if (realm.doseImmunityTurns > 0) {
    realm.doseImmunityTurns--;
  }

  realm.doseExposure = Math.max(0, realm.doseExposure - 8);

  if (realm.doseExposure >= 60 && realm.doseImmunityTurns === 0) {
    // 35% chance to crash at high exposure
    if (rngNextFloat() < 0.35) {
      crashOccurred = true;
      realm.doseImmunityTurns = 2;
      realm.vigor = Math.max(0, realm.vigor - 25);
      realm.estates.public = Math.max(0, realm.estates.public - 10);
      warnings.push('Stimulant crash in the canton! Morale collapses (-20 Morale, 2-day dose immunity).');
    }
  }

  // 3. Check Estate thresholds and warnings
  const checkEstate = (
    key: 'crown' | 'army' | 'public',
    name: string,
    warn25Key: 'crownWarned25' | 'armyWarned25' | 'publicWarned25',
    warn10Key: 'crownWarned10' | 'armyWarned10' | 'publicWarned10',
    deposalType: DeposalType,
  ) => {
    const val = realm.estates[key];
    if (val <= 0 && !realm.deposal) {
      realm.deposal = deposalType;
      warnings.push(`CRITICAL: ${name} mandate lost! Deposal triggered.`);
    } else if (val <= 10 && !realm.estates[warn10Key]) {
      realm.estates[warn10Key] = true;
      warnings.push(`EMERGENCY: ${name} mandate has fallen to ${val}! Immediate remedy required.`);
    } else if (val <= 25 && !realm.estates[warn25Key]) {
      realm.estates[warn25Key] = true;
      warnings.push(`WARNING: Discontent among ${name} (${val} confidence remaining).`);
    } else if (val > 25) {
      realm.estates[warn25Key] = false;
      realm.estates[warn10Key] = false;
    }
  };

  checkEstate('crown', 'The Crown', 'crownWarned25', 'crownWarned10', 'DISMISSAL');
  checkEstate('army', 'The Army', 'armyWarned25', 'armyWarned10', 'MUTINY');
  checkEstate('public', 'The Public', 'publicWarned25', 'publicWarned10', 'PYRE');

  return {
    state: realm,
    warnings,
    crashOccurred,
    deposalOccurred: realm.deposal,
  };
}

/**
 * Distribute Stimulants (The Dose) per §6.18.1
 */
export function applyDistributeStimulants(
  realm: RealmState,
  type: 'WILLOW_TEA' | 'MINT_TONIC' | 'NITROUS_TONIC',
  crates: number,
): { success: boolean; message: string } {
  if (crates <= 0) return { success: false, message: 'Invalid crate count.' };
  if (realm.doseImmunityTurns > 0) {
    return { success: false, message: 'Canton holds dose immunity after a recent crash.' };
  }

  const exposurePerCrate = type === 'NITROUS_TONIC' ? 35 : 15;
  const vigorGainPerCrate = type === 'NITROUS_TONIC' ? 18 : 8;

  realm.doseExposure = Math.min(100, realm.doseExposure + exposurePerCrate * crates);
  realm.vigor = Math.min(100, realm.vigor + vigorGainPerCrate * crates);
  realm.estates.public = Math.min(100, realm.estates.public + 1 * crates);

  return {
    success: true,
    message: `Distributed ${crates}x ${type}: Vigor rose to ${realm.vigor}%, Exposure at ${realm.doseExposure}%.`,
  };
}

/**
 * Distribute Leather Tunics (The Hearth Cloth) per §6.18.2
 */
export function applyDistributeClothes(
  realm: RealmState,
  tunics: number,
): { success: boolean; message: string } {
  if (tunics <= 0) return { success: false, message: 'No tunics specified.' };

  realm.safety = Math.min(100, realm.safety + 2 * tunics);
  realm.tunicsDeliveredTotal += tunics;
  realm.estates.public = Math.min(100, realm.estates.public + 2 * tunics);

  return {
    success: true,
    message: `Delivered ${tunics}x Leather Tunics: Public Safety rose to ${realm.safety}%, Public Estate +${2 * tunics}.`,
  };
}

/**
 * Distribute Weapons (The Arsenal) per §6.18.3
 */
export function applyDistributeWeapons(
  realm: RealmState,
  weaponsCount: number,
): { success: boolean; message: string } {
  if (weaponsCount <= 0) return { success: false, message: 'No weapons specified.' };

  realm.safety = Math.min(100, realm.safety + 2 * weaponsCount);
  realm.guardsAssignedTotal += weaponsCount;
  realm.estates.army = Math.min(100, realm.estates.army + 2 * weaponsCount);

  return {
    success: true,
    message: `Delivered ${weaponsCount}x Weapons: Public Safety rose to ${realm.safety}%, Army Estate +${2 * weaponsCount}.`,
  };
}

/**
 * Adjusts an Estate score with bounds checking [0, 100].
 */
export function adjustEstate(
  realm: RealmState,
  estate: 'crown' | 'army' | 'public',
  delta: number,
): void {
  const country = COUNTRIES.find(c => c.id === realm.countryId) ?? COUNTRIES[0];
  const mult = country.estateMultiplier[estate] ?? 1.0;
  const netDelta = Math.round(delta * mult);
  realm.estates[estate] = Math.max(0, Math.min(100, realm.estates[estate] + netDelta));
}
