import type { WorldSnapshot } from '../engine/memoryLayout';

export type TutorialTierId = 'BEGINNER' | 'INTERMEDIATE' | 'PHD';

export interface TutorialReagentGrant {
  items?: Array<{ itemId: string; count?: number; massKg?: number }>;
  vesselSpecies?: Array<{ speciesId: string; moles: number }>;
  vesselTempK?: number;
}

export interface TutorialEvalContext {
  state: any;
  snapshot: WorldSnapshot | null;
}

export interface TutorialLesson {
  id: string;
  tier: TutorialTierId;
  stepNumber: number;
  title: string;
  subtitle: string;
  plateKey: 'TERRAIN' | 'MINES' | 'ELEMENTS' | 'TIERS';
  tabTarget: 'explorer' | 'workbench' | 'strategy' | 'council';
  spotlightSelector: string;
  summaryHtml: string;
  formulaHtml?: string;
  actionHint: string;
  practiceGrant: TutorialReagentGrant;
  isComplete: (ctx: TutorialEvalContext) => boolean;
}

export const TUTORIAL_LESSONS: TutorialLesson[] = [
  // ==========================================
  // TIER I: BEGINNER (Scrub Apprentice)
  // ==========================================
  {
    id: 'beg_1_forage',
    tier: 'BEGINNER',
    stepNumber: 1,
    title: 'Forage & Caloric Balance',
    subtitle: 'Harvest deadfall timber and maintain blood glucose & thermal regulation',
    plateKey: 'TERRAIN',
    tabTarget: 'explorer',
    spotlightSelector: '[data-node-id="TREE_SCOTS_PINE"] .btn-harvest, .category-block[data-category="TREES"]',
    summaryHtml: `Welcome to the frontier. Your body continuously burns blood glucose to maintain core body temperature (<strong>37.0 °C</strong>). Harvest fallen branches to secure fuel for combustion and soap ashes.`,
    formulaHtml: `Glucose burn: <code>dG/dt = BMR + Work(kcal)</code> · Normal core temp: <code>37.0 °C</code>`,
    actionHint: 'Go to Biome Explorer and harvest pine or oak deadfall branches.',
    practiceGrant: {
      items: [{ itemId: 'PINE_DEADFALL_WOOD', count: 4, massKg: 2.0 }],
    },
    isComplete: (ctx) => {
      const items = ctx.state?.inventory?.items ?? [];
      return items.some((it: any) => it.id.includes('DEADFALL') || it.id.includes('BERRIES'));
    },
  },
  {
    id: 'beg_2_leach',
    tier: 'BEGINNER',
    stepNumber: 2,
    title: 'Wood Ash Leaching',
    subtitle: 'Extract potassium carbonate (K2CO3) to produce an alkaline lye solution',
    plateKey: 'ELEMENTS',
    tabTarget: 'workbench',
    spotlightSelector: '#tab-reactions-content, #btn-open-reactions',
    summaryHtml: `Wood ashes contain soluble potassium carbonate (potash). Add water and ash to Vessel #0 on the Alchemy Workbench to leach an alkaline bath (<strong>pH &gt; 10.5</strong>).`,
    formulaHtml: `Ash dissolution: <code>K2CO3(s) &rarr; 2 K+(aq) + CO3^2-(aq)</code> · <code>pH &gt; 11.0</code>`,
    actionHint: 'Switch to Workbench, add Water and Ash to Vessel #0.',
    practiceGrant: {
      items: [{ itemId: 'WHITE_OAK_BARK', count: 4, massKg: 1.0 }],
      vesselSpecies: [{ speciesId: 'K2CO3', moles: 0.8 }],
    },
    isComplete: (ctx) => {
      if (!ctx.snapshot) return false;
      const ph = ctx.snapshot.telemetry[0 * 8 + 1] ?? 7.0; // pH field in TELEMETRY stride
      return ph >= 10.0;
    },
  },
  {
    id: 'beg_3_caustic',
    tier: 'BEGINNER',
    stepNumber: 3,
    title: 'Quicklime Causticization',
    subtitle: 'Drive pH > 12.5 by precipitating calcium carbonate',
    plateKey: 'MINES',
    tabTarget: 'workbench',
    spotlightSelector: '#vessel-list',
    summaryHtml: `Calcinated limestone (quicklime, CaO) slakes into Ca(OH)2 and reacts with K2CO3 to precipitate insoluble CaCO3, leaving strong caustic lye (KOH/NaOH) in solution.`,
    formulaHtml: `Causticization: <code>K2CO3 + Ca(OH)2 &rarr; 2 KOH + CaCO3&darr;</code>`,
    actionHint: 'Add quicklime/CaO to Vessel #0 to causticize the lye solution.',
    practiceGrant: {
      items: [{ itemId: 'LIMESTONE_ROCK', count: 2, massKg: 0.5 }],
      vesselSpecies: [{ speciesId: 'KOH', moles: 1.5 }],
    },
    isComplete: (ctx) => {
      if (!ctx.snapshot) return false;
      const ph = ctx.snapshot.telemetry[0 * 8 + 1] ?? 7.0;
      return ph >= 12.0;
    },
  },
  {
    id: 'beg_4_saponify',
    tier: 'BEGINNER',
    stepNumber: 4,
    title: 'Thermal Saponification',
    subtitle: 'Combine animal fats with hot caustic lye (355 K) to hydrolyze esters',
    plateKey: 'ELEMENTS',
    tabTarget: 'workbench',
    spotlightSelector: '#vessel-list',
    summaryHtml: `Tallow contains triglyceride esters (tripalmitin). When heated above 350 K in caustic lye, ester bonds hydrolyze into glycerol and fatty acid carboxylate salts (liquid soap).`,
    formulaHtml: `Saponification: <code>Triglyceride + 3 OH- &rarr; Glycerol + 3 Soap-</code>`,
    actionHint: 'Add rendered tallow to Vessel #0 and turn on the heating mantle.',
    practiceGrant: {
      items: [{ itemId: 'RAW_ADIPOSE_FAT', count: 2, massKg: 1.0 }],
      vesselSpecies: [
        { speciesId: 'KOH', moles: 2.0 },
        { speciesId: 'K_STEARATE', moles: 1.2 },
      ],
      vesselTempK: 358.15,
    },
    isComplete: (ctx) => {
      const items = ctx.state?.inventory?.items ?? [];
      const hasSoap = items.some((it: any) => it.id.includes('SOAP'));
      if (hasSoap) return true;
      if (!ctx.snapshot) return false;
      // Check vessel moles for any soap
      const v0moles = ctx.snapshot.moles.subarray(0, 64);
      return Array.from(v0moles).some((m) => m > 0.05);
    },
  },
  {
    id: 'beg_5_salt_skim',
    tier: 'BEGINNER',
    stepNumber: 5,
    title: 'Salting-Out & Bar Soap',
    subtitle: 'Precipitate solid curds with halite (NaCl) and skim the pure bar',
    plateKey: 'TIERS',
    tabTarget: 'workbench',
    spotlightSelector: '#vessel-list',
    summaryHtml: `Adding rock salt (NaCl) saturates the aqueous phase, exceeding the solubility product of the fatty acid salt. Solid soap curds float to the surface, ready to skim into solid bars!`,
    formulaHtml: `Salting out: <code>[Na+] &times; [Soap-] &gt; K_sp &rarr; BAR_SOAP&darr;</code>`,
    actionHint: 'Add salt, then click Skim Soap on Vessel #0.',
    practiceGrant: {
      items: [{ itemId: 'BAR_SOAP', count: 1, massKg: 0.2 }],
    },
    isComplete: (ctx) => {
      const items = ctx.state?.inventory?.items ?? [];
      return items.some((it: any) => it.id === 'BAR_SOAP');
    },
  },

  // ==========================================
  // TIER II: INTERMEDIATE (Guild Master)
  // ==========================================
  {
    id: 'int_1_mohs',
    tier: 'INTERMEDIATE',
    stepNumber: 1,
    title: 'Mohs Fracture & Tool Advantage',
    subtitle: 'Reduce caloric extraction cost by matching mineral hardness',
    plateKey: 'MINES',
    tabTarget: 'explorer',
    spotlightSelector: '[data-tab="explorer"]',
    summaryHtml: `Mining ores with bare hands inflicts massive caloric drain. Harvesting cost scales with <code>(Mohs_rock / Mohs_tool)^2 / MA_tool</code>. Craft flint or bronze tools to harvest mineral seams sustainably.`,
    formulaHtml: `<code>E_harvest = E_base &times; max(0.5, (Mohs_rock / Mohs_tool)^2) / MA_tool</code>`,
    actionHint: 'Craft or equip a knapped flint or bronze pick/axe.',
    practiceGrant: {
      items: [
        { itemId: 'FLINT_ADZE', count: 1, massKg: 0.8 },
        { itemId: 'FLINT_FLAKE_BLADE', count: 1, massKg: 0.5 },
      ],
    },
    isComplete: (ctx) => {
      const tools = ctx.state?.inventory?.tools ?? {};
      return Object.values(tools).some((t) => !!t);
    },
  },
  {
    id: 'int_2_geology',
    tier: 'INTERMEDIATE',
    stepNumber: 2,
    title: 'Geological Stratigraphy',
    subtitle: 'Prospect Malachite (Cu, Mohs 4.0) and Cassiterite (Sn, Mohs 6.5)',
    plateKey: 'MINES',
    tabTarget: 'explorer',
    spotlightSelector: '[data-tab="explorer"]',
    summaryHtml: `Consult Plate II's cutaway mine survey. Malachite copper seams reside in upper limestone strata; heavy cassiterite tin oxides lie deeper within metamorphic granitic beds.`,
    formulaHtml: `Malachite: <code>Cu2CO3(OH)2</code> · Cassiterite: <code>SnO2</code>`,
    actionHint: 'Prospect and harvest raw copper or tin ore from mineral nodes.',
    practiceGrant: {
      items: [
        { itemId: 'MALACHITE_ORE', count: 4, massKg: 2.0 },
        { itemId: 'CASSITERITE_ORE', count: 2, massKg: 1.0 },
      ],
    },
    isComplete: (ctx) => {
      const items = ctx.state?.inventory?.items ?? [];
      return items.some((it: any) => it.id.includes('MALACHITE') || it.id.includes('COPPER') || it.id.includes('CASSITERITE'));
    },
  },
  {
    id: 'int_3_bronze',
    tier: 'INTERMEDIATE',
    stepNumber: 3,
    title: '88:12 Bronze Smelting',
    subtitle: 'Alloy copper with tin at 1,350 K for high mechanical advantage',
    plateKey: 'ELEMENTS',
    tabTarget: 'workbench',
    spotlightSelector: '[data-tab="workbench"]',
    summaryHtml: `Smelt 88% Copper with 12% Tin at 1,350 K in a refractory crucible. Bronze provides Mohs hardness 6.0 and Mechanical Advantage 2.8, unlocking advanced machinery.`,
    formulaHtml: `Alloy ratio: <code>88 Cu : 12 Sn</code> · Melting point: <code>~1,220 K &ndash; 1,350 K</code>`,
    actionHint: 'Smelt copper and tin ingots to forge high-grade bronze.',
    practiceGrant: {
      items: [
        { itemId: 'COPPER_INGOT', count: 4, massKg: 2.0 },
        { itemId: 'TIN_INGOT', count: 1, massKg: 0.5 },
      ],
    },
    isComplete: (ctx) => {
      const items = ctx.state?.inventory?.items ?? [];
      return items.some((it: any) => it.id.includes('COPPER_INGOT') || it.id.includes('TIN_INGOT'));
    },
  },
  {
    id: 'int_4_colony',
    tier: 'INTERMEDIATE',
    stepNumber: 4,
    title: 'Colony Labor & Desire Paths',
    subtitle: 'Recruit specialists and establish high-speed trade trails (+20% SPD)',
    plateKey: 'TERRAIN',
    tabTarget: 'strategy',
    spotlightSelector: '[data-tab="strategy"]',
    summaryHtml: `Open the Strategy Map. Recruit Foragers, Miners, or Herbalists in the Command Dock. As workers traverse the wilderness between Hearth (0,0) and resource nodes, desire paths form naturally, boosting travel speed up to +20%.`,
    formulaHtml: `Speed bonus: <code>M_trail = 1.0 + 0.20 &times; (wear / 255)</code>`,
    actionHint: 'Navigate to Strategy Map and recruit your first worker in the Command Dock.',
    practiceGrant: {
      items: [{ itemId: 'BAR_SOAP', count: 2, massKg: 0.4 }],
    },
    isComplete: (ctx) => {
      const colonists = ctx.state?.colony?.colonists ?? [];
      return colonists.length > 0;
    },
  },
  {
    id: 'int_5_payroll',
    tier: 'INTERMEDIATE',
    stepNumber: 5,
    title: 'Payroll & Pharmacokinetics',
    subtitle: 'Balance wage contracts and manage stimulant boost & crash cycles',
    plateKey: 'TIERS',
    tabTarget: 'strategy',
    spotlightSelector: '[data-tab="strategy"]',
    summaryHtml: `Process daily payroll with food, metals, or soap. Administer Willow Tea or Mint Tonic for temporary +30% work boosts—but beware the crash phase: speed drops and morale dips (-8), risking strikes if morale drops below 20.`,
    formulaHtml: `Strike threshold: <code>Morale &lt; 20</code> · Boost &rarr; Crash (-8 Morale)`,
    actionHint: 'Configure wage contracts or administer a stimulant from the Strategy Map.',
    practiceGrant: {
      items: [
        { itemId: 'WILLOW_TEA', count: 2, massKg: 0.5 },
        { itemId: 'BAR_SOAP', count: 4, massKg: 0.8 },
      ],
    },
    isComplete: (ctx) => {
      const ledger = ctx.state?.colony?.ledger ?? [];
      return ledger.length > 0;
    },
  },

  // ==========================================
  // TIER III: PHD STUDENT (Magister)
  // ==========================================
  {
    id: 'phd_1_sid',
    tier: 'PHD',
    stepNumber: 1,
    title: 'Stewart Strong-Ion Difference (SID)',
    subtitle: 'Calculate exact proton activity from independent ionic charge balance',
    plateKey: 'ELEMENTS',
    tabTarget: 'workbench',
    spotlightSelector: '#vessel-list',
    summaryHtml: `In modern physical chemistry, pH is governed by the Strong-Ion Difference (SID) of fully dissociated spectator ions. Solve the quadratic proton balance: <code>[H+] = (-SID + sqrt(SID^2 + 4Kw)) / 2</code>.`,
    formulaHtml: `<code>SID = 2[Ca^2+] + [Na+] + [K+] - [Cl-] - 2[SO4^2-]</code>`,
    actionHint: 'Observe the live SID readout in PhD Telemetry Mode and adjust ion concentrations.',
    practiceGrant: {
      vesselSpecies: [
        { speciesId: 'K2CO3', moles: 1.0 },
        { speciesId: 'KOH', moles: 0.5 },
      ],
    },
    isComplete: (ctx) => {
      if (!ctx.snapshot) return false;
      const ph = ctx.snapshot.telemetry[0 * 8 + 1] ?? 7.0;
      return ph >= 12.5 && ph <= 14.0;
    },
  },
  {
    id: 'phd_2_arrhenius',
    tier: 'PHD',
    stepNumber: 2,
    title: 'Arrhenius Kinetics & Calorimetry',
    subtitle: 'Balance reaction enthalpy (Q_rxn) against Newton-film thermal dissipation',
    plateKey: 'ELEMENTS',
    tabTarget: 'workbench',
    spotlightSelector: '#vessel-list',
    summaryHtml: `Reaction velocity follows the Arrhenius rate law <code>k(T) = A &middot; exp(-Ea / RT)</code>. In exothermic ester hydrolysis, balance mantle heating wattage against Newton convective cooling to prevent boiling runaway (&gt;373.15 K).`,
    formulaHtml: `<code>dT/dt = (P_heater + Q_rxn - hA(T - T_amb)) / (m &middot; Cp)</code>`,
    actionHint: 'Maintain Vessel #0 temperature within the optimal window (350 K - 368 K).',
    practiceGrant: {
      vesselTempK: 356.15,
      vesselSpecies: [{ speciesId: 'KOH', moles: 1.2 }],
    },
    isComplete: (ctx) => {
      if (!ctx.snapshot) return false;
      const tempK = ctx.snapshot.telemetry[0 * 8 + 0] ?? 288.15;
      return tempK >= 350.0 && tempK <= 370.0;
    },
  },
  {
    id: 'phd_3_ksp',
    tier: 'PHD',
    stepNumber: 3,
    title: 'Common-Ion Salting-Out (K_sp)',
    subtitle: 'Precipitate amphiphilic micelles by exceeding the solubility product',
    plateKey: 'ELEMENTS',
    tabTarget: 'workbench',
    spotlightSelector: '#vessel-list',
    summaryHtml: `Adding rock salt drives <code>[Na+] &middot; [RCOO-] &gt; K_sp,soap</code> (0.08 mol&sup2;/L&sup2;), collapsing hydration shells around carboxylate heads and forcing amphiphilic soap curds to phase-separate.`,
    formulaHtml: `<code>K_sp = [Na+][Soap-] = 0.08 mol&sup2;/L&sup2;</code>`,
    actionHint: 'Saturate the lye bath with salt until precipitate exceeds 0.2 moles.',
    practiceGrant: {
      vesselSpecies: [
        { speciesId: 'NACL', moles: 2.5 },
        { speciesId: 'NA_STEARATE', moles: 0.8 },
      ],
    },
    isComplete: (ctx) => {
      const items = ctx.state?.inventory?.items ?? [];
      return items.some((it: any) => it.id === 'BAR_SOAP');
    },
  },
  {
    id: 'phd_4_distill',
    tier: 'PHD',
    stepNumber: 4,
    title: 'Cross-Vessel Vapor Distillation',
    subtitle: 'Couple vapor headspace to secondary condensers for fractional collection',
    plateKey: 'MINES',
    tabTarget: 'workbench',
    spotlightSelector: '#vessel-list',
    summaryHtml: `Connect Vessel #0's vapor manifold to Vessel #1 using <code>condenserTargetVesselId</code>. Boil volatile ethanol or nitric acid vapors and condense high-purity distillate into the receiving vessel.`,
    formulaHtml: `Raoult's Law: <code>P_i = x_i &middot; P_i^*</code> · Condensation efficiency &gt; 95%`,
    actionHint: 'Configure a condenser target vessel and boil off volatile fractions.',
    practiceGrant: {
      items: [
        { itemId: 'SULFURIC_ACID_BOTTLE', count: 1, massKg: 0.5 },
        { itemId: 'DISTILLED_WATER', count: 2, massKg: 1.0 },
      ],
    },
    isComplete: (ctx) => {
      const items = ctx.state?.inventory?.items ?? [];
      return items.some((it: any) => it.id.includes('ACID') || it.id.includes('DISTILLED') || it.id.includes('ETHANOL'));
    },
  },
  {
    id: 'phd_5_faraday',
    tier: 'PHD',
    stepNumber: 5,
    title: 'Faraday Molten Electrolysis',
    subtitle: 'Overcome decomposition voltage (4.5 V) to reduce metallic Sodium (Na^0)',
    plateKey: 'TIERS',
    tabTarget: 'workbench',
    spotlightSelector: '#vessel-list',
    summaryHtml: `Connect a 12-cell Voltaic pile delivering 9.6 V across anhydrous molten NaOH at 595 K. When cell voltage exceeds decomposition potential (4.5 V), cathodic reduction isolates pure elemental Sodium: <code>Na+ + e- &rarr; Na^0</code>.`,
    formulaHtml: `Faraday's Law: <code>&Delta;n_Na = (V - V_decomp) &middot; &Delta;t / (R_cell &middot; F &middot; z)</code>`,
    actionHint: 'Apply &gt; 5.0 V across molten lye to isolate elemental sodium.',
    practiceGrant: {
      items: [{ itemId: 'SODIUM_METAL', count: 1, massKg: 0.1 }],
    },
    isComplete: (ctx) => {
      const items = ctx.state?.inventory?.items ?? [];
      return items.some((it: any) => it.id === 'SODIUM_METAL');
    },
  },
];
