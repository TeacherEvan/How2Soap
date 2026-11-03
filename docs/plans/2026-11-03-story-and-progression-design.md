# The Grand Crucible — Story Mode, Progression & Fun-Factor Design

**Date:** 2026-11-03 · **Status:** Design for review (no source changes yet) · **Repo:** `chemistry-survival` (How2Soap)
**Requested by:** owner — "levels, objectives, animations, svg icons of items, descriptions, missions/goals, and a story mode… Plan, Investigate, make this game more fun!"
**Answers locked:** plan-first · historical chemistry epic · wire the broken core · chapter questline + freeform mission board · affinity-driven direction (doctor/blacksmith-style) · minimal WebAudio SFX · wound→sepsis stakes track.

---

## 1. Investigation findings (blueprint — Step 0 of the orchestration)

### 1.1 What the game is today
A chemistry-vessel sandbox with a 5-tier checklist. The engine is genuinely strong: zero-copy `SharedArrayBuffer` worker (10 Hz sim → 60 FPS UI via atomic SeqLock), Arrhenius kinetics, latent-heat phase clamping, SID electroneutrality pH, Faraday electrolysis (`src/engine/chemistry.ts`, `src/data/reactionRules.ts`, `src/data/speciesRegistry.ts`). Around the engine, everything is cosmetic:

| Finding | Evidence |
|---|---|
| No levels / objectives / missions / story / win condition (code **or** spec) | `src/main.ts:171-174, 326-356`; spec keyword audit = 0 hits |
| Harvest button logs only; `HARVEST_PART`/`EQUIP_TOOL` defined in Command union but unhandled in worker | `src/main.ts:487-490`; `src/engine/sim.worker.ts:60-62` + `default: break` |
| `FABRICATE` consumes nothing; only `RECIPE_STITCH_BACKPACK` has an effect (unlock backpack, I_clo 1.15, 🎉) | `src/engine/sim.worker.ts:232-247` |
| **The player cannot eat.** `consumeFood()` fully written (+15% clean-utensil digestion, pathogen immunity) — never called | `src/engine/metabolism.ts` (`consumeFood`, `ConsumeFoodResult`) |
| `applySalicylicAcid` / `applyPenicillin` / `applyEthanolDisinfectant` written — never UI-reachable | `src/engine/metabolism.ts` (bottom three functions) |
| `calculateRadialHaulCostKcal` / `calculateHarvestTotalCostKcal` written — never wired | `src/data/biomeNodes.ts:478, 502` |
| Camp Ground Cache (6 slots, 150 kg) exists in engine — never rendered | `src/engine/inventory.ts:62-69`; `src/ui/ToolAndInventoryPanel.ts` |
| `hasCleanUtensil` (Bronze Fork payoff, `getEatingUtensilBonus`) written — unreachable from play | `src/engine/metabolism.ts` (`ConsumeFoodOptions`); `src/engine/fabrication.ts` (`getEatingUtensilBonus`) |
| Export save fake: hardcoded `day: 1`, `ambientTempK: 288.15`; no integrity checksum; import applies **nothing**; no IndexedDB; `state.ever` never saved | `src/main.ts:499-513, 515-519`; `src/engine/persistence.ts` |
| Zero SVG / images / icons; all glyphs are emoji/Unicode; zero CSS `@keyframes`; High-Contrast & Reduced-Motion toggles render classes **no CSS targets**; `.quest li.check` styled in markup but `.tick` is the styled class | `styles.css`; `src/ui/MenuController.ts:193-201`; `src/main.ts:353` |
| Compendium claims "256-Species" (38 actually defined); adipose/hydration/ambient missing from top bar; duplicated worker `EVENTS` post; `.game` rows 72px vs `.layout-4panel` calc(100vh−56px) | `src/ui/MenuController.ts:90`; `src/styles.css:64-69, 421-430`; `src/engine/sim.worker.ts:140-141, 223` |

### 1.2 `@DONE` — do NOT rebuild these (they only look missing)
- `consumeFood` + `ConsumeFoodResult` (incl. clean-utensil path) — `src/engine/metabolism.ts`
- Salicylic/penicillin/ethanol medicine engines — `src/engine/metabolism.ts`
- Haul-cost / harvest-cost calculators — `src/data/biomeNodes.ts:478, 502`
- `MEDICAL_CONSUMABLES` definitions (tincture / penicillin dose / disinfectant) — `src/engine/fabrication.ts`
- `INITIAL_PRIMITIVE_TOOLS`, tool-slot registry, eating-utensil bonus — `src/engine/fabrication.ts`
- Backpack unlock flow (worker FABRICATE special case + right-panel flip) — keep, extend
- `PLAYER_SYNC` inventory/tools round-trip (backpackUnlocked/bareHands/backpack/tools) — extend with `day`
- `SerializedWorldSave` gzip+base64 round-trip + tests — extend, don't replace
- Vessel chemistry (`VesselState.moles`/`precipitated` = Float64Arrays of plain data) — round-trips via JSON → full `LOAD_WORLD` restore is feasible
- Worker command union already declares `HARVEST_PART`, `FABRICATE`, `EQUIP_TOOL` — implement, don't invent a new wire
- `save → import/export` UI already in Settings modal — upgrade format, keep surface

### 1.3 `@BAN` — hard lines
- No canvas cutscenes, no web fonts, no new runtime dependencies, no art pipeline beyond inline SVG.
- No IndexedDB this pass (localStorage autosave + export/import only).
- No paddock rework (capture/cull/buy UI) and no biome depletion/ecology model — documented cuts.
- **No gating of the open sandbox** — chapter progress never locks chemistry verbs.
- No audio assets (synthesized only). Bundle: entry ≤ 200 KB (`webpack.config.js` budget, `performance.hints: 'error'`).
- Worker remains deterministic: all RNG via seeded `mulberry32`; seed persisted in save v2. No bare `Math.random()` in the worker.

### 1.4 Honest constraints
- "Levels" must not gate the chemistry sandbox — they gate the *story rail*, mission board, titles and endpoint variants only.
- Story is text overlays (prologue/epilogues/epigraphs), not video; icon art is clean line-art (`viewBox 0 0 24 24`, `stroke: currentColor`), not illustration.
- Bundle growth estimate +35–50 KB (data tables + inline SVG + systems); must hold ≤ 200 KB — verify at every phase gate, not just at the end.

---

## 2. Design overview

One fiction over everything: **The Grand Crucible** — a historical walk through chemistry's real milestones, played by a young natural philosopher apprenticed to **Magister Hennig**. Each tier of the existing tech-progression becomes a chapter anchored to a real era and figure; each major recipe/species becomes a "letter" from a historical chemist on **The Council of Chemists** mission board. Progression identity is decided by what the player actually does: **Apothecary (doctor) · Soapwright (purifier) · Forgewright (blacksmith)** — their affinity track, fed by play, determines missives, titles, and the epilogue they earn.

Phases (each ends with green `npm test` · `npm run typecheck` · `npm run build`):

| Phase | Name | Scope |
|---|---|---|
| 1 | **Core wire-up + survival stakes** | Harvest / fabricate / eat / equip + wound→sepsis ladder + joint fixes |
| 2 | **Content layer** | `src/data/items.ts` catalog (+ descriptions, tiers, affinity tags, food kcal) · `src/ui/icons.ts` inline SVG set · Compendium honesty |
| 3 | **Progression engine** | `src/engine/progression.ts` (pure) + `src/data/story.ts` (chapters, letters, affinities) + unit tests |
| 4 | **UI layer** | Boot splash · Journal & Missions tab · story overlays · banners · toasts · victory/death screens |
| 5 | **Juice + accessibility** | CSS animations, Reduced Motion + High Contrast wired to real CSS, `prefers-reduced-motion` |
| 6 | **Audio** | `src/ui/audio.ts` WebAudio synth; Master/SFX/Ambient sliders become real |
| 7 | **Persistence v2** | Save v2 + `LOAD_WORLD` restore · localStorage autosave · v1→v2 migration · SHA-256 integrity prefix · New World confirm |
| 8 | **Gates + review** | Full test matrix, bundle delta, frozen-tree review (surgical-orchestration reviewer layer), docs sync |

---

## 3. Phase 1 — Core wire-up + survival stakes

### 3.1 HARVEST_PART (worker)
On command `{ type: 'HARVEST_PART', partId, carriedMassKg, toolSlot, distanceMeters }`:
1. Look up part in `BIOME_DAG`; compute kcal cost via `calculateHarvestTotalCostKcal(part, equippedTool)` (exists, unused).
2. If `player.glucoseKcal < cost` → emit `EVENTS: [{ message: 'You are too exhausted to forage.' }]` + `PLAYER_SYNC`; return.
3. Deduct kcal from glucose (never below 0), add `yields[]` to inventory: bare hands first (12 kg / 2 slots), overflow to backpack (40 kg / 24 slots) if unlocked, else excess left behind (log).
4. Add the yielded `itemId`s into the catalog-driven inventory model (Phase 2).
5. Seeded RNG (`mulberry32`, seed from save v2): **boar hunt** (`ANIMALS.BOAR_HUNT` / parts with `promptTag: 'AURous?` — final tag: `animal_hunt`) rolls 20% → `player.conditions.woundContamination = true`, emits `EVENTS: [{ message: 'The boar's tusk opens your forearm. The wound festers.' }]`, banner flag.
6. Emit milestone event for progression layer: `{ type: 'MILESTONE', id: 'harvest:<partId>', }` event message keep-string-compatible (`'harvested:…'`) plus a structured `RECIPE_FABRICATED`-style channel (see 3.4) — one typed side-channel, not string parsing.

### 3.2 FABRICATE (worker)
Generic completion path replacing the current backpack special-case (which remains as a recipe unlock, not hard-coded branch — logic moves into data):
1. Resolve recipe from `FABRICATION_RECIPES`. **Atomic validation**: every input `{itemId, count}` must exist in inventory before any consumption (all-or-nothing).
2. Consume inputs; add outputs.
3. Apply recipe side-effects from a data table `RECIPE_EFFECTS` (new, additive): `RECIPE_STITCH_BACKPACK → unlockBackpack + clo`, `CAST_BRONZE_FORK → equip EATING_UTENSIL (via same code path as EQUIP_TOOL)`, `STACK_VOLTAIC_PILE → flag voltaicPile`, `CRAFT_PENICILLIN_DOSE → add consumable`, etc.
4. Emit `RECIPE_FABRICATED { recipeId, outputs }` → progression engine records it; toast via client.

### 3.3 EAT_FOOD (new worker command `{ type: 'EAT_FOOD', itemId }`) + DRINK deferred
- Item catalog (Phase 2) carries `foodKcal` for edible items (boar meat, cooked meat, field mushroom 38 kcal/100g, dried grain, honey? — none exists; scope to defined fauna/flora only: boar meat, field mushroom).
- Worker: remove 1 unit from inventory → `consumeFood(player, kcal, { hasCleanUtensil: inventory.tools.EATING_UTENSIL != null })`.
- UI: item rows gain an **Eat** button when `foodKcal` present (bare hands/backpack panels + Compendium tooltips).
- **Hydration** is deliberately not wired: drain is 0.05 %/h (≈ 80 days to matter); a drink button would be theater. Documented non-goal.

### 3.4 EQUIP_TOOL (worker)
`{ type: 'EQUIP_TOOL', slot, toolId }` — validates tool exists in inventory, moves into `inventory.tools[slot]` (swapping current back to hands). Bronze Fork/Spear/Axe auto-equip on fabricate (3.2). UI: 6 tool cards become clickable when inventory holds a tool for that slot (gear icon + compare mohs). Tests cover swap semantics.

### 3.5 The wound → sepsis ladder (the stakes)
Faithful to spec's unused `PlayerConditions` machinery; makes Apothecary the survivable identity for hunters.

| Stage | Trigger | Effect | Cure |
|---|---|---|---|
| Wound (`woundContamination`) | Boar harvest, 20 % seeded roll | +10 kcal/h drain, banner "The wound festers" | **Saline Rinse** (NaCl + H₂O → 1× rinse; `RECIPE_SALINE_RINSE`, available from Tier 1), **Ethanol Disinfectant** (`applyEthanolDisinfectant`) |
| Fever (`fever`) | Wound untreated 12 game-hours (worker-tracked `woundOnsetSeconds`) | +1.8 K core temp, sweat, +60-ish metabolic load; banner red | **Salicylic Tincture** (`applySalicylicAcid`, −1.8 K); or treat the wound |
| Systemic sepsis (`systemicInfection`) | Fever untreated another 24 game-hours | **+60 kcal/h** drain live (existing constant comment finally true), fever persists, warning flashes | **Penicillin Dose** only (`applyPenicillin`) |
| Death | Sepsis untreated 48 game-hours | `dead = true` → worker halts sim, posts `PLAYER_SYNC { dead, cause: 'sepsis' }`; client shows death screen (Phase 4) | None — restart |

- The ladder is deterministic given seed; timer fields (`woundOnsetSeconds`, `sepsisOnsetSeconds`) live on `player.conditions` in the SAB-adjacent heap (worker memory) and in save v2.
- One seeded RNG stream only; harvest rolls and nothing else.
- Apothecary renown: treating wound/sepsis via items grants affinity points (Phase 3) — the doctor path has teeth.
- New emergency recipe `RECIPE_SALINE_RINSE` keeps pre-Tier-4 players survivable without trivializing (20 % roll, one rinse stock per salt cache).

### 3.6 Joint / adjacent fixes (all tiny; all load-bearing for panels that ship in Phase 4)
- Duplicated `ctx.postMessage({ type: 'EVENTS' … })` in `tick()` (worker) — delete one.
- `.layout-4panel` `calc(100vh - 56px)` → `72px` to match `.game` rows.
- `.quest .tick` ↔ markup `.check` mismatch is mooted (quest panel replaced by Journal) — CSS both removed.
- `.btn-primary` undefined → define (used by Settings/MenuController) or replace usage.
- `.quest-panel`, `.layout` dead rules → delete.
- Favorite one-liners: favicon `public/favicon.svg` (△ triangle) + `<link>` in `public/index.html`.
- `256-Species` → `38-Species` label fix (MenuController) as part of Compendium honesty (Phase 2/4).

### 3.7 Camp cache visibility
Right panel gains "Camp Ground Cache (6 slots · 150 kg)" block rendering existing `inventory` cache model (move from engine to PLAYER_SYNC payload). Rain/scavenger decay: **out of scope** (documented).

---

## 4. Phase 2 — Content layer: item catalog + SVG icon set

### 4.1 `src/data/items.ts` (new)
```ts
export interface ItemDef {
  id: string;            // e.g. 'item_ash_bucket', 'item_bronze_fork'
  name: string;          // display, e.g. 'Wooden Bucket'
  category: 'tool' | 'weapon' | 'container' | 'material' | 'food' | 'medicine' | 'fuel' | 'misc';
  tier: 1 | 2 | 3 | 4 | 5;
  desc: string;          // one honest line (flavored where the fiction allows)
  icon: string;          // key into icons.ts
  mohs?: number;         // tools/weapons only
  toolSlot?: ToolSlot;   // if equippable
  foodKcal?: number;
  yieldsFrom?: string;   // recipeId or biome part id, for catalog tests
  affinity?: 'apothecary' | 'soapwright' | 'forgewright';
}
export const ITEMS: readonly ItemDef[];           // ~48 entries
export const ITEM_BY_ID: Readonly<Record<string, ItemDef>>;
```
- Every `yieldsFrom` must resolve: `FABRICATION_RECIPES` outputs and `biomeNodes` yields must map to catalog ids — **catalog-integrity unit test** enforces it (this test, not grep, is the gate).
- Medicine items (Saline Rinse, Salicylic Tincture, Penicillin Dose, Ethanol Disinfectant) get real descriptions matching `MEDICAL_CONSUMABLES`.

### 4.2 `src/ui/icons.ts` (new)
- ~52 inline SVG line-icons, `viewBox="0 0 24 24"`, `fill:none`, `stroke: currentColor`, `stroke-width:1.5`, round caps — dark-theme native, zero assets, tree-shakeable string constants.
- `export function itemIcon(id: string, size = 20): string` (falls back to a "question mark in circle" glyph for unknown ids — never throws in render).
- Coverage: tools (hammerstone, adze, axe, spear, fork, awl), materials (ash, potash, quicklime, lye, soap, bronze, copper, tin, zinc, potassium, sodium, salt, water, hide, sinew, tendon, tannin, bark, heartwood, resin), food (meat, drumstick, mushroom), medicine (salicylate vial, penicillin vial, ethanol bottle, saline rinse, disinfectant spray), backpack, cache, pile/battery, mold/culture, droplet, flame, leaf, mountain, wave, spoon.
- Emoji stays only in prose strings where it's already charming (e.g., backpack-unlocked log line); UI chrome uses icons.

### 4.3 Compendium honesty
Tabs: **Species (38)** | **Items (~48)** — Items tab is the encyclopedia (icon, name, tier badge, affinity tag, desc; live filter). Headings stop lying about 256.

---

## 5. Phase 3 — Progression engine (`src/engine/progression.ts`, pure TS, unit-tested)

```ts
export type ObjectiveKind = 'species' | 'recipe' | 'item' | 'flag' | 'eat' | 'treat';
export interface ObjectiveDef { id: string; kind: ObjectiveKind; target: string; count?: number; text: string; }
export interface ChapterDef { id, era, title, epigraph, body, objectives: ObjectiveDef[], epilogue, renown }
export interface LetterDef { id; era; chapter: number; from; quote; task: ObjectiveDef; reward { renown, affinity } ; )
export interface AffinityTrack { id: 'apothecary'|'soapwright'|'forgewright'; thresholds: [number,number,number]; titles: [string,string,string]; }
export interface ProgressionSave { renown, chapter, fabricatedRecipes: string[], objectivesDone: string[], lettersDone: string[], affinity: {apothecary,soapwright,forgewright}, ever: Record<string,boolean>, seed }
```
- `evaluateObjectives(save, view: { anySpecies(idx,minMoles):boolean; hasItem(id):boolean; }): string[]` — pure, idempotent, returns newly satisfied objective ids.Chemistry objectives key off the same `ever` pattern already in `main.ts:333-341` (rewired to engine, not duplicated).
- Renown curve (objective 25 · letter ~40–150 · chapter 150): **L1 0 · L2 150 · L3 350 · L4 600 · L5 900 · L6 1250 · L7 1650 · L8 2100 · L9 2600 · L10 3150**.
- Level titles: 1 Scrub Apprentice · 2 Firekeeper · 3 Ash-Tender · 4 Lyewright · 5 Soapwright · 6 Bronze-Hand · 7 Emberwright · 8 Willow-Sage · 9 Master of Elements · 10 Grand Chemist.
- Affinity thresholds **30 / 80 / 150** with rank titles shown in Journal: Apothecary: Leech → Apothecary → Master Apothecary · Soapwright: Raw Purifier → Purifier → Grand Purifier · Forgewright: Cinderling → Emberwright → Grand Forgewright.
- Dominant affinity = epilogue variant at Ch. VI completion (three written endings) + permanent title shown on death/victory screens.
- Letters are **era-gated** (`letter.chapter >= currentChapter`); anachronism impossible.

## 6. Story bible (six chapters)

Frame: prologue opens on a hearth, Magister Hennig's voice: *"The fire does not ask names. Remember that."* Each chapter card: era stamp, dated epigraph, 3–6 objectives, short body, completion epilogue.

| # | Title | Era / figures | Objective anchors |
|---|---|---|---|
| I | The First Fire | Neolithic, an unnamed river people | Knap flint adze · carve wooden bucket · burn heartwood to ash · stitch Leather Backpack |
| II | The Soapwright's Secret | Babylon→Rome, c. 2800 BC–77 AD (Pliny) | Causticise quicklime · settle clear lye (0.1 mol KOH) · saponify tristearin · salt-out & skim bar soap |
| III | The Bronze Bloom | Bronze Age, Tubal-cain to the Rhodian smiths | Reduce malachite & cassiterite · cast 88:12 bronze · cast Bronze Fork · equip eating utensil |
| IV | The Willow Cure | 1632–1853 (Sennert→Leroux/Piria) | Ferment & distill 95 % ethanol · hydrolyse salicin → salicylic acid · brew Salicylic Tincture · treat a fever |
| V | The Mold That Saved a War | 1928–1943 (Fleming→Florey) | Cultivate *Penicillium* · brew Penicillin Dose · cure a systemic infection |
| VI | The Voltaic Awakening | 1800–1807 (Volta→Davy) | Roast sphalerite · build lead-chamber H₂SO₄ (0.1 mol) · stack 12-cell pile · electrolyse molten salt → elemental K **or** Na → triggers ending |

Epilogue: **The Modern Laboratory** — stats (days survived, recipes fabricated, renown, affinity title), line chosen by dominant track (Master Apothecary / Grand Purifier / Grand Forgewright), options: [Continue in Free Craft] [Begin a New World].

Prose budget: prologue ~180 words; chapter body+epilogue ~90 words each; total ≤ 1 200 words. Factual, dated, no invented chemistry.

## 7. The Council of Chemists — 18 letters (freeform mission board)

Displayed as aged "letters" with era + wax seal; completed letters get stamped (`seal-stamp` animation, Phase 5). Rewards = Renown + affinity; era-gated.

**Soapwright (purification / daily life):**
1. *The River Folk (Neolithic)* — Knap a flint adze — 40 R · +20 Soapwright — Ch. I
2. *Jabir ibn Hayyan (c. 760)* — "…the ashes of hardwood hold the white stone." Settle clear lye — 60 R · +30 — Ch. II
3. *Pliny the Elder (77 AD)* — Hisha Naturalis sapones: saponify fat into true soap — 70 R · +25 — Ch. II
4. *Nicolas Lémery (1687)* — Salting-out & skim sodium stearate bar soap — 90 R · +35 — Ch. II
5. *Ibn al-Baytar (1248)* — Harvest willow phloem (salicin precursor) — 80 R · +25 (+15 Apothecary) — Ch. IV
6. *Mme Desmarest, savonnière de Marseille (c. 1791)* — Full leather-backpack pipeline (dehair→tannin→stitch) — 80 R · +30 — Ch. I/II

**Forgewright (elements / craft):**
1. *Tubal-cain (mythic, Gen. 4:22)* — "…instructor of every artifex in brass and iron." Smelt a copper ingot — 70 R · +30 Forgewright — Ch. III
2. *Theophrastus of Eresos (c. 300 BC)* — "On Stones": reduce malachite to copper — 80 R · +25 — Ch. III
3. *Caius the Rhodian smith (300 BC)* — Cast the 88:12 bronze fork — 90 R · +30 — Ch. III
4. *Georgius Agricola (1556)* — De Re Metallica: roast sphalerite, smelt zinc — 110 R · +35 — Ch. VI
5. *Alessandro Volta (1800)* — "I send you the instrument…" Stack the 12-cell pile — 120 R · +35 — Ch. VI
6. *Humphry Davy (1807)* — Electrolyse molten salt; bring me the burning metal — 150 R · +40 — Ch. VI

**Apothecary (medicine / cures):**
1. *Hippocrates (c. 400 BC)* — "First, do no harm." Administer Salicylic Tincture (cure fever) — 80 R · +25 Apothecary — Ch. IV
2. *Hildegard of Bingen (c. 1158)* — "The willow bark… cools the burning blood." Extract salicylic acid — 90 R · +30 — Ch. IV
3. *Paracelsus (c. 1520)* — "Sola dosis facit venenum." Distill 95 % antiseptic ethanol — 90 R · +25 — Ch. IV
4. *Avicenna (c. 1020)* — Canon of Medicine: disinfect a festering wound — 70 R · +25 — Ch. IV (requires wound from Ch. I+ hunts — ladder, §3.5)
5. *Alexander Fleming (1928)* — "Had I not been careless…" Cultivate *Penicillium*, brew the dose — 130 R · +40 — Ch. V
6. *Howard Florey (1940)* — "Make this mold into a miracle…" Cure a systemic infection — 140 R · +35 — Ch. V

## 8. Phase 4 — UI layer

- **Boot splash** (replaces silent auto-boot): if autosave exists → `The Grand Crucible` splash: [Continue — Day N · Ch. Title] [New World] + renown/title; else straight into prologue overlay. (Spec's missing "Continue" delivered; full FSM still out.)
- **Workbench tab 4→5:** add `📖 Journal & Missions` tab. Layout: left column = chapter timeline (locked/current/done states, epigraph quote, objective checklist, chapter-complete stamp); right column = affinity meters (3 bars with rank titles) + **The Council of Chemists** letter cards (state: Locked(chapter n)/Available/Claimed). Letters render with era + figure + 2-line excerpt + reward line; stamp on claim.
- **Top bar additions:** Renown chip with animated SVG progress ring (level number centered, tooltip "Renown: x / next-level"); inline **condition banners** under the bar: `🩸 Ravenous` `🥶 Shivering!` `🌡 Fever 38.6°` `🧫 Sepsis!` `🩹 Wound festering` — colored chips, appear/disappear live off `conditions`.
- **Right panel:** camp-cache block + **Treatments card** (visible only when a condition active): shows held meds with [Administer] (antisepsis/tincture/penicillin) + saline/ethanol when wound only.
- **Item affordances:** bare-hands/backpack slots render icon + name; hover tooltip = desc + tier + affinity; food items get [Eat]; backpack banner references icons not text.
- **Compendium:** two tabs (Species 38 | Items), live filter, per-item icon.
- **Toasts** (bottom-right, stacked, auto-dismiss 3.5 s, cap 3): objective complete, letter claimed, level up, chapter complete, wound warning. Queue, never overlap log panel.
- **Victory screen** (Ch. VI epilogue): overlay with stats grid + affinity epilogue + [Continue in Free Craft] [New World].
- **Death screen:** dark-red overlay, cause-specific elegy (sepsis today; starvation/hypothermia variants trivial to add via same modal), stats, [Rise Again — New World]. Sim halts (worker `dead=true`).

## 9. Phase 5 — Juice + accessibility

One `styles.css` set (≈ +120 lines), no JS animation loops:
```
@keyframes toast-in, reward-float (+N Renown rises/fades), level-shimmer, seal-stamp (scale 2→1 rotate),
objective-pulse, slot-flash, caret-blink (typewriter), fade-up (story cards), modal-pop, ring-fill (dashoffset transition)
button:hover already exists; add active:scale(.96)
```
- Persist `reducedMotion` / `highContrast` / textScale in save + localStorage; **they finally target real CSS**: `.reduced-motion *, *::before, *::after { animation: none !important; transition: none !important; }` and a 7:1 high-contrast palette; `@media (prefers-reduced-motion: reduce)` mirrors the toggle default.
- `Seal-stamp` fires on letter claim/chapter complete (sound in Phase 6).

## 10. Phase 6 — Audio (synthesized, wired)

`src/ui/audio.ts` — `AudioContext` lazily on first gesture; `master/sfx/ambient` GainNodes bound to existing Settings sliders (dB maps 0–100 → 0–1 → gain). Synthesized (no assets): `sfx.thud` (lowpass noise burst — harvest), `sfx.clink` (short square blip — knap/fabricate), `sfx.chime` (sine triad — objective), `sfx.level` (3-note arpeggio), `sfx.munch` (two filtered clicks), `sfx.stamp` (noise+lowpass thump), `sfx.toll` (low bell — death), ambient `crackle` (random-interval filtered noise, gain by ambient slider) — total ≈ 120 lines. Mute honoured; sliders were already there.

## 11. Phase 7 — Persistence v2 + `LOAD_WORLD`

- **Save v2** (`version: 2`): v1 fields + `rngSeed`, `player.conditions` (+`woundOnsetSeconds`, `sepsisOnsetSeconds`), `ever`, `renown`, `affinity{apothecary,soapwright,forgewright}`, `chapter` (index), `fabricatedRecipes[]`, `objectivesDone[]`, `lettersDone[]`, `epilogueSeen`, `day` (real — `PLAYER_SYNC` gains `day` from `world.tick`: `day = 1 + floor(tick / 240)` at 6 sim-min/step... exact factor computed from `WORKER_HZ`×360 s and a `DAY_TICKS` constant; both documented in code).
- **`LOAD_WORLD`** command: `InitPayload { sab, save }`; worker rebuilds `WorldState` (vessels' `moles`/`precipitated` → `Float64Array` — JSON-clean), `simSeconds`, `tick`, player state + conditions/onset timers, rng state; then posts `VESSELS`/`PLAYER_SYNC`/`EVENTS` as usual. Continue is **full-fidelity** (lye mid-digestion survives reload — vessels persist thermally exactly as saved).
- **Migration**: `migrateSave(raw)` — v1 → v2: fill defaults (`renown 0`, `chapter 0`, empty arrays, `ever false`s, `rngSeed = (Math.random()*2**32)>>>0`), keep `day: save.day ?? 1`. Unit tests for both paths + checksum-accept/reject.
- **Checksum**: export string `sha256:<hex>:<b64-gzip>`; import verifies (WebCrypto `crypto.subtle.digest`); legacy bare-base64 accepted with a console warning (migration courtesy).
- **Autosave**: debounced 2 s after `EVENTS`/`PLAYER_SYNC` mutations + on `visibilitychange`; key `how2soap.save.v2`; [New World] and [Continue] wired to splash; New World on existing save → confirm modal (destructive).
- IndexedDB remains a documented follow-up (`chem_world_v1` comments removed to stop lying).

## 12. Testing plan

New Vitest suites (target ~25+ new assertions, zero changes to existing expectations):
- `tests/items.test.ts` — catalog integrity: every recipe output & biome yield resolves to a catalog id + icon key exists; `foodKcal>0 ⇒ category food`; tier ∈ 1–5.
- `tests/progression.test.ts` — evaluator: species/recipe/item/flag/eat/treat kinds; idempotence; renown thresholds & level-ups; affinity dominant; letter era-gating; chapter unlock.
- `tests/storyCompleteness.test.ts` — every chapter's objectives resolvable; every letter maps to a real recipe/species/flag; 18 letters × affinity sums = correct; eras monotonic.
- `tests/persistenceV2.test.ts` — round-trip with conditions/ever/seed/progress; v1→v2 migration; checksum ok/fail.
- `tests/fabricationConsume.test.ts` — atomic validation (insufficient input → no partial consumption), backpack path parity, fork auto-equip, saline recipe.
- `tests/worldRestore.test.ts` — `LOAD_WORLD` rebuild: vessels' moles/pH identical pre/post serialise; tick/day continuity; RNG continuity (same seed + same rolls → same wound/no-wound).
- RNG determinism test for contamination roll (seeded; forced-sequential).

Gates per phase: `npm test` · `npx tsc --noEmit` · `npm run build` (record entry size; must stay ≤ 200 KB — expect ≈ 120–135 KB total headroom).

## 13. Execution strategy (surgical-orchestration, later)

Single tightly-coupled product → **build directly / serially, do not fan out** (per 2026-08-13 generator-collision scar). Contract-first order: `types (Phase 2/3) → engine (1, 3, 7) → UI (4–6) → gates (8)`. If parallelism is ever desired it must stop at phase boundaries (workers never share `src/main.ts`, `styles.css`, `items.ts` in the same batch — they are shared across every scope). Dispatch = Worker/Verifier per phase with 180 s timeouts, debrief SHA-256 loop-guard, frozen tree before review; `--review` layer post-build (FRONTEND/BACKEND lanes). Docs to touch: `README.md` (badges not lied about — real test count, 38-species, new tabs), `docs/plans/` blueprint updates.

## 14. Explicit non-goals
Canvas cutscenes · web fonts · IndexedDB · paddock rework · ecology depletion/restock · hydration-drink mechanic · cooking/roasting as new chemistry · gender/pronoun customisation · localisation · achievements beyond letters · mobile layout redesign · changing SAB layout · changing species indices (append-only contract).

## 15. Risks & mitigations
- **Bundle creep** → size check at every gate; if > 200 KB: icons collapse to 16 px subset + defer letters' prose cuts (never cut gates).
- **Objective brittleness** → kinds species/item/flag only, tolerances in tests; no string parsing of log events.
- **Sepsis unfairness** → 20 % roll, Saline Rinse baseline cure; ethanol/penicillin at Tier 4 are the "right" cures; 48 h systemic fuse; prior warning banners.
- **RNG desync on reload** → seed + consumption order persisted (v2); restore test asserts it.
- **v1 save corruption** → migration is additive-with-defaults; round-trip tests both versions; checksum prevents silent bad imports.
- **Hand-authored icon defects** → catalog/icon test; review pass; fallback glyph never throws.
- **Verifier/Worker scope thrash** → strict one-phase-at-a-time; no shared files within a batch; orchestrator builds directly.

## 16. Self-audit — "Is that the best you can do?"
- Fun without redesigning the engine: **yes** — closed the starvation loop (eat), consequence loop (sepsis), identity loop (affinity), and arrival/reward loops (letters/renown/stamps/sounds).
- Respects the spec where feasible (Continue splash, SHA-256, accessibility toggles, ambience) without rebuilding it.
- Every "unlocked Epic" claim maps to a real, testable state change — nothing is a badge on an empty function.
- Honest cuts documented; determinism preserved; no new deps; one new fictional character (Magister Hennig), zero invented chemistry.
- Weak spots admitted: no Playwright suite in-repo (verify manually on dev server), no IndexedDB, paddock static — all explicitly deferred, not forgotten.

## 17. Open review questions for the owner
1. Affinity naming/voice — "Soapwright/Apothecary/Forgewright" ok, or prefer "Purifier/Doctor/Smith"?
2. Saline-rinse accessibility (Tier 1 cure) — keep, or make ethanol the only cure (harder, more historically strict)?
3. Renown level-cap 10 — or visible infinite scaling?
4. Commit this doc on `main` (docs-only) now?
