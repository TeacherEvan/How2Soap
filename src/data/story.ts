export type AffinityId = 'apothecary' | 'soapwright' | 'forgewright';

export interface ObjectiveDef {
  id: string;
  kind: 'species' | 'recipe' | 'item' | 'flag' | 'eat' | 'treat';
  target: string;
  count?: number;
  text: string;
}

export interface ChapterDef {
  id: string;
  era: string;
  title: string;
  epigraph: string;
  body: string;
  objectives: readonly ObjectiveDef[];
  epilogue: string;
  renown: number;
}

export interface LetterDef {
  id: string;
  era: string;
  chapter: number;
  from: string;
  excerpt: string;
  task: ObjectiveDef;
  rewardRenown: number;
  rewardAffinity: Partial<Record<AffinityId, number>>;
}

export interface AffinityDef {
  id: AffinityId;
  titles: readonly [string, string, string];
  thresholds: readonly [number, number, number];
  color: string;
}

export const CHAPTERS: readonly ChapterDef[] = [
  {
    id: 'ch1',
    era: 'c. 10,000 BC · an unnamed river bank',
    title: 'The First Fire',
    epigraph: '“The fire does not ask names. Remember that.” — Magister Hennig',
    body: 'Before the pot, before the word for yes, there was hunger and the cold. You hold a hammerstone and a knife of flint, and everything ahead of you — every bronze blade, every bottle of medicine — is sleeping in stone, bark, bone and brine. Strike well.',
    objectives: [
      { id: 'ch1_adze', kind: 'recipe', target: 'RECIPE_CRAFT_FLINT_ADZE', text: 'Knap a flint adze' },
      { id: 'ch1_bucket', kind: 'recipe', target: 'RECIPE_CARVE_WOODEN_BUCKET', text: 'Carve a wooden bucket' },
      { id: 'ch1_ash', kind: 'species', target: 'K2CO3', text: 'Burn hardwood to ash (> 0.05 mol K₂CO₃)' },
      { id: 'ch1_pack', kind: 'recipe', target: 'RECIPE_STITCH_BACKPACK', text: 'Stitch the leather backpack' },
    ],
    epilogue: 'Your hands smell of smoke and tannin. The river keeps its own ledger, and tonight you are written in it.',
    renown: 150,
  },
  {
    id: 'ch2',
    era: 'c. 2500 BC · Nineveh → 30 BC · the Tiber',
    title: "The Soapwright's Secret",
    epigraph: '“Ash is not the end of fire. It is the beginning of clean hands.” — Magister Hennig',
    body: 'The Babylonians knew it written in clay tablets; the Romans washed their wealth in it. Potash from the hearth, fat from the hunt, salt from the earth — three humble things that made the world tolerable. Make the soap. The world will notice.',
    objectives: [
      { id: 'ch2_caO', kind: 'species', target: 'CAO', text: 'Slaked quicklime (CaO) in water' },
      { id: 'ch2_lye', kind: 'species', target: 'KOH', text: 'Settle clear lye (> 0.1 mol KOH)' },
      { id: 'ch2_saponify', kind: 'species', target: 'K_STEARATE', text: 'Saponify tristearin (> 0.05 mol K-stearate)' },
      { id: 'ch2_bar', kind: 'species', target: 'NA_STEARATE', text: 'Salt out & skim a hard bar of soap' },
    ],
    epilogue: 'A grey, waxen bar sits on the sill. Grease will never hold you again.',
    renown: 300,
  },
  {
    id: 'ch3',
    era: 'c. 3300 BC · the Zagros Mountains',
    title: 'The Bronze Bloom',
    epigraph: '“Stones that bled green became the first wealth of man.” — Magister Hennig',
    body: 'Everything green on this mountain dreams of being metal. Charcoal breathes on stone, stone yields its blood, the blood hardens into something that sings against stone. You are about to forge the metal age with your own hands.',
    objectives: [
      { id: 'ch3_cu', kind: 'recipe', target: 'SMELT_COPPER_INGOT', text: 'Smelt a copper ingot' },
      { id: 'ch3_bronze', kind: 'species', target: 'BRONZE', text: 'Cast 88:12 bronze (Cu₀.₈₈Sn₀.₁₂)' },
      { id: 'ch3_fork', kind: 'recipe', target: 'CAST_BRONZE_FORK', text: 'Cast the Bronze Fork' },
    ],
    epilogue: 'The fork is warm from the mold. Dinner, from now on, is civilised.',
    renown: 450,
  },
  {
    id: 'ch4',
    era: 'c. 1770 · Philadelphia & c. 1850 · Padua',
    title: 'The Willow Cure',
    epigraph: '“For every fever on earth there is a tree somewhere, standing ready.” — Magister Hennig',
    body: 'Fever took the ancients in their beds; it took the Vikings at sea. But the willow has always known the cure — it bleeds a medicine that quiets the burning blood. Distill the spirit, free the acid, carry the tincture.',
    objectives: [
      { id: 'ch4_ethanol', kind: 'recipe', target: 'DISTILL_ANTISEPTIC_ETHANOL', text: 'Distil 95% ethanol' },
      { id: 'ch4_salicin', kind: 'species', target: 'SALICIN', text: 'Free salicylic acid from salicin' },
      { id: 'ch4_tincture', kind: 'recipe', target: 'CRAFT_SALICYLIC_ACID_TINCTURE', text: 'Brew the salicylic tincture' },
    ],
    epilogue: 'The fever broke by morning. Whoever you lost to fever, you will save the next one.',
    renown: 600,
  },
  {
    id: 'ch5',
    era: '1928 · St. Mary\'s, London',
    title: 'The Mold That Saved a War',
    epigraph: '“Had I not seen it, I would not have believed it.” — A. Fleming',
    body: 'A dish left open on a bench. A mould. A cleared ring, like frost on a window at dawn. From that small accident came the medicine that would turn back the oldest killer of the soldier and the surgeon alike. Cultivate it. Brew it. Dose it.',
    objectives: [
      { id: 'ch5_culture', kind: 'recipe', target: 'CULTIVATE_PENICILLIN', text: 'Cultivate Penicillium chrysogenum' },
      { id: 'ch5_dose', kind: 'recipe', target: 'CRAFT_PENICILLIN_DOSE', text: 'Brew a penicillin dose' },
    ],
    epilogue: 'The vial is small and grey-gold and worth more than any treasure this mountain holds.',
    renown: 750,
  },
  {
    id: 'ch6',
    era: '1800 · Como & 1807 · London',
    title: 'The Voltaic Awakening',
    epigraph: '“I send you the instrument, and await your verdict.” — A. Volta to J. Banks',
    body: 'Two metals, one damp cloth between them, and the mystery that hums in the marrow of the earth. Stack the discs. Send the current through salt twice drowned in fire. What sleeps in the molten stone will wake burning blue in your hands.',
    objectives: [
      { id: 'ch6_h2so4', kind: 'species', target: 'H2SO4', text: 'Build H₂SO₄ in the lead chamber (> 0.1 mol)' },
      { id: 'ch6_pile', kind: 'recipe', target: 'STACK_VOLTAIC_PILE', text: 'Stack the 12-cell voltaic pile' },
      { id: 'ch6_na', kind: 'species', target: 'SODIUM_METAL', text: 'Isolate elemental sodium (or potassium) by electrolysis' },
    ],
    epilogue: 'The metal skitters across the stone and bursts into flame. You are no longer a survivor. You are a maker.',
    renown: 900,
  },
] as const;

export const AFFINITIES: readonly AffinityDef[] = [
  { id: 'apothecary', titles: ['Leech', 'Apothecary', 'Master Apothecary'], thresholds: [30, 80, 150], color: '#5fb3a1' },
  { id: 'soapwright', titles: ['Ash-Tender', 'Purifier', 'Grand Purifier'], thresholds: [30, 80, 150], color: '#e0a458' },
  { id: 'forgewright', titles: ['Cinderling', 'Emberwright', 'Grand Forgewright'], thresholds: [30, 80, 150], color: '#d96c6c' },
] as const;

export const RENOWN_THRESHOLDS = [0, 150, 350, 600, 900, 1250, 1650, 2100, 2600, 3150] as const;
export const LEVEL_TITLES = ['Scrub Apprentice', 'Firekeeper', 'Ash-Tender', 'Lyewright', 'Soapwright', 'Bronze-Hand', 'Emberwright', 'Willow-Sage', 'Master of Elements', 'Grand Chemist'] as const;
export const DOMINANT_EPILOGUE = {
  apothecary: 'The old Magister bows his head. “You chose the hand that heals. Go — every fever from here to the coast will know your name.”',
  soapwright: 'The old Magister nods slowly. “You chose clean hands in a dirty world. The river keeps soap in her pocket, thanks to you.”',
  forgewright: 'The old Magister taps your shoulder. “You chose the fire. Every anvil in the valley will ring with your metal.”',
} as const;

export const LETTERS: readonly LetterDef[] = [
  {
    id: 'l_riverfolk',
    era: 'Neolithic',
    chapter: 1,
    from: 'The River Folk',
    excerpt: 'Stone remembers the first edge. Make one.',
    task: { id: 'l_riverfolk_t', kind: 'recipe', target: 'RECIPE_KNAP_FLINT', text: 'Knap flint into blade and adze' },
    rewardRenown: 40,
    rewardAffinity: { soapwright: 20 },
  },
  {
    id: 'l_jabir',
    era: 'c. 760',
    chapter: 2,
    from: 'Jabir ibn Hayyan',
    excerpt: 'The ashes of hardwood hold the white stone.',
    task: { id: 'l_jabir_t', kind: 'species', target: 'KOH', text: 'Settle clear lye (> 0.1 mol KOH)' },
    rewardRenown: 60,
    rewardAffinity: { soapwright: 30 },
  },
  {
    id: 'l_pliny',
    era: '77 AD',
    chapter: 2,
    from: 'Pliny the Elder',
    excerpt: 'Hisha Naturalis: sapones, a thing the Gauls knew.',
    task: { id: 'l_pliny_t', kind: 'species', target: 'K_STEARATE', text: 'Saponify fat into true soap' },
    rewardRenown: 70,
    rewardAffinity: { soapwright: 25 },
  },
  {
    id: 'l_lemery',
    era: '1687',
    chapter: 2,
    from: 'Nicolas Lémery',
    excerpt: 'Salt of the earth, white and honest.',
    task: { id: 'l_lemery_t', kind: 'species', target: 'NA_STEARATE', text: 'Salt out and skim bar soap' },
    rewardRenown: 90,
    rewardAffinity: { soapwright: 35 },
  },
  {
    id: 'l_baytar',
    era: '1248',
    chapter: 4,
    from: 'Ibn al-Baytar',
    excerpt: 'The willow bleeds a remedy the ancients feared.',
    task: { id: 'l_baytar_t', kind: 'species', target: 'SALICIN', text: 'Harvest willow phloem (salicin precursor)' },
    rewardRenown: 80,
    rewardAffinity: { soapwright: 25, apothecary: 15 },
  },
  {
    id: 'l_desmarest',
    era: 'c. 1791',
    chapter: 1,
    from: 'Marie-Marguerite Desmarest · Marseille',
    excerpt: 'A backpack of leather outlives a fortune of gold.',
    task: { id: 'l_desmarest_t', kind: 'recipe', target: 'RECIPE_STITCH_BACKPACK', text: 'Complete the leather backpack pipeline' },
    rewardRenown: 80,
    rewardAffinity: { soapwright: 30 },
  },
  {
    id: 'l_tubalcain',
    era: 'mythic · Gen. 4:22',
    chapter: 3,
    from: 'Tubal-cain, instructor of every artifex',
    excerpt: 'Brass and iron, before either had a name.',
    task: { id: 'l_tubalcain_t', kind: 'recipe', target: 'SMELT_COPPER_INGOT', text: 'Smelt a copper ingot' },
    rewardRenown: 70,
    rewardAffinity: { forgewright: 30 },
  },
  {
    id: 'l_theophrastus',
    era: 'c. 300 BC',
    chapter: 3,
    from: 'Theophrastus of Eresos',
    excerpt: 'On Stones — what the mountain hides and what heat reveals.',
    task: { id: 'l_theophrastus_t', kind: 'recipe', target: 'SMELT_COPPER_INGOT', text: 'Reduce malachite to copper' },
    rewardRenown: 80,
    rewardAffinity: { forgewright: 25 },
  },
  {
    id: 'l_caius',
    era: '300 BC',
    chapter: 3,
    from: 'Caius the Rhodian smith',
    excerpt: 'Eight parts copper, one tin — never more.',
    task: { id: 'l_caius_t', kind: 'recipe', target: 'CAST_BRONZE_FORK', text: 'Cast the 88:12 bronze fork' },
    rewardRenown: 90,
    rewardAffinity: { forgewright: 30 },
  },
  {
    id: 'l_agricola',
    era: '1556',
    chapter: 6,
    from: 'Georgius Agricola',
    excerpt: 'De Re Metallica — wherein the earth is honest at last.',
    task: { id: 'l_agricola_t', kind: 'recipe', target: 'SMELT_ZINC_DISCS', text: 'Roast sphalerite, smelt zinc' },
    rewardRenown: 110,
    rewardAffinity: { forgewright: 35 },
  },
  {
    id: 'l_volta',
    era: '1800',
    chapter: 6,
    from: 'Alessandro Volta',
    excerpt: 'I send you the instrument, and await your verdict.',
    task: { id: 'l_volta_t', kind: 'recipe', target: 'STACK_VOLTAIC_PILE', text: 'Stack the 12-cell voltaic pile' },
    rewardRenown: 120,
    rewardAffinity: { forgewright: 35 },
  },
  {
    id: 'l_davy',
    era: '1807',
    chapter: 6,
    from: 'Humphry Davy',
    excerpt: 'The metal runs and bursts into flame. Bring it to me.',
    task: { id: 'l_davy_t', kind: 'species', target: 'POTASSIUM_METAL', text: 'Electrolyse molten salt; isolate K (or Na)' },
    rewardRenown: 150,
    rewardAffinity: { forgewright: 40 },
  },
  {
    id: 'l_hippocrates',
    era: 'c. 400 BC',
    chapter: 4,
    from: 'Hippocrates, the Hippocratic Oath',
    excerpt: 'First, do no harm. Second, do good.',
    task: { id: 'l_hippocrates_t', kind: 'treat', target: 'tincture', text: 'Administer salicylic tincture (cure a fever)' },
    rewardRenown: 80,
    rewardAffinity: { apothecary: 25 },
  },
  {
    id: 'l_hildegard',
    era: 'c. 1158',
    chapter: 4,
    from: 'Hildegard of Bingen',
    excerpt: 'The willow bark cools the burning blood.',
    task: { id: 'l_hildegard_t', kind: 'species', target: 'SALICYLIC_ACID', text: 'Extract salicylic acid from salicin' },
    rewardRenown: 90,
    rewardAffinity: { apothecary: 30 },
  },
  {
    id: 'l_paracelsus',
    era: 'c. 1520',
    chapter: 4,
    from: 'Paracelsus, the Swiss bombast',
    excerpt: 'Sola dosis facit venenum — the dose makes the poison.',
    task: { id: 'l_paracelsus_t', kind: 'recipe', target: 'DISTILL_ANTISEPTIC_ETHANOL', text: 'Distil 95% ethanol' },
    rewardRenown: 90,
    rewardAffinity: { apothecary: 25 },
  },
  {
    id: 'l_avicenna',
    era: 'c. 1020',
    chapter: 4,
    from: 'Avicenna, Canon of Medicine',
    excerpt: 'A wound untended is a funeral arranged.',
    task: { id: 'l_avicenna_t', kind: 'treat', target: 'antiseptic', text: 'Disinfect a festering wound' },
    rewardRenown: 70,
    rewardAffinity: { apothecary: 25 },
  },
  {
    id: 'l_fleming',
    era: '1928',
    chapter: 5,
    from: 'Alexander Fleming',
    excerpt: 'Had I not been careless, I would not have noticed.',
    task: { id: 'l_fleming_t', kind: 'recipe', target: 'CULTIVATE_PENICILLIN', text: 'Cultivate Penicillium and brew the dose' },
    rewardRenown: 130,
    rewardAffinity: { apothecary: 40 },
  },
  {
    id: 'l_florey',
    era: '1940',
    chapter: 5,
    from: 'Howard Florey, Oxford',
    excerpt: 'Make this mould into a miracle.',
    task: { id: 'l_florey_t', kind: 'treat', target: 'penicillin', text: 'Cure a systemic infection' },
    rewardRenown: 140,
    rewardAffinity: { apothecary: 35 },
  },
] as const;