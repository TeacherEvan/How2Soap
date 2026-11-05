/**
 * Milestone M8: Victories, Deposal Endgames & Test of Time Scoring Engine
 * (§6.10, §6.18.5, §6.18.8, §6.29)
 *
 * Implements:
 * 1. Test of Time Scoring across 4 Pillars:
 *    - Dominion (Military)
 *    - Tourism (Culture)
 *    - GDP (Economy)
 *    - Innovation (Science)
 * 2. 4 Canonical Victory Conditions + 1 Alternate Victory:
 *    - THE_CURE (Scientific): The Voltaic Ascension + antibiotic supply (penicillin consignments or Public Health >= 80 in Age III)
 *    - THE_GRAND_MAGISTER (Cultural): High Tourism (>=100) + Crown favor / Dispatches mastery
 *    - THE_SALT_LEDGER (Economic): High GDP (>=120) + Brine/Treasury reserve
 *    - THE_NATIONS_BREATH (Military): Dominion >= 100 + Pale frontier pacified
 *    - THE_REPUBLIC_OF_COMPOUND (Alternate / Undertow): Joined rebels + overthrow Crown in Age III with Public Mandate >= 75
 * 3. 3 Authored Deposal Endgames:
 *    - RECALLED_TO_THE_COURT (Crown Estate reaches 0)
 *    - THE_SWORD_DECIDES (Army Estate reaches 0)
 *    - THE_CROWD_DECIDES (Public Estate reaches 0)
 * 4. Built-Works Epilogue Counter (Engineering Canon vs Medical Canon)
 * 5. Test of Time Comprehensive Campaign Score Calculation
 */

import type { RealmState, DeposalType } from './realm';
import type { SettlementsState } from './settlements';
import type { BuiltWorksState } from './builtWorks';
import { type PatronId, getPatronEnding } from './patron';

export type VictoryType =
  | 'THE_CURE'                  // Scientific Victory
  | 'THE_GRAND_MAGISTER'        // Cultural Victory
  | 'THE_SALT_LEDGER'           // Economic Victory
  | 'THE_NATIONS_BREATH'        // Military Victory
  | 'THE_REPUBLIC_OF_COMPOUND'; // Alternate Rebel Victory

export interface VictoryScores {
  dominion: number;   // Military
  tourism: number;    // Cultural
  gdp: number;        // Economic
  innovation: number; // Scientific
}

export type UndertowStance = 'FEED' | 'JOIN' | 'SUPPRESS' | 'IGNORE';

export interface CampaignVictoryState {
  scores: VictoryScores;
  undertowStance: UndertowStance;
  penicillinConsignmentsDelivered: number;
  frontierThreatsPacified: number;
  tradeConvoysCompleted: number;
  dispatchesMastered: number;
  claimedVictory: VictoryType | null;
  deposalOccurred: DeposalType | null;
  turnCompleted: number | null;
  isMuseumMode: boolean;
}

export function createInitialVictoryState(): CampaignVictoryState {
  return {
    scores: {
      dominion: 0,
      tourism: 0,
      gdp: 0,
      innovation: 0,
    },
    undertowStance: 'IGNORE',
    penicillinConsignmentsDelivered: 0,
    frontierThreatsPacified: 0,
    tradeConvoysCompleted: 0,
    dispatchesMastered: 0,
    claimedVictory: null,
    deposalOccurred: null,
    turnCompleted: null,
    isMuseumMode: false,
  };
}

export interface StepVictoryScoreContext {
  settlements: SettlementsState;
  realm: RealmState;
  builtWorks: BuiltWorksState;
  currentAge: number;
  wondersCount?: number;
  uniqueQuartersCount?: number;
}

/**
 * Deterministically steps and updates cross-age Test of Time Victory Scores (§6.10):
 * - Dominion: +1 per settlement held, +6 per incorporated/captured, +12 capital
 * - Tourism: +2 per Wonder, +3 per Unique Quarter, +1 per 25 renown, +built works
 * - GDP: +1 per slotted strategic resource/city, +trade yield accrual, +convoys
 * - Innovation: +10 per Grand Project, +discovery yield accrual, +maturity doctrines
 */
export function updateVictoryScores(
  state: CampaignVictoryState,
  ctx: StepVictoryScoreContext,
): VictoryScores {
  const s = ctx.settlements;
  const settlementCount = s.settlements.length;
  const capitalHeld = s.settlements.some((item) => item.isCapital);

  // Dominion increment per turn
  const dominionDelta = settlementCount * 1 + (capitalHeld ? 2 : 0);

  // Tourism increment
  const wonders = ctx.wondersCount ?? 0;
  const uq = ctx.uniqueQuartersCount ?? 0;
  const tourismDelta = Math.floor((s.globalYields?.renown ?? 0) / 2) + (wonders * 2) + (uq * 3);

  // GDP increment
  const gdpDelta = (s.globalYields?.trade ?? 0) + (s.settlements.filter((item) => item.kind === 'CITY').length * 2);

  // Innovation increment
  const innovationDelta = (s.globalYields?.discovery ?? 0) + (ctx.currentAge >= 2 ? 1 : 0);

  state.scores.dominion += dominionDelta;
  state.scores.tourism += tourismDelta;
  state.scores.gdp += gdpDelta;
  state.scores.innovation += innovationDelta;

  return { ...state.scores };
}

export interface VictoryEligibility {
  eligible: boolean;
  type: VictoryType;
  title: string;
  description: string;
  missingRequirements?: string[];
}

/**
 * Checks which victory conditions the Magister is currently eligible to claim (§6.10, §6.18.5, §6.29).
 */
export function evaluateVictoryEligibilities(
  victoryState: CampaignVictoryState,
  realm: RealmState,
  settlements: SettlementsState,
  currentAge: number,
  builtWorks: BuiltWorksState,
): VictoryEligibility[] {
  const results: VictoryEligibility[] = [];

  // 1. The Cure (Scientific Victory)
  // Requirements: Age III, Innovation >= 100, and (penicillin delivered >= 5 OR Public Health >= 80)
  const cureMissing: string[] = [];
  if (currentAge < 3) cureMissing.push('Reach Age III (The Age of Volta)');
  if (victoryState.scores.innovation < 100) cureMissing.push(`Attain 100 Innovation (Current: ${victoryState.scores.innovation})`);
  if (victoryState.penicillinConsignmentsDelivered < 5 && realm.health < 80) {
    cureMissing.push('Deliver ≥5 Penicillin consignments or maintain Public Health ≥80%');
  }
  results.push({
    eligible: cureMissing.length === 0,
    type: 'THE_CURE',
    title: 'The Cure (Scientific Victory)',
    description: 'Eradicate the Wasting across the Realm through pure chemical synthesis and national inoculation.',
    missingRequirements: cureMissing,
  });

  // 2. The Grand Magister (Cultural Victory)
  // Requirements: Tourism >= 100, Crown Estate >= 70, Dispatches Mastered >= 6
  const magisterMissing: string[] = [];
  if (victoryState.scores.tourism < 100) magisterMissing.push(`Attain 100 Tourism (Current: ${victoryState.scores.tourism})`);
  if (realm.estates.crown < 70) magisterMissing.push(`Maintain Crown Estate ≥70 (Current: ${realm.estates.crown})`);
  if (victoryState.dispatchesMastered < 6) magisterMissing.push(`Master ≥6 Crown Dispatches (Current: ${victoryState.dispatchesMastered})`);
  results.push({
    eligible: magisterMissing.length === 0,
    type: 'THE_GRAND_MAGISTER',
    title: 'The Grand Magister (Cultural Victory)',
    description: 'Become the undisputed intellectual beacon and cultural sovereign of the continent.',
    missingRequirements: magisterMissing,
  });

  // 3. The Salt Ledger (Economic Victory)
  // Requirements: GDP >= 120, Trade Convoys >= 5, Settlements >= 3
  const ledgerMissing: string[] = [];
  if (victoryState.scores.gdp < 120) ledgerMissing.push(`Attain 120 GDP (Current: ${victoryState.scores.gdp})`);
  if (victoryState.tradeConvoysCompleted < 5) ledgerMissing.push(`Complete ≥5 Overland/Harbour Trade Convoys (Current: ${victoryState.tradeConvoysCompleted})`);
  if (settlements.settlements.length < 3) ledgerMissing.push(`Hold ≥3 Settlements (Current: ${settlements.settlements.length})`);
  results.push({
    eligible: ledgerMissing.length === 0,
    type: 'THE_SALT_LEDGER',
    title: 'The Salt Ledger (Economic Victory)',
    description: 'Control the salt trade, copper currency, and continental shipping routes with absolute commercial dominance.',
    missingRequirements: ledgerMissing,
  });

  // 4. The War for the Nation\'s Breath (Military Victory)
  // Requirements: Dominion >= 100, Public Safety >= 75, Frontier threats pacified >= 4, or Military Works erected
  const warMissing: string[] = [];
  if (victoryState.scores.dominion < 100) warMissing.push(`Attain 100 Dominion (Current: ${victoryState.scores.dominion})`);
  if (realm.safety < 75) warMissing.push(`Maintain Public Safety ≥75% (Current: ${realm.safety}%)`);
  if (victoryState.frontierThreatsPacified < 4 && !builtWorks.works['work_military_engines']) {
    warMissing.push(`Pacify ≥4 Frontier Raids / Rival Incursions (Current: ${victoryState.frontierThreatsPacified}) or erect Military Engines built work`);
  }
  results.push({
    eligible: warMissing.length === 0,
    type: 'THE_NATIONS_BREATH',
    title: "The War for the Nation's Breath (Military Victory)",
    description: 'Pacify the Pale marches and fortify the frontiers with chemically synthesized powder and disciplined garrisons.',
    missingRequirements: warMissing,
  });

  // 5. The Republic of Compound (Alternate Rebel Victory, §6.29)
  // Requirements: Age III, Undertow stance === 'JOIN', Public Estate >= 75
  const republicMissing: string[] = [];
  if (currentAge < 3) republicMissing.push('Reach Age III (The Age of Volta)');
  if (victoryState.undertowStance !== 'JOIN') republicMissing.push("Must have joined 'The Undertow' rebel movement in the Influence Window");
  if (realm.estates.public < 75) republicMissing.push(`Maintain Public Estate ≥75 (Current: ${realm.estates.public})`);
  results.push({
    eligible: republicMissing.length === 0,
    type: 'THE_REPUBLIC_OF_COMPOUND',
    title: 'The Republic of Compound (Rebel Victory)',
    description: 'Overthrow the feudal Crown with the organized working crowd, establishing a democratic confederation of laboratories and communes.',
    missingRequirements: republicMissing,
  });

  return results;
}

export interface EndingCardContent {
  stamp: string;
  title: string;
  badge: string;
  prose: string[];
  canonSummary: string;
  isVictory: boolean;
}

/**
 * Returns authored ending narratives and prose for all 5 Victories and 3 Deposals (§6.18.5, §6.18.8, §6.29).
 */
export function getEndingCardContent(
  endingType: VictoryType | DeposalType,
  builtWorks: BuiltWorksState,
  patronId: PatronId | null,
): EndingCardContent {
  const patronEnding = getPatronEnding(patronId);
  const engineeringCount = builtWorks.engineeringCanonCount;
  const canonSummary = engineeringCount >= 3
    ? `Engineering Canon Dominant (${engineeringCount} public works erected: aqueducts, arches, and stone outfalls endure). Patron Legacy: ${patronEnding.endingTitle}.`
    : `Medical & Chemical Canon Dominant (The laboratory bench and apothecary cures shaped the Realm's destiny). Patron Legacy: ${patronEnding.endingTitle}.`;

  switch (endingType) {
    // --- VICTORIES ---
    case 'THE_CURE':
      return {
        stamp: 'SCIENTIFIC VICTORY',
        title: 'The Voltaic Eradication',
        badge: 'The Cure of Nations',
        prose: [
          'The galvanised copper and zinc batteries hum in the grand hospital wards. High-pressure steam sterilises the cotton bandages; pure crystalline penicillin flows in measured drops into the fever-wracked.',
          'For the first time in recorded memory, the Wasting yields. The quarantine checkpoints stand empty, their gates thrown wide to morning carts laden with bread and green herbs.',
          'You did not conquer the continent with iron spears or royal decrees. You conquered the rot with fire, salt, and the tireless precision of the bench.',
        ],
        canonSummary,
        isVictory: true,
      };

    case 'THE_GRAND_MAGISTER':
      return {
        stamp: 'CULTURAL VICTORY',
        title: 'The Grand Magister of the Realm',
        badge: 'The Sovereign Mind',
        prose: [
          'Envoys from seven rival kingdoms arrive at your university gates bearing laurel wreaths and unsealed codices. The courts of the West no longer consult their bishops; they consult your monographs.',
          'The royal court dresses in soaps perfumed with elderflower and lavender; your civic decrees are memorized by schoolmasters from the capital to the sea.',
          'Your name has become synonymous with reason itself. The age of superstition has dissolved in an alembic of clear thought.',
        ],
        canonSummary,
        isVictory: true,
      };

    case 'THE_SALT_LEDGER':
      return {
        stamp: 'ECONOMIC VICTORY',
        title: 'The Sovereign Salt Ledger',
        badge: 'Master of Coin & Brine',
        prose: [
          'Every ingot stamped in the mint carries your alloy assay; every grain of salt moving over the high passes pays toll to your treasury.',
          'Barons and foreign princes petition your counting houses for emergency lines of credit. While empires crumble in war, your granaries remain full and your trade convoys traverse unmolested.',
          'The Realm is bound together not by oaths of fealty, but by the undeniable arithmetic of your ledger.',
        ],
        canonSummary,
        isVictory: true,
      };

    case 'THE_NATIONS_BREATH':
      return {
        stamp: 'MILITARY VICTORY',
        title: "The Nation's Breath Restored",
        badge: 'The Aegis of Saltpeter',
        prose: [
          'At the high frontier palisade, the thunder of your corned powder echoed across the frozen ridges. The Pale war-bands broke before the disciplined volleys of your armed watch.',
          'Tough leather cordage, resin-bonded composite bows, and lime-cement citadels have turned the wild border into an impregnable bulwark.',
          'The people sleep peacefully behind your ramparts. The frontier is secured, and the kingdom breathes freely at last.',
        ],
        canonSummary,
        isVictory: true,
      };

    case 'THE_REPUBLIC_OF_COMPOUND':
      return {
        stamp: 'REVOLUTIONARY VICTORY',
        title: 'The Republic of Compound',
        badge: 'The Undertow Sovereign',
        prose: [
          'The royal banner was lowered from the citadel at dawn without a single drop of fraternal blood. The Regent has fled; the corrupt Court Chamberlain is in irons.',
          'In place of the Crown, the delegates of the Soapwrights, the Miners, and the Tanners convene in the Great Hall. Production belongs to those who tend the kettles.',
          'A new republic rises from the ash — pragmatic, literate, and forged in the democratic brotherhood of the laboratory.',
        ],
        canonSummary,
        isVictory: true,
      };

    // --- DEPOSALS (§6.18.8) ---
    case 'DISMISSAL':
      return {
        stamp: 'DEPOSAL: SOFT EXILE',
        title: 'Recalled to the Court',
        badge: 'Crown Charter Revoked',
        prose: [
          'The Chamberlain’s black carriages arrive at midnight under heavy guard. A sealed parchment bears the royal wax seal: your laboratory charter is unilaterally revoked.',
          'Accused of squandering royal funds, neglecting the Regent\'s requisitions, and failing the kingdom\'s honour, you are stripped of your gowns and escorted across the border into rural obscurity.',
          'Your apprentices carry on in secret, but the great experiments fall silent. The Court will find another chemist — and another disaster.',
        ],
        canonSummary,
        isVictory: false,
      };

    case 'MUTINY':
      return {
        stamp: 'DEPOSAL: MILITARY COLLAPSE',
        title: 'The Sword Decides',
        badge: 'Frontier Mutiny & Coup',
        prose: [
          'The garrisons have gone unpaid, their spears dull and their boots rotted through. At dawn, the watch fires on the watchtowers are extinguished.',
          'The barracks gates swing shut against your orders. Out on the frontier, the Pale rides through the unguarded breaches; within the city, the soldiers seize the armories and declare martial law.',
          'You are placed under house arrest as war consumes the marches. The kingdom has become an open battlefield.',
        ],
        canonSummary,
        isVictory: false,
      };

    case 'PYRE':
      return {
        stamp: 'DEPOSAL: POPULAR REVOLT',
        title: 'The Crowd Decides',
        badge: 'The Pyre of the Alembics',
        prose: [
          'Fever in the tenements, foul brews released into the wells, and promises broken. The bells of the river churches ring backwards in alarm.',
          'A sea of torches gathers at your laboratory gates. Pamphleteers denounce your science as sorcery and plague-mongering; before midnight, the heavy cedar doors splinter inward.',
          'They burn the alembics to soot and scatter your notes across the cobblestones. You flee through the sewer outfalls into the dark, leaving behind a kingdom consumed by fury.',
        ],
        canonSummary,
        isVictory: false,
      };
  }
}

/**
 * Test of Time Scoring Formula (§6.10):
 * Total Score = Dominion + Tourism + GDP + Innovation + (Estates Avg * 2) + (Settlements * 15) - (Turns Taken * 0.5)
 */
export function calculateTestOfTimeScore(
  victoryState: CampaignVictoryState,
  realm: RealmState,
  settlements: SettlementsState,
  turnsElapsed: number,
): {
  totalScore: number;
  rankTitle: string;
  breakdown: {
    dominion: number;
    tourism: number;
    gdp: number;
    innovation: number;
    estateBonus: number;
    settlementBonus: number;
    turnPenalty: number;
  };
} {
  const scores = victoryState.scores;
  const estatesAvg = Math.round((realm.estates.crown + realm.estates.army + realm.estates.public) / 3);
  const estateBonus = estatesAvg * 2;
  const settlementBonus = settlements.settlements.length * 15;
  const turnPenalty = Math.round(turnsElapsed * 0.5);

  const rawTotal = scores.dominion + scores.tourism + scores.gdp + scores.innovation + estateBonus + settlementBonus - turnPenalty;
  const totalScore = Math.max(0, rawTotal);

  let rankTitle = 'Apprentice Scavenger';
  if (totalScore >= 500) rankTitle = 'Grand Sovereign of the Crucible';
  else if (totalScore >= 380) rankTitle = 'High Chancellor of the Realm';
  else if (totalScore >= 260) rankTitle = 'Master Saponifier & Warden';
  else if (totalScore >= 150) rankTitle = 'Journeyman Apothecary';

  return {
    totalScore,
    rankTitle,
    breakdown: {
      dominion: scores.dominion,
      tourism: scores.tourism,
      gdp: scores.gdp,
      innovation: scores.innovation,
      estateBonus,
      settlementBonus,
      turnPenalty,
    },
  };
}
