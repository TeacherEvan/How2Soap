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
    epigraph: '“Fire does not ask for your name, your lineage, or your consent. Keep that in mind when it starts taking.” — Magister Hennig',
    body: 'Before the pot, before property, there was hunger, cold, and the arithmetic of who survives winter. You hold a hammerstone and flint. Everything that follows—bronze, ledgers, medicine—sleeps in stone, bark, bone, and brine. Strike well; the river does not grade on effort.',
    objectives: [
      { id: 'ch1_adze', kind: 'recipe', target: 'RECIPE_CRAFT_FLINT_ADZE', text: 'Knap a flint adze' },
      { id: 'ch1_bucket', kind: 'recipe', target: 'RECIPE_CARVE_WOODEN_BUCKET', text: 'Carve a wooden bucket' },
      { id: 'ch1_ash', kind: 'species', target: 'K2CO3', text: 'Burn hardwood to ash (> 0.05 mol K₂CO₃)' },
      { id: 'ch1_pack', kind: 'recipe', target: 'RECIPE_STITCH_BACKPACK', text: 'Stitch the leather backpack' },
    ],
    epilogue: 'Your hands smell of smoke and tannin. The river keeps its own ledger, and tonight you are entered in it—under liabilities.',
    renown: 150,
  },
  {
    id: 'ch2',
    era: 'c. 2500 BC · Girsu & Nineveh → 30 BC · the Tiber',
    title: "The Soapwright's Secret",
    epigraph: '“Ash is not the end of fire. It is the beginning of plausible deniability.” — Magister Hennig',
    body: 'Sumerian scribes pressed it into clay: alkali ash steeped with fat to scour fleece—and, occasionally, a conscience. Potash from the hearth, fat from the slaughter, salt from the earth: three things separating civilization from a slow, greasy death. Make the soap. The Council is already arguing over the patent.',
    objectives: [
      { id: 'ch2_caO', kind: 'species', target: 'CAO', text: 'Slaked quicklime (CaO) in water' },
      { id: 'ch2_lye', kind: 'species', target: 'KOH', text: 'Settle clear lye (> 0.1 mol KOH)' },
      { id: 'ch2_saponify', kind: 'species', target: 'K_STEARATE', text: 'Saponify tristearin (> 0.05 mol K-stearate)' },
      { id: 'ch2_bar', kind: 'species', target: 'NA_STEARATE', text: 'Salt out & skim a hard bar of soap' },
    ],
    epilogue: 'A grey, waxen bar sits on the sill. It will wash the blood off your knuckles, if not the rest.',
    renown: 300,
  },
  {
    id: 'ch3',
    era: 'c. 3300 BC · the Zagros Mountains',
    title: 'The Bronze Bloom',
    epigraph: '“Stones that bled green became the first wealth of man—and the first reason to build a wall.” — Magister Hennig',
    body: 'Everything green on this mountain wants to be weaponized. Charcoal breathes on ore, ore yields its blood, and the blood hardens into something that settles arguments permanently. Forge the metal age; try not to wonder who buys the surplus.',
    objectives: [
      { id: 'ch3_cu', kind: 'recipe', target: 'SMELT_COPPER_INGOT', text: 'Smelt a copper ingot' },
      { id: 'ch3_bronze', kind: 'species', target: 'BRONZE', text: 'Cast 88:12 bronze (Cu₀.₈₈Sn₀.₁₂)' },
      { id: 'ch3_fork', kind: 'recipe', target: 'CAST_BRONZE_FORK', text: 'Cast the Bronze Fork' },
    ],
    epilogue: 'The fork is warm from the mold. Dinner, from now on, is civilized—which is to say, armed.',
    renown: 450,
  },
  {
    id: 'ch4',
    era: 'c. 1770 · Philadelphia & c. 1850 · Padua',
    title: 'The Willow Cure',
    epigraph: '“For every fever on earth there is a tree somewhere, standing ready—though usually on someone else’s land.” — Magister Hennig',
    body: 'Fever took the ancients in their beds and the clerks at their desks. The willow holds the cure—a bitter compound that quiets burning blood. Distill the spirit, free the acid, carry the tincture. The Council will decide later who can afford a dose.',
    objectives: [
      { id: 'ch4_ethanol', kind: 'recipe', target: 'DISTILL_ANTISEPTIC_ETHANOL', text: 'Distil 95% ethanol' },
      { id: 'ch4_salicin', kind: 'species', target: 'SALICIN', text: 'Free salicylic acid from salicin' },
      { id: 'ch4_tincture', kind: 'recipe', target: 'CRAFT_SALICYLIC_ACID_TINCTURE', text: 'Brew the salicylic tincture' },
    ],
    epilogue: 'The fever broke by morning. Whoever you lost to it, you will invoice the next one.',
    renown: 600,
  },
  {
    id: 'ch5',
    era: '1928 · St. Mary\'s, London',
    title: 'The Mold That Saved a War',
    epigraph: '“Had I not left the dish unwashed, I would not have believed it.” — A. Fleming',
    body: 'An unwashed dish. A stray mould. A cleared ring like frost on glass. From that small negligence came the medicine that turns back the oldest killer of soldier and surgeon alike—just in time for the next war. Cultivate it. Brew it. Dose it.',
    objectives: [
      { id: 'ch5_culture', kind: 'recipe', target: 'CULTIVATE_PENICILLIN', text: 'Cultivate Penicillium chrysogenum' },
      { id: 'ch5_dose', kind: 'recipe', target: 'CRAFT_PENICILLIN_DOSE', text: 'Brew a penicillin dose' },
    ],
    epilogue: 'The vial is small, grey-gold, and worth more than this mountain. Guard it.',
    renown: 750,
  },
  {
    id: 'ch6',
    era: '1800 · Como & 1807 · London',
    title: 'The Voltaic Awakening',
    epigraph: '“I send you the instrument, and await your verdict—preferably before the Royal Society takes credit.” — A. Volta to J. Banks',
    body: 'Two metals, one damp cloth, and the quiet violence humming in the earth. Stack the discs. Drive current through molten salt. What sleeps in the stone wakes burning blue—and it will not care who holds the tongs.',
    objectives: [
      { id: 'ch6_h2so4', kind: 'species', target: 'H2SO4', text: 'Build H₂SO₄ in the lead chamber (> 0.1 mol)' },
      { id: 'ch6_pile', kind: 'recipe', target: 'STACK_VOLTAIC_PILE', text: 'Stack the 12-cell voltaic pile' },
      { id: 'ch6_na', kind: 'species', target: 'SODIUM_METAL', text: 'Isolate elemental sodium (or potassium) by electrolysis' },
    ],
    epilogue: 'The metal skitters and bursts into flame. You are now a liability to the crown.',
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
  apothecary: 'The Magister bows. “You chose the hand that heals. Every fever will know your name—and every magistrate will tax it.”',
  soapwright: 'The Magister nods. “You chose clean hands in a filthy world. The river keeps soap in her pocket, and the Council keeps you on retainer.”',
  forgewright: 'The Magister taps your shoulder. “You chose the fire. Every anvil will ring with your metal, and every border dispute will carry your stamp.”',
} as const;

export const LETTERS: readonly LetterDef[] = [
  {
    id: 'l_riverfolk',
    era: 'Neolithic',
    chapter: 1,
    from: 'The River Folk',
    excerpt: 'Stone remembers the first edge—and the first neck it opened. Make one.',
    task: { id: 'l_riverfolk_t', kind: 'recipe', target: 'RECIPE_KNAP_FLINT', text: 'Knap flint into blade and adze' },
    rewardRenown: 40,
    rewardAffinity: { soapwright: 20 },
  },
  {
    id: 'l_jabir',
    era: 'c. 760',
    chapter: 2,
    from: 'Jabir ibn Hayyan',
    excerpt: 'The ashes of hardwood hold the white stone. Do not let the fools in the bazaar drink it.',
    task: { id: 'l_jabir_t', kind: 'species', target: 'KOH', text: 'Settle clear lye (> 0.1 mol KOH)' },
    rewardRenown: 60,
    rewardAffinity: { soapwright: 30 },
  },
  {
    id: 'l_pliny',
    era: '77 AD',
    chapter: 2,
    from: 'Pliny the Elder',
    excerpt: 'Historia Naturalis: sapo, Galliarum inventum rutilandis capillis—though the senators use it for their reputations.',
    task: { id: 'l_pliny_t', kind: 'species', target: 'K_STEARATE', text: 'Saponify fat into true soap' },
    rewardRenown: 70,
    rewardAffinity: { soapwright: 25 },
  },
  {
    id: 'l_lemery',
    era: '1687',
    chapter: 2,
    from: 'Nicolas Lémery',
    excerpt: 'Salt of the earth, white and honest—unlike the guildmasters taxing it at the gate.',
    task: { id: 'l_lemery_t', kind: 'species', target: 'NA_STEARATE', text: 'Salt out and skim bar soap' },
    rewardRenown: 90,
    rewardAffinity: { soapwright: 35 },
  },
  {
    id: 'l_baytar',
    era: '1248',
    chapter: 4,
    from: 'Ibn al-Baytar',
    excerpt: 'The willow bleeds a remedy the ancients feared—mostly because they could not monopolize a tree.',
    task: { id: 'l_baytar_t', kind: 'species', target: 'SALICIN', text: 'Harvest willow phloem (salicin precursor)' },
    rewardRenown: 80,
    rewardAffinity: { soapwright: 25, apothecary: 15 },
  },
  {
    id: 'l_desmarest',
    era: 'c. 1791',
    chapter: 1,
    from: 'Marie-Marguerite Desmarest · Marseille',
    excerpt: 'A backpack of leather outlives a fortune of gold—and draws fewer knives in the alley.',
    task: { id: 'l_desmarest_t', kind: 'recipe', target: 'RECIPE_STITCH_BACKPACK', text: 'Complete the leather backpack pipeline' },
    rewardRenown: 80,
    rewardAffinity: { soapwright: 30 },
  },
  {
    id: 'l_tubalcain',
    era: 'mythic · Gen. 4:22',
    chapter: 3,
    from: 'Tubal-cain, instructor of every artifex',
    excerpt: 'Brass and iron, before either had a name—or a king to claim the mines.',
    task: { id: 'l_tubalcain_t', kind: 'recipe', target: 'SMELT_COPPER_INGOT', text: 'Smelt a copper ingot' },
    rewardRenown: 70,
    rewardAffinity: { forgewright: 30 },
  },
  {
    id: 'l_theophrastus',
    era: 'c. 300 BC',
    chapter: 3,
    from: 'Theophrastus of Eresos',
    excerpt: 'On Stones—what the mountain hides, what heat reveals, and what the quarrymen die for.',
    task: { id: 'l_theophrastus_t', kind: 'recipe', target: 'SMELT_COPPER_INGOT', text: 'Reduce malachite to copper' },
    rewardRenown: 80,
    rewardAffinity: { forgewright: 25 },
  },
  {
    id: 'l_caius',
    era: '300 BC',
    chapter: 3,
    from: 'Caius the Rhodian smith',
    excerpt: 'Eight parts copper, one tin—never more, unless you want the spear to bend in someone’s ribs.',
    task: { id: 'l_caius_t', kind: 'recipe', target: 'CAST_BRONZE_FORK', text: 'Cast the 88:12 bronze fork' },
    rewardRenown: 90,
    rewardAffinity: { forgewright: 30 },
  },
  {
    id: 'l_agricola',
    era: '1556',
    chapter: 6,
    from: 'Georgius Agricola',
    excerpt: 'De Re Metallica—wherein the earth is honest at last, even if the mine owners are not.',
    task: { id: 'l_agricola_t', kind: 'recipe', target: 'SMELT_ZINC_DISCS', text: 'Roast sphalerite, smelt zinc' },
    rewardRenown: 110,
    rewardAffinity: { forgewright: 35 },
  },
  {
    id: 'l_volta',
    era: '1800',
    chapter: 6,
    from: 'Alessandro Volta',
    excerpt: 'I send you the instrument, and await your verdict—preferably in writing, before Paris steals it.',
    task: { id: 'l_volta_t', kind: 'recipe', target: 'STACK_VOLTAIC_PILE', text: 'Stack the 12-cell voltaic pile' },
    rewardRenown: 120,
    rewardAffinity: { forgewright: 35 },
  },
  {
    id: 'l_davy',
    era: '1807',
    chapter: 6,
    from: 'Humphry Davy',
    excerpt: 'The metal runs and bursts into flame. Bring it to me before the Royal Institution’s insurer hears of it.',
    task: { id: 'l_davy_t', kind: 'species', target: 'POTASSIUM_METAL', text: 'Electrolyse molten salt; isolate K (or Na)' },
    rewardRenown: 150,
    rewardAffinity: { forgewright: 40 },
  },
  {
    id: 'l_hippocrates',
    era: 'c. 400 BC',
    chapter: 4,
    from: 'Hippocrates, the Hippocratic Oath',
    excerpt: 'First, do no harm. Second, do good. Third, get paid before the patient recovers and forgets.',
    task: { id: 'l_hippocrates_t', kind: 'treat', target: 'tincture', text: 'Administer salicylic tincture (cure a fever)' },
    rewardRenown: 80,
    rewardAffinity: { apothecary: 25 },
  },
  {
    id: 'l_hildegard',
    era: 'c. 1158',
    chapter: 4,
    from: 'Hildegard of Bingen',
    excerpt: 'The willow bark cools the burning blood—useful, since the abbess refuses to cool her temper.',
    task: { id: 'l_hildegard_t', kind: 'species', target: 'SALICYLIC_ACID', text: 'Extract salicylic acid from salicin' },
    rewardRenown: 90,
    rewardAffinity: { apothecary: 30 },
  },
  {
    id: 'l_paracelsus',
    era: 'c. 1520',
    chapter: 4,
    from: 'Paracelsus, the Swiss bombast',
    excerpt: 'Sola dosis facit venenum—the dose makes the poison, and the invoice makes the physician.',
    task: { id: 'l_paracelsus_t', kind: 'recipe', target: 'DISTILL_ANTISEPTIC_ETHANOL', text: 'Distil 95% ethanol' },
    rewardRenown: 90,
    rewardAffinity: { apothecary: 25 },
  },
  {
    id: 'l_avicenna',
    era: 'c. 1020',
    chapter: 4,
    from: 'Avicenna, Canon of Medicine',
    excerpt: 'A wound untended is a funeral arranged—and the gravediggers already charge enough.',
    task: { id: 'l_avicenna_t', kind: 'treat', target: 'antiseptic', text: 'Disinfect a festering wound' },
    rewardRenown: 70,
    rewardAffinity: { apothecary: 25 },
  },
  {
    id: 'l_fleming',
    era: '1928',
    chapter: 5,
    from: 'Alexander Fleming',
    excerpt: 'Had I not been careless, I would not have noticed. Do not tell the dean.',
    task: { id: 'l_fleming_t', kind: 'recipe', target: 'CULTIVATE_PENICILLIN', text: 'Cultivate Penicillium and brew the dose' },
    rewardRenown: 130,
    rewardAffinity: { apothecary: 40 },
  },
  {
    id: 'l_florey',
    era: '1940',
    chapter: 5,
    from: 'Howard Florey, Oxford',
    excerpt: 'Make this mould into a miracle—the Ministry of Supply is already asking how many crates fit on a truck.',
    task: { id: 'l_florey_t', kind: 'treat', target: 'penicillin', text: 'Cure a systemic infection' },
    rewardRenown: 140,
    rewardAffinity: { apothecary: 35 },
  },
] as const;