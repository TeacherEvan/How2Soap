/**
 * Item Catalog — The Grand Crucible
 *
 * Every carryable, harvestable, craftable or consumable object in the game lives
 * here. Vessel-only chemistry (molten salts, aqueous lyes, fermentation liquors)
 * is deliberately NOT present: those are vessel contents (world.vessels / SAB
 * moles), never inventory slots — see `VESSEL_ONLY_IDS` in tests/items.test.ts.
 * Vessels/molds/apparatus as physical objects (bucket, trough, ceramic vessel,
 * electrolysis cell, voltaic pile) ARE items; their contents are not.
 */
import type { ToolSlotKey } from '../engine/fabrication';

export type ItemAffinity = 'apothecary' | 'soapwright' | 'forgewright';
export type ItemCategory = 'tool' | 'weapon' | 'container' | 'material' | 'food' | 'medicine' | 'misc';

export interface ItemDef {
  readonly id: string;
  readonly name: string;
  readonly category: ItemCategory;
  readonly tier: 1 | 2 | 3 | 4 | 5;
  readonly desc: string;
  readonly icon: string;          // key into src/ui/icons.ts ICONS
  readonly mohs?: number;
  readonly toolSlot?: ToolSlotKey;
  readonly foodKcal?: number;     // per 1 unit consumed
  readonly affinity?: ItemAffinity;
}

export const ITEMS: readonly ItemDef[] = [
  // ---- Tools & weapons ----
  { id: 'RIVER_HAMMERSTONE', name: 'River Hammerstone', category: 'tool', tier: 1, icon: 'hammerstone', mohs: 6.5, toolSlot: 'PERCUSSION_MINING', desc: 'Smooth river cobble; the first percussion you will ever own.' },
  { id: 'FLINT_FLAKE_BLADE', name: 'Flint Flake Blade', category: 'tool', tier: 1, icon: 'blade', mohs: 7.0, toolSlot: 'CUTTING_SKINNING', desc: 'Knapped edge, sharper than obsidian, quicker to dull.' },
  { id: 'FLINT_ADZE', name: 'Flint Adze', category: 'tool', tier: 1, icon: 'adze', mohs: 7.0, toolSlot: 'CHOPPING_CARVING', desc: 'Flint bit lashed to a haft; the adze that opens every log.' },
  { id: 'BONE_AWL', name: 'Bone Awl', category: 'tool', tier: 1, icon: 'awl', mohs: 2.5, toolSlot: 'STITCHING_MEDICAL', desc: 'A honed femur needle; pierces hide, sutures skin.' },
  { id: 'BRONZE_SPEAR', name: 'Bronze Spear', category: 'weapon', tier: 3, icon: 'spear', mohs: 3.5, toolSlot: 'CUTTING_SKINNING', affinity: 'forgewright', desc: 'Cast 88:12 bronze head on a shaft; out-ranges the boar by miles.' },
  { id: 'BRONZE_AXE', name: 'Bronze Axe', category: 'tool', tier: 3, icon: 'axe', mohs: 3.5, toolSlot: 'CHOPPING_CARVING', affinity: 'forgewright', desc: 'Heavy bronze celt on a hardwood haft; MA 2.5, splits heartwood cold.' },
  { id: 'BRONZE_FORK', name: 'Bronze Fork', category: 'tool', tier: 3, icon: 'fork', mohs: 3.5, toolSlot: 'EATING_UTENSIL', affinity: 'forgewright', desc: '88:12 bronze tines; eating with it digests +15% cleaner and burns nothing.' },

  // ---- Containers & apparatus (physical objects; their contents are vessels, not items) ----
  { id: 'WOODEN_BUCKET', name: 'Wooden Bucket', category: 'container', tier: 1, icon: 'bucket', desc: 'Hollowed pine 5 L bucket; T_max 523 K — your first chemical vessel.' },
  { id: 'WOODEN_TROUGH', name: 'Wooden Tanning Trough', category: 'container', tier: 1, icon: 'trough', desc: '10 L dugout trough; dehairs hides in lye, steeps them in tannin.' },
  { id: 'LEATHER_BACKPACK', name: 'Leather Backpack', category: 'container', tier: 2, icon: 'backpack', desc: 'Vegetable-tanned pack; 24 slots, 40 kg, I_clo 1.15.' },
  { id: 'FIRED_CERAMIC_VESSEL', name: 'Fired Ceramic Vessel', category: 'container', tier: 2, icon: 'pot', desc: 'Kaolin fired at 1373 K; the lead/ceramic pot electrolysis is born in.' },
  { id: 'ELECTROLYSIS_CELL', name: 'Electrolysis Cell', category: 'container', tier: 4, icon: 'cell', affinity: 'forgewright', desc: 'Lead-lined ceramic cell with carbon electrodes; where elements are freed.' },
  { id: 'SOAPSTONE_MOLD', name: 'Soapstone Mold', category: 'misc', tier: 2, icon: 'mold', affinity: 'forgewright', desc: 'Refractory two-part casting mold; every bronze in your life passes through it.' },
  { id: 'VOLTAIC_PILE_BATTERY', name: 'Voltaic Pile Battery', category: 'misc', tier: 4, icon: 'pile', affinity: 'forgewright', desc: 'Twelve Cu/Zn cells, 13.2 V DC; the engine of the voltaic awakening.' },

  // ---- Food ----
  { id: 'MEAT_RAW', name: 'Fresh Game Meat', category: 'food', tier: 1, icon: 'meat', foodKcal: 1650, desc: 'Lean boar meat, 14 kg dressed; keeps a survivor fed for days.' },
  { id: 'FIELD_MUSHROOM', name: 'Edible Mushroom', category: 'food', tier: 1, icon: 'mushroom', foodKcal: 55, desc: 'Porcini-kin; 22 kcal per 100 g raw, eaten cap by cap.' },
  { id: 'GRAIN_MASH', name: 'Grain Mash', category: 'food', tier: 1, icon: 'mash', foodKcal: 900, desc: 'Maple sap cooked with grain; eats like porridge, brews like potential.' },

  // ---- Medicine ----
  { id: 'WILLOW_BARK', name: 'Willow Bark', category: 'medicine', tier: 1, icon: 'willow', affinity: 'apothecary', desc: 'Inner phloem rich in salicin; chew for pain, decoct for fever.' },
  { id: 'SALICYLIC_ACID_TINCTURE', name: 'Salicylic Acid Tincture', category: 'medicine', tier: 4, icon: 'vial', affinity: 'apothecary', desc: 'Willow-bark febrifuge; −1.8 °C of fever, bottled and brown.' },
  { id: 'PENICILLIN_DOSE', name: 'Penicillin Dose', category: 'medicine', tier: 4, icon: 'penicillin', affinity: 'apothecary', desc: 'Mold-born antibiotic; knocks one lethal sepsis straight off its feet.' },
  { id: 'ETHANOL_DISINFECTANT', name: 'Ethanol Disinfectant', category: 'medicine', tier: 4, icon: 'ethanol', affinity: 'apothecary', desc: '95% spirit; sterilizes a wound plain and simple.' },
  { id: 'SALINE_RINSE', name: 'Saline Rinse', category: 'medicine', tier: 2, icon: 'saline', desc: 'Salt of the earth in water; the cheapest clean wound there is.' },
  { id: 'PENICILLIUM_SPORES', name: 'Penicillium Spores', category: 'medicine', tier: 3, icon: 'spores', affinity: 'apothecary', desc: 'Wind-borne green dust; the seed of every penicillin brew.' },
  { id: 'PENICILLIUM_BROTH', name: 'Penicillium Mold Broth', category: 'medicine', tier: 3, icon: 'culture', affinity: 'apothecary', desc: 'Foraged moldy liquor, 0.5 kg; the antibiotic age starts in this jar.' },
  { id: 'PENICILLIUM_MOLD_CULTURE', name: 'Penicillium Mold Culture', category: 'medicine', tier: 3, icon: 'culture', affinity: 'apothecary', desc: 'Starter of P. chrysogenum on cooked starch; feed grain and buffer, wait 48 ticks.' },

  // ---- Materials: wood & flora ----
  { id: 'LOG_WHITE_OAK', name: 'White Oak Log', category: 'material', tier: 1, icon: 'log', desc: 'Dense heartwood; seasons into charcoal and hardwood ash.' },
  { id: 'LOG_SCOTS_PINE', name: 'Pine Softwood Log', category: 'material', tier: 1, icon: 'log', desc: 'Low-density softwood; carves buckets, troughs and hafts.' },
  { id: 'WHITE_OAK_BARK', name: 'White Oak Bark', category: 'material', tier: 1, icon: 'bark', affinity: 'soapwright', desc: 'Soaked in water it yields the tannin that sets hide into leather.' },
  { id: 'PINE_DEADFALL_WOOD', name: 'Dry Pine Kindling', category: 'material', tier: 1, icon: 'kindling', desc: 'Deadfall branches, dry to the marrow; lights every first fire.' },
  { id: 'PINE_SHAVINGS', name: 'Pine Shavings', category: 'material', tier: 1, icon: 'shavings', desc: 'Curly tinder from bucket-carving; catches a spark from pyrite.' },
  { id: 'OLEORESIN', name: 'Pine Oleoresin', category: 'material', tier: 1, icon: 'resin', desc: 'Sticky pine resin; adhesive, waterproofing and lamp fuel.' },
  { id: 'WOOD_BRANCH', name: 'Sturdy Branch', category: 'material', tier: 1, icon: 'branch', desc: 'Straight haft branch; the spine of every adze and spear.' },

  // ---- Materials: stone & earth ----
  { id: 'FLINT_NODULE', name: 'Flint Nodule', category: 'material', tier: 1, icon: 'flint', desc: 'Hard silica nodule; conchoidal fracture yields razor flakes.' },
  { id: 'FLINT_ADZE_HEAD', name: 'Flint Adze Head', category: 'material', tier: 1, icon: 'flint', desc: 'Knap nodule into an adze bit; awaits a branch and sinew lashings.' },
  { id: 'RAW_KAOLIN_CLAY', name: 'Raw Kaolin Clay', category: 'material', tier: 1, icon: 'clay', desc: 'White firing clay; 1373 K turns soft lumps into ringing pots.' },
  { id: 'LIMESTONE_ROCK', name: 'Limestone Rock', category: 'material', tier: 1, icon: 'rock', desc: 'CaCO3 outcrop; three clicks above 1100 K it becomes quicklime.' },
  { id: 'HALITE_SALT', name: 'Halite Salt', category: 'material', tier: 1, icon: 'halite', desc: 'NaCl mineral; salts out hard bar soap and cleans fresh wounds.' },
  { id: 'SOAPSTONE_BLOCK', name: 'Soapstone Block', category: 'material', tier: 1, icon: 'soapstone', mohs: 1.5, desc: 'Soft talc-schist, Mohs 1.5; carves like cold butter into molds.' },
  { id: 'SOAPSTONE_CHUNK', name: 'Soapstone Chunk', category: 'material', tier: 1, icon: 'soapstone', mohs: 1.5, affinity: 'forgewright', desc: 'Fist-sized soapstone offcut; the two-part mold starts here.' },
  { id: 'CHARCOAL', name: 'Hardwood Charcoal', category: 'material', tier: 1, icon: 'charcoal', desc: 'Oak pyrolyzed airless; reductant for every carbothermic smelt.' },

  // ---- Materials: metals & minerals ----
  { id: 'MALACHITE_ORE', name: 'Malachite Ore', category: 'material', tier: 2, icon: 'ore', affinity: 'forgewright', desc: 'Cu2CO3(OH)2, Mohs 3.5; smelted with charcoal into copper.' },
  { id: 'CASSITERITE_ORE', name: 'Cassiterite Ore', category: 'material', tier: 2, icon: 'ore', affinity: 'forgewright', desc: 'SnO2, Mohs 6.0; the tin that turns copper into bronze.' },
  { id: 'SPHALERITE_ORE', name: 'Sphalerite Ore', category: 'material', tier: 2, icon: 'sphalerite', affinity: 'forgewright', desc: 'ZnS, Mohs 3.8; roast it, then smelt the ZnO to zinc metal.' },
  { id: 'PYRITE_ORE', name: 'Pyrite Ore', category: 'material', tier: 2, icon: 'pyrite', desc: 'FeS2, fool’s gold; strikes sparks, roasts to SO2 for chamber acid.' },
  { id: 'SALTPETER_CRYSTALS', name: 'Saltpeter Crystals', category: 'material', tier: 2, icon: 'saltpeter', affinity: 'forgewright', desc: 'KNO3 efflorescence; the oxidizer a lead chamber cannot live without.' },
  { id: 'COPPER_INGOT', name: 'Copper Ingot', category: 'material', tier: 3, icon: 'ingot', affinity: 'forgewright', desc: 'Refined copper from reduced malachite; 88 parts of every bronze.' },
  { id: 'TIN_INGOT', name: 'Tin Ingot', category: 'material', tier: 3, icon: 'ingot', affinity: 'forgewright', desc: 'Refined tin from cassiterite; the 12 that makes bronze sing.' },
  { id: 'ZINC_METAL', name: 'Zinc Metal', category: 'material', tier: 4, icon: 'zinc', affinity: 'forgewright', desc: 'Bluish-white metal; the anode of every voltaic pile worth building.' },
  { id: 'ZINC_DISCS', name: 'Zinc Discs', category: 'material', tier: 4, icon: 'disc', affinity: 'forgewright', desc: 'Cast zinc discs, twelve to an ingot; one disc per cell, per pile.' },
  { id: 'SODIUM_METAL', name: 'Sodium Metal', category: 'material', tier: 5, icon: 'sodium', affinity: 'forgewright', desc: 'Silvery metal, water-reactive; Davy coaxed it from molten NaOH, 1807.' },
  { id: 'POTASSIUM_METAL', name: 'Potassium Metal', category: 'material', tier: 5, icon: 'potassium', affinity: 'forgewright', desc: 'Softer than sodium, quicker than thought; the first prize of the pile.' },
  { id: 'CARBON_ELECTRODES', name: 'Carbon Electrodes', category: 'material', tier: 4, icon: 'electrode', affinity: 'forgewright', desc: 'Baked carbon rods; carry the current into the molten salt.' },
  { id: 'TUYERE_PIPE', name: 'Tuyere Blast Pipe', category: 'misc', tier: 3, icon: 'tuyere', affinity: 'forgewright', desc: 'Clay blast pipe; forced-draft breath for crucibles and piles.' },

  // ---- Materials: animal & leather ----
  { id: 'RAW_ADIPOSE_FAT', name: 'Raw Adipose Fat', category: 'material', tier: 1, icon: 'fat', affinity: 'soapwright', desc: 'Rendered with lye it becomes soap; eaten, dense calories.' },
  { id: 'RAW_MEDIUM_HIDE', name: 'Medium Raw Hide', category: 'material', tier: 1, icon: 'hide', desc: '4 kg boar hide, hair intact; dehair in ash lye before tanning.' },
  { id: 'DEHAIRED_HIDE', name: 'Dehaired Collagen Hide', category: 'material', tier: 1, icon: 'hide', affinity: 'soapwright', desc: 'Follicles loosened in pH-11 soak; collagen bare and ready for tannin.' },
  { id: 'VEGETABLE_TANNED_LEATHER', name: 'Vegetable-Tanned Leather', category: 'material', tier: 2, icon: 'leather', affinity: 'soapwright', desc: 'Tannin cross-linked and rot-proof; the backpack is cut from it.' },
  { id: 'LEATHER_SCRAP', name: 'Leather Scrap', category: 'material', tier: 1, icon: 'leather', affinity: 'soapwright', desc: 'Offcut from the cutting table; soaks up acid between pile cells.' },
  { id: 'DEER_SINEW', name: 'Animal Sinew Cordage', category: 'material', tier: 1, icon: 'sinew', desc: 'Dried sinew, split and twisted; the thread no awl ever broke.' },
  { id: 'ANIMAL_BONE', name: 'Heavy Femur Bone', category: 'material', tier: 1, icon: 'bone', desc: 'Boar femur, dense as antler; one good awl hides inside it.' },
];

export const ITEM_BY_ID: Readonly<Record<string, ItemDef>> = Object.freeze(
  Object.fromEntries(ITEMS.map(i => [i.id, i])),
);
export const FOOD_ITEM_IDS: readonly string[] = Object.freeze(ITEMS.filter(i => i.foodKcal).map(i => i.id));
