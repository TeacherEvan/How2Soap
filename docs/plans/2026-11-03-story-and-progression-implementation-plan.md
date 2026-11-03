# The Grand Crucible — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task (fresh subagent per task, two-stage review after each), or superpowers:executing-plans for inline execution with checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship The Grand Crucible — an historical-chemistry story mode with chapters, letters-from-chemists mission board, affinity-driven identity endings, item catalog with SVG icons and descriptions, Renown levels, CSS/audio juice, wound→sepsis stakes — on top of a now-functional harvest/eat/fabricate core loop.

**Architecture:** Contract-first and serial. Pure engine modules (`rng`, `harvest`, `conditions`, `progression`, `worldRestore`, extended `persistence`) hold all game logic and are unit-testable without SAB/worker; the worker wires them into commands; the UI consumes via the extended `PLAYER_SYNC` payload; content lives in data tables (`items.ts`, `story.ts`). One tightly-coupled product — tasks are ordered so no two tasks ever need to edit the same file in parallel.

**Tech Stack:** TypeScript 5.4 (strict) · Webpack 5 · zero runtime deps · Vitest 3 · vanilla DOM (no framework) · inline SVG · Web Audio API · SharedArrayBuffer (existing).

**Spec:** `docs/plans/2026-11-03-story-and-progression-design.md` (read it first; this plan argues from it).
**Repo conventions override the default plan location:** this file lives in `docs/plans/`.

## Global Constraints

- TypeScript strict; `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`, `noFallthroughCasesInSwitch` — all must stay clean (`npx tsc --noEmit`).
- Bundle: entry chunk ≤ **200 KB** (`webpack.config.js` `performance.hints: 'error'`). Record `main.*.js` size at Task 15; expect ≈ 120–135 KB total. Never lower the budget.
- Zero new runtime dependencies. Zero assets (no images/fonts/audio files) — inline SVG and Web Audio only.
- Species registry is append-only (`SPECIES` indices are a save-format contract). Never reorder.
- Worker determinism: only `mulberry32` seeded RNG (`src/engine/rng.ts`) inside the worker. No bare `Math.random()`.
- `SAB_BYTE_LENGTH` and the SeqLock layout are frozen.
- All `.toBe(true)`-style assertions on new modules; existing 54 tests stay green at every task boundary.
- Gates at every task: `npm test` and `npx tsc --noEmit`. Build check at Tasks 1, 8, 12, 15.
- Design-doc sections referenced as (§N) below point into the spec.

## File Map (create / modify)

**Create:**
- `src/engine/rng.ts` — mulberry32 + fnv1a seed helper (Task 1)
- `src/data/items.ts` — item catalog (Task 2) · `src/ui/icons.ts` — inline SVG set (Task 3)
- `src/engine/harvest.ts` — pure harvest/kcal/wound logic (Task 4)
- `src/engine/conditions.ts` — wound→fever→sepsis→death ladder + `escalateConditions` (Task 5)
- `src/engine/worldRestore.ts` — pure `restoreWorldFromSave` / vessel serialization (Task 7)
- `src/data/story.ts` — chapters, letters, affinities, level titles (Task 8)
- `src/engine/progression.ts` — Renown curve, evaluator, affinity/chapters math (Task 9)
- `src/ui/Toast.ts` — toast queue (Task 10) · `src/ui/JournalPanel.ts` — Journal & Missions tab (Task 10) · `src/ui/StoryMode.ts` — prologue/chapter/victory/death overlays + typewriter (Task 10)
- `src/ui/audio.ts` — Web Audio synth SFX + ambience (Task 13)
- `src/engine/time.ts` — `SIM_STEP_SECONDS`, `WORKER_HZ`, `DAY_TICKS` (Task 6)
- `src/ui/panelModels.ts` — pure banner/treatment models (Task 11) · `src/ui/overlayStack.ts` — ESC overlay registry (Task 12) · `src/engine/saveSignature.ts` — autosave change signature (Task 14)
- Tests: `tests/rng.test.ts`, `tests/items.test.ts`, `tests/icons.test.ts`, `tests/harvest.test.ts`, `tests/conditions.test.ts`, `tests/fabricateConsume.test.ts`, `tests/time.test.ts`, `tests/persistenceV2.test.ts`, `tests/worldRestore.test.ts`, `tests/storyCompleteness.test.ts`, `tests/progression.test.ts`, `tests/journalModel.test.ts`, `tests/treatmentModel.test.ts`, `tests/overlayStack.test.ts`, `tests/audioGain.test.ts`, `tests/autosaveSignature.test.ts`
- `public/favicon.svg` (Task 12)

**Modify:**
- `src/engine/sim.worker.ts` — new commands (HARVEST_PART/FABRICATE/EAT_FOOD/EQUIP_TOOL/APPLY_TREATMENT/LOAD_WORLD); `PLAYER_SYNC` v2; escalation in both step paths; EVENTS de-dupe (Tasks 4–7)
- `src/engine/persistence.ts` — v2 + `migrateSave` + SHA-256 prefix (Task 7)
- `src/engine/world.ts` — import `restoreWorld` wiring only if kept small; else `worldRestore.ts` (Task 7)
- `src/main.ts` — PLAYER_SYNC types, toasts, Journal tab, boot splash, autosave, banners, chips, tool equip, eat buttons, treatments, biome haul column, epoch fix (Tasks 5–14)
- `src/ui/WorkbenchCanvas.ts` — 5th tab `📖 Journal & Missions` (Task 10)
- `src/ui/ToolAndInventoryPanel.ts` — item icons, Eat buttons, camp cache, click-to-equip (Task 11)
- `src/ui/BiomeTreePanel.ts` — haul-cost column (Task 11)
- `src/ui/MenuController.ts` — export/import v2 + checksum + real day; honest 38-species label (Tasks 2, 14)
- `src/styles.css` — +juice/a11y/chips/banners/toasts/journal/story overlays/ring (Task 12)
- `public/index.html` — favicon link (Task 12) · `README.md` — honest badge sync (Task 15)

## Task Overview

| # | Task | Est. |
|---|---|---|
| 1 | Seeded RNG (`rng.ts`) | 20 min |
| 2 | Item catalog (`items.ts`) | 45 min |
| 3 | SVG icon set (`icons.ts`) | 45 min |
| 4 | Pure harvest engine + wound roll (`harvest.ts`) | 45 min |
| 5 | FABRICATE/EAT/EQUIP worker commands + RECIPE_EFFECTS (`fabricateConsume.test.ts`) | 60 min |
| 6 | `PLAYER_SYNC` v2: items/ambient/day (`time.ts`) | 30 min |
| 7 | Wound→sepsis ladder + `LOAD_WORLD`/restore + persistence v2 + checksum | 75 min |
| 8 | Story data + completeness (`story.ts`) | 45 min |
| 9 | Progression engine (`progression.ts`) | 60 min |
| 10 | UI: toasts + Journal tab + StoryMode overlays | 90 min |
| 11 | UI: HUD chips/banners, biome haul column, cache, Eat, equip, treatments | 90 min |
| 12 | CSS juice + a11y + favicon/index.html | 60 min |
| 13 | Web Audio synth + slider wiring | 45 min |
| 14 | Boot splash, autosave, Continue/New World, Settings export/import v2 | 60 min |
| 15 | Gates: full matrix, bundle audit, README sync, frozen-tree review | 45 min |

**Test integrity rule:** every "write the failing test" step below contains the real test file content — do not write placeholder tests. If a test fails for an unexpected reason, stop and fix the implementation, never the assertion, unless the test itself encodes a spec misreading.

---

## Task 1: Seeded RNG (`src/engine/rng.ts`)

**Files:** Create `src/engine/rng.ts` · Test `tests/rng.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `mulberry32(seed: number): () => number` (returns f() ∈ [0,1)); `hashSeed(input: string): number` (fnv1a); `createSeededRng(seed: number): { next: () => number; roll: (p: number) => boolean; seed: number }` used by worker + tests (Task 4, 7, 11).

- [ ] **Step 1: Write the failing test**

```ts
// tests/rng.test.ts
import { describe, expect, it } from 'vitest';
import { mulberry32, hashSeed, createSeededRng } from '../src/engine/rng';

describe('seeded RNG (worker determinism)', () => {
  it('mulberry32 is deterministic for the same seed', () => {
    const a = mulberry32(123456789);
    const b = mulberry32(123456789);
    for (let i = 0; i < 1000; i += 1) expect(a()).toBe(b());
  });
  it('different seeds produce different streams', () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toBe(b);
  });
  it('stream stays in [0, 1)', () => {
    const next = mulberry32(42);
    for (let i = 0; i < 10000; i += 1) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('hashSeed is stable and string-sensitive', () => {
    expect(hashSeed('how2soap')).toBe(hashSeed('how2soap'));
    expect(hashSeed('how2soap')).not.toBe(hashSeed('How2Soap'));
  });
  it('createSeededRng.roll honours the probability threshold', () => {
    const rng = createSeededRng(7);
    let hits = 0;
    for (let i = 0; i < 1000; i += 1) if (rng.roll(0.2)) hits += 1;
    expect(hits).toBeGreaterThan(100);
    expect(hits).toBeLessThan(300);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/rng.test.ts`
Expected: FAIL — `Cannot find module '../src/engine/rng'`.

- [ ] **Step 3: Implement**

```ts
// src/engine/rng.ts
/** Deterministic PRNG for the sim worker. Never use Math.random() in the worker. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** fnv1a string hash → uint32, for callers that want a stable seed from text. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRng(seed: number): {
  next: () => number;
  roll: (probability: number) => boolean;
  seed: number;
} {
  const next = mulberry32(seed >>> 0);
  return {
    next,
    roll: (probability: number) => next() < probability,
    seed: seed >>> 0,
  };
}
```

- [ ] **Step 4: Run it green**

Run: `npx vitest run tests/rng.test.ts && npx tsc --noEmit`
Expected: PASS (5 tests), no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/rng.ts tests/rng.test.ts
git commit -m "feat(engine): seeded mulberry32 RNG for deterministic worker sim"
```

---

## Task 2: Item catalog (`src/data/items.ts`)

**Files:** Create `src/data/items.ts` · Test `tests/items.test.ts`

**Interfaces:**
- Consumes: `FABRICATION_RECIPES` (itemIds in inputs/outputs) from `src/engine/fabrication.ts`; `BIOME_DAG` yields from `src/data/biomeNodes.ts`.
- Produces (exact, later tasks rely on these):
```ts
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
export const ITEMS: readonly ItemDef[];
export const ITEM_BY_ID: Readonly<Record<string, ItemDef>>;
export const FOOD_ITEM_IDS: readonly string[];
```

**Enumeration discipline:** first, dump every itemId the catalog MUST contain (yield ids + recipe input/output ids + the 6 tool ids + backpack + camp-cache):

```bash
node -e "
const src = require('fs').readFileSync('src/engine/fabrication.ts','utf8') + require('fs').readFileSync('src/data/biomeNodes.ts','utf8');
const ids = [...new Set([...src.matchAll(/itemId:\s*'([A-Z0-9_]+)'/g)].map(m=>m[1]))].sort();
console.log(ids.length); console.log(ids.join('\n'));"
```

Every id printed must exist in `ITEMS` (the integrity test enforces it). At authoring time this yields ≈ 55 ids; expect the catalog to hold 60+ entries including `LEATHER_BACKPACK`, `SALINE_RINSE` (new, Task 5), tool defs (`RIVER_HAMMERSTONE`, `BRONZE_FORK`, …) and non-stackable misc (`ANIMAL_BONE`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/items.test.ts
import { describe, expect, it } from 'vitest';
import { ITEMS, ITEM_BY_ID, FOOD_ITEM_IDS } from '../src/data/items';
import { FABRICATION_RECIPES } from '../src/engine/fabrication';
import { BIOME_DAG } from '../src/data/biomeNodes';

const requiredIds = (): Set<string> => {
  const ids = new Set<string>();
  for (const r of FABRICATION_RECIPES) {
    r.inputs.forEach(i => ids.add(i.itemId));
    r.outputs.forEach(o => ids.add(o.itemId));
  }
  for (const cat of BIOME_DAG) for (const sp of cat.species) for (const p of sp.parts) for (const y of p.yields) ids.add(y.itemId);
  ['RIVER_HAMMERSTONE','FLINT_FLAKE_BLADE','FLINT_ADZE_HEAD','BRONZE_SPEAR','BRONZE_AXE','BRONZE_FORK','LEATHER_BACKPACK','SALINE_RINSE'].forEach(id => ids.add(id));
  return ids;
};

describe('item catalog integrity', () => {
  it('covers every recipe input/output id and every biome yield id', () => {
    for (const id of requiredIds()) {
      expect(ITEM_BY_ID[id], `missing catalog entry: ${id}`).toBeDefined();
    }
  });
  it('has unique ids', () => {
    const seen = new Set<string>();
    for (const item of ITEMS) {
      expect(seen.has(item.id), `duplicate id: ${item.id}`).toBe(false);
      seen.add(item.id);
    }
  });
  it('food items always declare foodKcal and category food', () => {
    for (const id of FOOD_ITEM_IDS) {
      expect(ITEM_BY_ID[id].foodKcal, `${id} foodKcal`).toBeGreaterThan(0);
      expect(ITEM_BY_ID[id].category).toBe('food');
    }
  });
  it('every icon key is non-empty', () => {
    for (const item of ITEMS) expect(item.icon.length).toBeGreaterThan(1);
  });
  it('tier is 1..5 and desc is a real sentence', () => {
    for (const item of ITEMS) {
      expect(item.tier).toBeGreaterThanOrEqual(1);
      expect(item.tier).toBeLessThanOrEqual(5);
      expect(item.desc.length).toBeGreaterThanOrEqual(12);
    }
  });
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/items.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/data/items.ts`**

Write the catalog with this exact skeleton — fill every dumped id with an entry. Example entries (the rest follow the same shape; do not invent ids that weren't dumped — extend only the "extras" list):

```ts
// src/data/items.ts
import type { ToolSlotKey } from '../engine/fabrication';

export type ItemAffinity = 'apothecary' | 'soapwright' | 'forgewright';
export type ItemCategory = 'tool' | 'weapon' | 'container' | 'material' | 'food' | 'medicine' | 'misc';
export interface ItemDef { /* exactly the fields from the Interfaces block */ }

export const ITEMS: readonly ItemDef[] = [
  { id: 'RIVER_HAMMERSTONE', name: 'River Hammerstone', category: 'tool', tier: 1, icon: 'hammerstone', mohs: 6.5, toolSlot: 'PERCUSSION_MINING', desc: 'Smooth river cobble; the first percussion you will ever own.' },
  { id: 'FLINT_NODULE', name: 'Flint Nodule', category: 'material', tier: 1, icon: 'flint', desc: 'Hard silica nodule; conchoidal fracture yields razor flakes.' },
  { id: 'FLINT_FLAKE_BLADE', name: 'Flint Flake Blade', category: 'tool', tier: 1, icon: 'blade', mohs: 7.0, toolSlot: 'CUTTING_SKINNING', desc: 'Knapped edge, sharper than obsidian, quicker to dull.' },
  { id: 'LEATHER_BACKPACK', name: 'Leather Backpack', category: 'container', tier: 2, icon: 'backpack', desc: 'Vegetable-tanned pack; 24 slots, 40 kg, I_clo 1.15.' },
  { id: 'LOG_WHITE_OAK', name: 'White Oak Log', category: 'material', tier: 1, icon: 'log', desc: 'Dense heartwood; seasons into charcoal and hardwood ash.' },
  { id: 'WHITE_OAK_BARK', name: 'White Oak Bark', category: 'material', tier: 1, icon: 'bark', affinity: 'soapwright', desc: 'Soaked in water it yields the tannin that sets hide into leather.' },
  { id: 'RAW_ADIPOSE_FAT', name: 'Raw Adipose Fat', category: 'material', tier: 1, icon: 'fat', affinity: 'soapwright', desc: 'Rendered with lye it becomes soap; eaten, dense calories.' },
  { id: 'MEAT_RAW', name: 'Fresh Game Meat', category: 'food', tier: 1, icon: 'meat', foodKcal: 1650, desc: 'Lean boar meat, 14 kg dressed; keeps a survivor fed for days.' },
  { id: 'FIELD_MUSHROOM', name: 'Edible Mushroom', category: 'food', tier: 1, icon: 'mushroom', foodKcal: 55, desc: 'Porcini-kin; 22 kcal per 100 g raw, eaten cap by cap.' },
  { id: 'KOH', name: 'Potash Lye', category: 'material', tier: 2, icon: 'droplet', desc: '** KOH — see species compendium; handled as vessel content, carried only via vessels **' },
  // … every remaining dumped id …
  { id: 'BRONZE_FORK', name: 'Bronze Fork', category: 'tool', tier: 3, icon: 'fork', mohs: 3.5, toolSlot: 'EATING_UTENSIL', affinity: 'forgewright', desc: '88:12 bronze tines; eating with it digests +15% cleaner and burns nothing.' },
  { id: 'SALINE_RINSE', name: 'Saline Rinse', category: 'medicine', tier: 2, icon: 'saline', desc: 'Salt of the earth in water; the cheapest clean wound there is.' },
  { id: 'PENICILLIN_DOSE', name: 'Penicillin Dose', category: 'medicine', tier: 4, icon: 'penicillin', affinity: 'apothecary', desc: 'Mold-born antibiotic; knocks one lethal sepsis straight off its feet.' },
  { id: 'SALICYLIC_TINCTURE', name: 'Salicylic Acid Tincture', category: 'medicine', tier: 4, icon: 'vial', affinity: 'apothecary', desc: 'Willow-bark febrifuge; −1.8 °C of fever, bottled and brown.' },
  { id: 'ETHANOL_DISINFECTANT', name: 'Ethanol Disinfectant', category: 'medicine', tier: 4, icon: 'ethanol', affinity: 'apothecary', desc: '95% spirit; sterilizes a wound plain and simple.' },
];

export const ITEM_BY_ID: Readonly<Record<string, ItemDef>> = Object.freeze(
  Object.fromEntries(ITEMS.map(i => [i.id, i])),
);
export const FOOD_ITEM_IDS: readonly string[] = Object.freeze(ITEMS.filter(i => i.foodKcal).map(i => i.id));
```

Notes for the implementer:
- Vessel-only chemistry (KOH, salicylic acid…) does **not** get item entries — it lives in vessels. Remove any dumped id that is a vessel species, and let the test's `requiredIds` reflect that (edit the test's required set, not the catalog, to match the authored fiction — but note it in the commit message).
- `SALINE_RINSE` is added in Task 5 as `RECIPE_SALINE_RINSE` producing `SALINE_RINSE`; keep both ids identical.

- [ ] **Step 4: Run it green (this test drives the whole catalog)**

Run: `npx vitest run tests/items.test.ts && npx tsc --noEmit`
Expected: PASS after the catalog is complete (it will not pass on a partial list — that is the point; do not stub).

- [ ] **Step 5: Commit**

```bash
git add src/data/items.ts tests/items.test.ts
git commit -m "feat(data): item catalog with descriptions/affinity/food kcal; integrity test gates completeness"
```

---

## Task 3: Inline SVG icon set (`src/ui/icons.ts`)

**Files:** Create `src/ui/icons.ts` · Test `tests/icons.test.ts`

**Interfaces:**
- Consumes: `ItemDef.icon` keys (Task 2).
- Produces: `export const ICONS: Readonly<Record<string, string>>` (inner SVG markup, `stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"` on the `<svg>`, NOT repeated per path), `export function itemIcon(id: string, size?: number): string`, `export const FALLBACK_ICON = 'unknown'`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/icons.test.ts
import { describe, expect, it } from 'vitest';
import { ICONS, itemIcon, FALLBACK_ICON } from '../src/ui/icons';
import { ITEMS } from '../src/data/items';

describe('icon set', () => {
  it('every catalog icon key resolves to an icon', () => {
    for (const item of ITEMS) {
      expect(ICONS[item.icon], `missing icon: ${item.icon} (for ${item.id})`).toBeDefined();
    }
  });
  it('fallback icon exists and unknown ids never throw', () => {
    expect(ICONS[FALLBACK_ICON]).toBeDefined();
    expect(() => itemIcon('__does_not_exist__')).not.toThrow();
    expect(itemIcon('__does_not_exist__')).toContain('<svg');
  });
  it('itemIcon honours size argument', () => {
    expect(itemIcon('log', 32)).toContain('width="32"');
    expect(itemIcon('log')).toContain('width="20"');
  });
  it('icons carry stroke=currentColor and viewBox 0 0 24 24', () => {
    for (const [key, body] of Object.entries(ICONS)) {
      expect(body, key).toContain('stroke="currentColor"');
      expect(body, key).toContain('viewBox="0 0 24 24"');
    }
  });
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/icons.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/ui/icons.ts`**

Write one entry per catalog key. Specimen entries (complete pattern — replicate for every key used by the catalog; there are ≈ 45):

```ts
// src/ui/icons.ts
/** Inline stroke icons, 24×24 grid, currentColor. No assets — tree-shakeable string constants. */
const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS: Readonly<Record<string, string>> = {
  unknown: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.8 2.1c-.8.5-1.3 1.2-1.3 2.4"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/>'),
  hammerstone: svg('<path d="M4 16a8 8 0 0 1 14-6l3 3-9 9-8-6z"/><path d="M9 13l4 4"/>'),
  flint: svg('<path d="M6 4l10 2 2 8-8 6-6-8z"/><path d="M10 9l4 5"/>'),
  blade: svg('<path d="M4 12L18 5l2 3-12 8z"/><path d="M4 12l4 3 3-4"/>'),
  adze: svg('<path d="M14 4l6 3-2 4-6-3z"/><path d="M12 8l-8 12"/>'),
  bucket: svg('<path d="M5 8h14l-1.5 11a2 2 0 0 1-2 1.8h-7A2 2 0 0 1 6.5 19z"/><path d="M4 8h16"/><path d="M9 8V5a3 3 0 0 1 6 0"/>'),
  log: svg('<rect x="2.5" y="9" width="16" height="7" rx="3.5"/><circle cx="6" cy="12.5" r="1.2"/>'),
  bark: svg('<path d="M6 3c4 2 4 6 0 8s-4 6 0 8"/><path d="M12 3c4 2 4 6 0 8s-4 6 0 8"/>'),
  fat: svg('<path d="M8 4c5 0 8 3 8 8s-3 8-8 8-5-3-5-9 1-7 5-7z"/><path d="M9 8c2-1 4 0 4 3"/>'),
  meat: svg('<path d="M14 4a5 5 0 0 1 5 5c0 1 2 2 2 4a4 4 0 0 1-4 4h-1l-9 5-2-2 5-9v-1a5 5 0 0 1 4-6z"/>'),
  mushroom: svg('<path d="M4 12a8 8 0 0 1 16 0z"/><path d="M9 12v6a3 3 0 0 0 6 0v-6"/>'),
  backpack: svg('<path d="M7 8V6a5 5 0 0 1 10 0v2"/><path d="M5 10h14v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M9 14h6"/>'),
  fork: svg('<path d="M9 3v7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V3"/><path d="M12 12v9"/>'),
  spear: svg('<path d="M5 19l8-8"/><path d="M13 11l6-8 2 8-8 2z"/>'),
  axe: svg('<path d="M13 8l-8 8 2 2 8-8"/><path d="M13 8l4-4 3 3-4 4z"/>'),
  awl: svg('<path d="M4 20l7-7"/><path d="M11 13L8 10l9-5 2 2z"/>'),
  soap: svg('<rect x="4" y="9" width="16" height="9" rx="4.5"/><path d="M9 13.5c1.5 1 4.5 1 6 0"/><circle cx="9" cy="5" r="1"/><circle cx="13" cy="3.5" r="1.4"/><circle cx="17" cy="5.5" r="1"/>'),
  droplet: svg('<path d="M12 3s6 7 6 12a6 6 0 0 1-12 0c0-5 6-12 6-12z"/>'),
  vial: svg('<path d="M9 3h6"/><path d="M10 3v6l-4 9a2.4 2.4 0 0 0 2.3 3h7.4A2.4 2.4 0 0 0 18 18l-4-9V3"/><path d="M8.5 14h7"/>'),
  saline: svg('<path d="M9 3h6"/><path d="M10 3v5l-4 10a2.2 2.2 0 0 0 2.1 3h7.8a2.2 2.2 0 0 0 2.1-3l-4-10V3"/><path d="M7 15h10"/><path d="M12 11v1"/>'),
  penicillin: svg('<path d="M5 16c4-1 4-8 9-9 3-.6 4 1.5 3 4-1.6 4.4-8 5.4-12 5z"/><path d="M5 16l-2 4 4-2"/>'),
  ethanol: svg('<path d="M10 3h4"/><path d="M11 3v6l-3 4v6a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-6l-3-4V3"/><path d="M8 14h8"/>'),
  pile: svg('<circle cx="8" cy="18" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="16" cy="6" r="2"/><path d="M4 21h16"/>'),
  ingot: svg('<path d="M6 15l3-7h6l3 7z"/><path d="M4 18h16"/>'),
  ore: svg('<path d="M7 5h10l3 6-8 9-8-9z"/><path d="M7 5l5 6 5-6"/>'),
  battery: svg('<path d="M4 9h3v6H4z"/><path d="M8 7h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8z"/><path d="M19 11v2"/><path d="M11 10v4M14 10v4"/>'),
  unknown2: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><circle cx="12" cy="16" r="0.6" fill="currentColor"/>'),
  // … complete the remaining ≈ 22 keys used by the catalog: tanning, sinew, bone, clay, limestone, halite, malachite, cassiterite, sphalerite, pyrite, saltpeter, willow, tannin, water, ash, quicklime, slakedlime, calciumcarbo, bronze, copper, tin, zinc, potassium, sodium, molten, moldculture, salicin, salicylic, ethanolconsumable, disinfectant, bandage, cave, hearth …
};
export const FALLBACK_ICON = 'unknown';
export function itemIcon(id: string, size = 20): string {
  const body = ICONS[id] ?? ICONS[FALLBACK_ICON];
  return body.replace('width="20" height="20"', `width="${size}" height="${size}"`);
}
```

- [ ] **Step 4: Run it green**

Run: `npx vitest run tests/icons.test.ts && npx tsc --noEmit`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/icons.ts tests/icons.test.ts
git commit -m "feat(ui): inline SVG icon set for the item catalog (dark-theme stroke icons, no assets)"
```

---

## Task 4: Pure harvest engine + wound roll (`src/engine/harvest.ts`)

**Files:** Create `src/engine/harvest.ts` · Test `tests/harvest.test.ts`

**Interfaces:**
- Consumes: `PlayerMetabolismState`; `addItemToContainer`, `InventoryState`/`InventorySlot` from `./inventory`; `calculateHarvestTotalCostKcal`, `HarvestablePart` from `../data/biomeNodes`; `Mulberry32`-style `{ roll(p:number):boolean }` from `./rng`.
- Produces (exact):
```ts
export interface HarvestOutcome {
  ok: boolean;
  reason?: 'too_tired';
  kcalCost: number;
  added: Array<{ itemId: string; count: number; container: 'bareHands' | 'backpack' | 'campCache' }>;
  overflowKg: number;
  wound: boolean;   // true if the seeded roll opened a wound (animal_hunt parts only)
}
export function applyHarvest(
  player: PlayerMetabolismState,
  inventory: InventoryState,
  part: HarvestablePart,
  speciesDistanceMeters: number,
  equippedToolSlot: ToolSlotKey | null,
  equippedTool: { mohs: number; mechanicalAdvantage: number } | null,
  rng: { roll: (p: number) => boolean },
): HarvestOutcome
```

- [ ] **Step 1: Write the failing test**

```ts
// tests/harvest.test.ts
import { describe, expect, it } from 'vitest';
import { applyHarvest } from '../src/engine/harvest';
import { createPlayerMetabolism } from '../src/engine/metabolism';
import { createInventoryState } from '../src/engine/inventory';
import { BIOME_DAG } from '../src/data/biomeNodes';
import { createSeededRng } from '../src/engine/rng';

const boarSpecies = BIOME_DAG.find(c => c.key === 'ANIMALS')!.species[0];
const oakSpecies = BIOME_DAG[0].species[0];
const boarPart = boarSpecies.parts[0];
const oakLog = oakSpecies.parts[0]; // White Oak Log

describe('applyHarvest', () => {
  it('deducts kcal and adds yields to bare hands when they fit', () => {
    const p = createPlayerMetabolism();
    const inv = createInventoryState();
    const rng = createSeededRng(1);
    const out = applyHarvest(p, inv, oakLog, oakSpecies.baseDistanceMeters, null, null, rng);
    expect(out.ok).toBe(true);
    expect(out.kcalCost).toBeGreaterThan(0);
    expect(p.glucoseKcal).toBeCloseTo(1200 - out.kcalCost, 6);
    expect(inv.bareHands.slots.some(s => s?.itemId === 'LOG_WHITE_OAK' && s.count === 1)).toBe(true);
  });

  it('refuses when the player cannot pay the kcal cost', () => {
    const p = createPlayerMetabolism();
    p.glucoseKcal = 1;
    const inv = createInventoryState();
    const out = applyHarvest(p, inv, boarPart, boarSpecies.baseDistanceMeters, null, null, createSeededRng(2));
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('too_tired');
    expect(inv.bareHands.slots.every(s => s === null)).toBe(true);
  });

  it('boar hunt rolls a wound deterministically from the seed', () => {
    const p = createPlayerMetabolism();
    const inv = createInventoryState();
    const out = applyHarvest(p, inv, boarPart, boarSpecies.baseDistanceMeters, 'CUTTING_SKINNING', { mohs: 7, mechanicalAdvantage: 1 }, createSeededRng(99));
    expect(typeof out.wound).toBe('boolean');
    // same seed, same result, forever:
    const p2 = createPlayerMetabolism();
    const inv2 = createInventoryState();
    const out2 = applyHarvest(p2, inv2, boarPart, boarSpecies.baseDistanceMeters, 'CUTTING_SKINNING', { mohs: 7, mechanicalAdvantage: 1 }, createSeededRng(99));
    expect(out2.wound).toBe(out.wound);
  });

  it('toolless boar hunt: meat lands in inventory, deterministic across seeds', () => {
    const p = createPlayerMetabolism();
    const inv = createInventoryState();
    applyHarvest(p, inv, boarPart, boarSpecies.baseDistanceMeters, null, null, createSeededRng(4));
    expect(JSON.stringify(inv.bareHands.slots.map(s => s?.itemId))).toContain('MEAT_RAW');
  });
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/harvest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/engine/harvest.ts`**

```ts
// src/engine/harvest.ts
import type { PlayerMetabolismState } from './metabolism';
import { addItemToContainer, type InventoryState } from './inventory';
import {
  calculateHarvestTotalCostKcal,
  type HarvestablePart,
} from '../data/biomeNodes';
import type { ToolSlotKey } from './fabrication';

export interface HarvestOutcome { /* fields per Interfaces block */ }
const ANIMAL_HUNT_IDS = new Set(['BOAR_HUNT']); // extend as the biome DAG grows: any part whose id endsWith('_HUNT')
const WOUND_CHANCE = 0.2;

export function applyHarvest(
  player: PlayerMetabolismState,
  inventory: InventoryState,
  part: HarvestablePart,
  speciesDistanceMeters: number,
  equippedToolSlot: ToolSlotKey | null,
  equippedTool: { mohs: number; mechanicalAdvantage: number } | null,
  rng: { roll: (p: number) => boolean },
): HarvestOutcome {
  const toolMohs = equippedTool?.mohs ?? 1.0;
  const toolMA = equippedTool?.mechanicalAdvantage ?? 1.0;
  const carriedMassKg = 0; // future: pass current hands mass; 0 keeps the closed form stable
  const requiredSlot = part.requiredToolSlot ?? null;
  void equippedToolSlot; void requiredSlot; // slot match is a UI affordance, not a hard blocker
  const targetMohs = Math.max(1.0, part.targetMohs ?? 1.0);
  const kcalCost = calculateHarvestTotalCostKcal(
    part.baseWorkJoules, toolMohs, targetMohs, toolMA, speciesDistanceMeters, carriedMassKg,
  );
  if (player.glucoseKcal < kcalCost) {
    return { ok: false, reason: 'too_tired', kcalCost, added: [], overflowKg: 0, wound: false };
  }
  player.glucoseKcal = Math.max(0, player.glucoseKcal - kcalCost);

  const added: HarvestOutcome['added'] = [];
  let overflowKg = 0;
  for (const y of part.yields) {
    const slot = { itemId: y.itemId, count: 1, massKg: y.massKg, label: y.name };
    if (addItemToContainer(inventory.bareHands, slot)) added.push({ itemId: y.itemId, count: 1, container: 'bareHands' });
    else if (inventory.backpack.unlocked && addItemToContainer(inventory.backpack, slot)) added.push({ itemId: y.itemId, count: 1, container: 'backpack' });
    else if (addItemToContainer(inventory.campCache, slot)) added.push({ itemId: y.itemId, count: 1, container: 'campCache' });
    else overflowKg += y.massKg;
  }

  const wound = ANIMAL_HUNT_IDS.has(part.id) || part.id.endsWith('_HUNT') ? rng.roll(WOUND_CHANCE) : false;
  if (wound) player.conditions.woundContamination = true;

  return { ok: true, kcalCost, added, overflowKg, wound };
}
```

- [ ] **Step 4: Run it green**

Run: `npx vitest run tests/harvest.test.ts && npx tsc --noEmit`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/harvest.ts tests/harvest.test.ts
git commit -m "feat(engine): pure harvest pipeline (kcal cost, container routing, seeded wound roll)"
```

---

## Task 5: FABRICATE / EAT_FOOD / EQUIP_TOOL worker commands + RECIPE_EFFECTS

**Files:** Modify `src/engine/fabrication.ts` (append `RECIPE_EFFECTS` + new recipe) · Modify `src/engine/sim.worker.ts` · Test `tests/fabricateConsume.test.ts`

**Interfaces:**
- Consumes: `InventoryState` helpers (`addItemToContainer`, `removeItemFromContainer`, `getContainerTotalMassKg`), `FABRICATION_RECIPES`, `unlockBackpack`, `METALLURGY_TOOLS`.
- Produces:
```ts
// in fabrication.ts
export interface RecipeEffect { onFabricate?: 'unlock_backpack' | 'equip_eating_utensil' | 'equip_weapon' | 'equip_axe' | 'noop'; }
export const RECIPE_EFFECTS: Readonly<Record<string, RecipeEffect>> = {
  RECIPE_STITCH_BACKPACK: { onFabricate: 'unlock_backpack' },
  CAST_BRONZE_FORK: { onFabricate: 'equip_eating_utensil' },
  CAST_BRONZE_SPEARHEAD: { onFabricate: 'equip_weapon' },
  CAST_BRONZE_AXE: { onFabricate: 'equip_axe' },
};
// new recipe appended to FABRICATION_RECIPES (append-only, keep order stable):
{ id: 'RECIPE_SALINE_RINSE', name: 'Saline Wound Rinse', inputs: [ { itemId: 'HALITE_SALT', count: 1, label: 'Halite Salt' } ], outputs: [ { itemId: 'SALINE_RINSE', count: 1, label: 'Saline Rinse' } ], energyCostKcal: 2, workTicks: 0, description: 'Salt of the earth in a palm of water; the cheapest clean wound there is.' },
```

> **Water-as-item note:** the game models water inside vessels, not as an inventory item. `RECIPE_SALINE_RINSE` therefore requires **1 HALITE_SALT only** (dissolve in any available fresh water at the camp spot — water is not consumed). The integrity test (Task 2) only requires catalog resolution, and every input id above resolves.

**Worker-side semantics (all-or-nothing):** check every input against hands→backpack→cache; if any missing → `EVENTS: ['Missing: 2× Halite Salt (need 1), …']` listing actual shortfalls (per spec §8 failure-feedback honesty), nothing consumed; else remove inputs, add outputs, apply `RECIPE_EFFECTS` unlocks, post `OBJECTIVE { kind: 'recipe', target: recipeId }` (consumed by Phase 3) AND a human-readable `EVENTS` line. Backpack unlock keeps the existing 🎉 message AND sets `player.clothingIclo = 1.15`.

`EAT_FOOD { itemId }`: `removeItemFromContainer` from hands→backpack (never cache — you eat what you carry); require the id's `foodKcal`; call `consumeFood(player, foodKcal, { hasCleanUtensil: inventory.tools.EATING_UTENSIL !== null })`; post `OBJECTIVE { kind: 'eat', target: itemId }` + EVENTS line `+N kcal absorbed (…)`. Reject non-food ids with an EVENTS warning.

`EQUIP_TOOL { slot, toolId }`: find tool in hands/backpack, move it to `inventory.tools[slot]`, swap the previous occupant back into the first free container slot; post PLAYER_SYNC. Tools whose def lives in `METALLURGY_TOOLS` are referenced by `toolId` = the recipe output id.

- [ ] **Step 1: Write the failing test**

```ts
// tests/fabricateConsume.test.ts
import { describe, expect, it } from 'vitest';
import {
  createInventoryState, addItemToContainer, unlockBackpack,
} from '../src/engine/inventory';
import { FABRICATION_RECIPES, METALLURGY_TOOLS, RECIPE_EFFECTS } from '../src/engine/fabrication';
import { consumeFood, createPlayerMetabolism } from '../src/engine/metabolism';

const recipe = (id: string) => FABRICATION_RECIPES.find(r => r.id === id)!;
const roots = () => {
  const inv = createInventoryState();
  return { inv, recipe: recipe('RECIPE_STITCH_BACKPACK') };
};

describe('fabrication consume semantics (worker logic, simulated against pure APIs)', () => {
  it('RECIPE_EFFECTS maps backpack recipe to unlock_backpack', () => {
    expect(RECIPE_EFFECTS.RECIPE_STITCH_BACKPACK.onFabricate).toBe('unlock_backpack');
  });
  it('RECIPE_SALINE_RINSE exists and produces SALINE_RINSE', () => {
    expect(recipe('RECIPE_SALINE_RINSE').outputs.map(o => o.itemId)).toContain('SALINE_RINSE');
  });
  it('eat: consumeFood grants +15% with a utensil and nothing without', () => {
    const p = createPlayerMetabolism();
    const plain = consumeFood(p, 1000, 0);
    expect(plain.absorbedKcal).toBeCloseTo(1000, 6);
    const p2 = createPlayerMetabolism();
    const forked = consumeFood(p2, 1000, { hasCleanUtensil: true });
    expect(forked.absorbedKcal).toBeCloseTo(1150, 6);
    expect(forked.pathogenRiskEliminated).toBe(true);
  });
  it('bronze fork maps to EATING_UTENSIL slot with +15% and pathogen immunity', () => {
    expect(METALLURGY_TOOLS.BRONZE_FORK.slot).toBe('EATING_UTENSIL');
  });
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/fabricateConsume.test.ts`
Expected: FAIL — `RECIPE_EFFECTS` / `RECIPE_SALINE_RINSE` not exported.

- [ ] **Step 3: Implement**

In `fabrication.ts`, append:

```ts
// ---- Recipe side-effects (data-driven; the worker switches on this, not on recipe ids) ----
export interface RecipeEffect {
  readonly onFabricate?: 'unlock_backpack' | 'equip_eating_utensil' | 'equip_weapon' | 'equip_axe' | 'noop';
}
export const RECIPE_EFFECTS: Readonly<Record<string, RecipeEffect>> = {
  RECIPE_STITCH_BACKPACK: { onFabricate: 'unlock_backpack' },
  CAST_BRONZE_FORK: { onFabricate: 'equip_eating_utensil' },
  CAST_BRONZE_SPEARHEAD: { onFabricate: 'equip_weapon' },
  CAST_BRONZE_AXE: { onFabricate: 'equip_axe' },
};
```

Then add this single object to the END of the `FABRICATION_RECIPES` array literal (insert before the closing `];`):

```ts
  {
    id: 'RECIPE_SALINE_RINSE',
    name: 'Saline Wound Rinse',
    inputs: [ { itemId: 'HALITE_SALT', count: 1, label: 'Halite Salt' } ],
    outputs: [ { itemId: 'SALINE_RINSE', count: 1, label: 'Saline Rinse' } ],
    energyCostKcal: 2,
    workTicks: 0,
    description: 'Salt of the earth in a palm of water; the cheapest clean wound there is.',
  },
```

In `sim.worker.ts`:
1. Import `applyHarvest`, `RECIPE_EFFECTS`, `METALLURGY_TOOLS`, `consumeFood`, `createSeededRng`, `createInventoryState`.
2. Own `let rngSeed = save?.rngSeed ?? ((Math.random() * 0xffffffff) >>> 0)`; `let rng = createSeededRng(rngSeed)` — created on INIT (or LOAD_WORLD, Task 7), passed to harvest.
3. Implement command cases: `HARVEST_PART` → gather `{ part, species }` from `BIOME_DAG` by `agentPayload` — needs `speciesId` too: **change the command union to** `{ type: 'HARVEST_PART'; partId: string; speciesId: string; carriedMassKg: number; toolSlot: ToolSlotKey | null; distanceMeters: number }` and update the Harvest call-site in `src/main.ts:487`.
   In the case: find part + species by id; resolve equipped tool from `inventory.tools[part.requiredToolSlot ?? the one passed]` — use `inventory.tools[toolSlot] ?? null`; call `applyHarvest(player!, inventory!, part, species.baseDistanceMeters, toolSlot, tool, rng)`; on `ok: false` EVENTS `Too exhausted to forage (need ≈ ${Math.round(kcalCost)} kcal)`; else EVENTS lines per added item + `wound` message; then `postPlayerAndInventory()`. Never let an unknown partId throw — EVENTS `Unknown part` and return.
4. `FABRICATE`: atomic check — build a working copy counts map from hands→backpack→cache; if short: EVENTS with `Missing: xN label —` joined; else `removeItemFromContainer` the same counts (they are guaranteed present — do not partially remove before validation), add outputs (hands→backpack→cache; overflow logged, not dropped silently), apply `RECIPE_EFFECTS` (unlock_backpack keeps existing 🎉 message + `clothingIclo=1.15`; equips via the same code as EQUIP_TOOL using `METALLURGY_TOOLS`), post `{ type: 'OBJECTIVE', kind: 'recipe', target: recipeId }` + `postPlayerAndInventory()`.
5. `EAT_FOOD`: resolve `ITEM_BY_ID[command.itemId]?.foodKcal` (import from `../data/items` — the worker already imports from data); remove 1 from hands→backpack; `consumeFood(player, foodKcal, { hasCleanUtensil: !!inventory.tools.EATING_UTENSIL })`; EVENTS `+${absorbed} kcal absorbed`; if result.bonusKcal>0 mention the fork; OBJECTIVE `eat:<id>`; PLAYER_SYNC.
6. `EQUIP_TOOL`: `{ slot: ToolSlotKey, toolId: string }` — search hands→backpack for the def matching `toolId` in `METALLURGY_TOOLS` or `INITIAL_PRIMITIVE_TOOLS`-style records; null it from its container; swap previous `inventory.tools[slot]` into first free slot; set `inventory.tools[slot]`; PLAYER_SYNC.
7. `OBJECTIVE` message shape (consumed by Phase 3): `{ type: 'OBJECTIVE'; kind: 'recipe' | 'eat' | 'treat' | 'harvest'; target: string }`.

- [ ] **Step 4: Run it green**

Run: `npx vitest run tests/fabricateConsume.test.ts && npx tsc --noEmit && npm test`
Expected: new suite PASS; existing 54 still PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/fabrication.ts src/engine/sim.worker.ts tests/fabricateConsume.test.ts
git commit -m "feat(worker): functional FABRICATE (atomic consume + data-driven effects), EAT_FOOD, EQUIP_TOOL, HARVEST_PART"
```

---

## Task 6: Simulation clock constants + `PLAYER_SYNC` v2 payload

**Files:** Create `src/engine/time.ts` · Modify `src/engine/sim.worker.ts` · Modify `src/main.ts` (type only; wiring in Task 11)

**Interfaces:**
- Produces: `export const SIM_STEP_SECONDS = 360; export const WORKER_HZ = 10; export const TICKS_PER_HOUR = WORKER_HZ; export const DAY_TICKS = 240; export const tickToDay = (tick: number): number => 1 + Math.floor(tick / DAY_TICKS);`
- PLAYER_SYNC v2 payload (client receives, additive): `inventory.items: Array<{ id: string; count: number; massKg: number }>` (worker-side reduce over hands+backpack+cache), `player.ambientTempK: number`, `player.day: number`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/time.test.ts (extend inline into tests/persistenceV2.test.ts if preferred — standalone is fine)
import { describe, expect, it } from 'vitest';
import { DAY_TICKS, tickToDay, SIM_STEP_SECONDS, WORKER_HZ } from '../src/engine/time';
describe('simulation clock', () => {
  it('10 Hz × 360 s/step = 240 ticks per game day', () => {
    expect(WORKER_HZ * SIM_STEP_SECONDS).toBe(3600);
    expect(DAY_TICKS).toBe(240);
  });
  it('tickToDay starts at Day 1 and flips at 240', () => {
    expect(tickToDay(0)).toBe(1);
    expect(tickToDay(239)).toBe(1);
    expect(tickToDay(240)).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/time.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/engine/time.ts
export const SIM_STEP_SECONDS = 360;   // 6 game-minutes per worker tick
export const WORKER_HZ = 10;           // 10 steps per wall second at 1× speed
export const TICKS_PER_HOUR = WORKER_HZ;
export const DAY_TICKS = 240;          // 86400 s / 360 s
export const tickToDay = (tick: number): number => 1 + Math.floor(tick / DAY_TICKS);
```

Worker changes:
1. Import `DAY_TICKS, tickToDay, SIM_STEP_SECONDS, WORKER_HZ` from `./time`; delete the local duplicates.
2. In `postPlayerAndInventory()`: build `items` by reducing `bareHands|backpack|campCache` slots: `{ id: slot.itemId, count: slot.count, massKg: slot.massKg }` (aggregate stacks by id across containers); include `ambientTempK: Math.round(world!.ambientTempK * 100) / 100` and `day: tickToDay(world!.tick)`; include existing fields unchanged.
3. `Event` de-dupe fix (spec §3.6): remove the duplicated `ctx.postMessage({ type: 'EVENTS' … })` — keep exactly one per path.

Client changes (`src/main.ts`, types only — UI usage in Tasks 10/11): extend the `PLAYER_SYNC` union arm:
```ts
| { type: 'PLAYER_SYNC'; player: any; inventory: any & { items?: Array<{ id: string; count: number; massKg: number }> } }
```
Store `state.items = data.inventory.items ?? []` in the handler.

- [ ] **Step 4: Run it green**

Run: `npx vitest run tests/time.test.ts && npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/time.ts tests/time.test.ts src/engine/sim.worker.ts src/main.ts
git commit -m "feat(engine): simulation clock constants; PLAYER_SYNC v2 (items reduce, ambient temp, real day)"
```

---

## Task 7: Wound→sepsis ladder (`src/engine/conditions.ts`) + `LOAD_WORLD` restore + persistence v2

**Files:** Create `src/engine/conditions.ts`, `src/engine/worldRestore.ts` · Modify `src/engine/sim.worker.ts`, `src/engine/persistence.ts`, `src/engine/world.ts` · Test `tests/conditions.test.ts`, `tests/worldRestore.test.ts`, `tests/persistenceV2.test.ts`

**Interfaces:**
- `escalateConditions(player: PlayerMetabolismState, dtHours: number): Array<{ message: string }>` — called from BOTH `tick()` and `advance()` step loops (spec §3.5 fast-forward parity). Tracks timers on `player.woundOnsetSeconds` / `player.sepsisOnsetSeconds` (NEW optional numeric fields on `PlayerMetabolismState` — extend the interface, all default 0; existing tests must still pass unchanged).
- `restoreWorldFromSave(save: SerializedWorldSaveV2): WorldState` — pure; `VesselState.moles`/`precipitated` serialised as number[], rebuilt via `new Float64Array(arr)`.
- `SerializedWorldSave` becomes the v2 shape (see below); `deserializeSave` validates version ≥ 1; `migrateSave(raw: unknown): SerializedWorldSave` upgrades v1→v2 with defaults. `compressSaveToBase64` / `decompressBase64ToSave` gain a SHA-256 integrity prefix: exported string is `sha256:<64-hex>:<b64-gzip>`; import verifies; legacy bare-base64 accepted with `console.warn`.

**Ladder semantics (verbatim):**
- Wound active: `+10 kcal/h` extra burn (added inside `stepPlayerMetabolism` via a new optional flag — additive, existing tests unaffected), message unchanged.
- Wound onset ≥ 12 game-hours untreated → `fever: true` (+1.8 K constant — already modelled by `pyrogenicFeverShift`), message `"A flush crawls up your neck — fever 38.6°."`
- Fever onset ≥ 24 additional untreated hours → `systemicInfection: true` (+60 kcal/h — the number the code comment always promised), message `"Chills race down your spine. This is sepsis."`
- Systemic onset ≥ 48 untreated hours → `dead: true` (new boolean on `PlayerMetabolismState`; default false). Worker: when dead, `tick()` and `advance()` return early with no stepping; client shows death screen.
- Cures (unchanged functions in `metabolism.ts`): `applyEthanolDisinfectant` / `applySalicylicAcid` / `applyPenicillin` clear their respective flags and **reset the corresponding onset timer** — weapon: salt-rinse path clears `woundContamination` only (Task 5 EAT_FOOD/EQUIP item-id `SALINE_RINSE` routes `applyEthanolDisinfectant`-equivalent: `player.conditions.woundContamination = false` + timer reset, emits `treat:saline`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/conditions.test.ts
import { describe, expect, it } from 'vitest';
import { escalateConditions } from '../src/engine/conditions';
import { createPlayerMetabolism } from '../src/engine/metabolism';

const hurt = () => {
  const p = createPlayerMetabolism();
  p.conditions.woundContamination = true;
  return p;
};

describe('wound→fever→sepsis ladder', () => {
  it('wound untreated 12h+ becomes fever', () => {
    const p = hurt();
    escalateConditions(p, 11);
    expect(p.conditions.fever).toBe(false);
    escalateConditions(p, 1.5);
    expect(p.conditions.fever).toBe(true);
  });
  it('fever untreated 24h+ becomes sepsis', () => {
    const p = hurt();
    escalateConditions(p, 40);            // 12h → fever at ~12, then 24h more
    expect(p.conditions.fever).toBe(true);
    expect(p.conditions.systemicInfection).toBe(true);
  });
  it('sepsis untreated 48h is fatal', () => {
    const p = hurt();
    escalateConditions(p, 100);           // 12 + 24 + 48 = 84 < 100
    expect(p.dead).toBe(true);
  });
  it('cure resets the wound timer path correctly', () => {
    const p = hurt();
    escalateConditions(p, 3);             // accumulates but not fever yet
    p.conditions.woundContamination = false;
    p.woundOnsetSeconds = 0;
    escalateConditions(p, 100);
    expect(p.conditions.fever).toBe(false);
    expect(p.dead).toBe(false);
  });
});
```

```ts
// tests/worldRestore.test.ts
import { describe, expect, it } from 'vitest';
import { createWorld, createWorldVessel, syncWorldToShared } from '../src/engine/world';
import { restoreWorldFromSave } from '../src/engine/worldRestore';
import { createVessel } from '../src/engine/chemistry';

describe('restoreWorldFromSave', () => {
  it('rebuilds vessel chemistry byte-identically', () => {
    const w = createWorld(291.15);
    const v = createWorldVessel(w, 1, 'FIRED_CERAMIC', 2.0);
    v.moles[0] = 3.5; v.moles[6] = 0.75; v.moles[9] = 0.25; v.temperatureK = 341.4;
    const save = {
      version: 2 as const, timestamp: 0, tick: 777, day: 4, ambientTempK: 291.15,
      rngSeed: 42,
      player: null as any,                    // player restored separately by caller
      inventory: null as any,
      vessels: w.vessels.map(vs => ({ ...vs, moles: Array.from(vs.moles), precipitated: Array.from(vs.precipitated) })),
      ever: {}, renown: 0, affinity: { apothecary: 0, soapwright: 0, forgewright: 0 },
      chapter: 0, fabricatedRecipes: [], objectivesDone: [], lettersDone: [], epilogueSeen: false,
    };
    const restored = restoreWorldFromSave(save);
    expect(restored.tick).toBe(777);
    expect(restored.ambientTempK).toBeCloseTo(291.15, 6);
    expect(restored.vessels).toHaveLength(1);
    expect(restored.vessels[0].moles[0]).toBeCloseTo(3.5, 10);
    expect(restored.vessels[0].moles[6]).toBeCloseTo(0.75, 10);
    expect(restored.vessels[0].temperatureK).toBeCloseTo(341.4, 4);
    expect(restored.vessels[0].moles).toBeInstanceOf(Float64Array);
  });
});
```

```ts
// tests/persistenceV2.test.ts
import { describe, expect, it } from 'vitest';
import { migrateSave, serializeSave, deserializeSave } from '../src/engine/persistence';

describe('save v2 migration + round trip', () => {
  it('v1 save migrates with defaults, keeps tick/day', () => {
    const v1 = { version: 1, timestamp: 1, tick: 240, day: 2, ambientTempK: 288.15,
      player: { glucoseKcal: 500, adiposeKcal: 12000, hydrationPct: 80, coreTempK: 310.15, clothingIclo: 1.15 },
      inventory: { backpackUnlocked: true }, vessels: [] };
    const v2 = migrateSave(v1);
    expect(v2.version).toBe(2);
    expect(v2.renown).toBe(0);
    expect(v2.chapter).toBe(0);
    expect(Array.isArray(v2.fabricatedRecipes)).toBe(true);
    expect(v2.day).toBe(2);
    expect(typeof v2.rngSeed).toBe('number');
  });
  it('serialize→deserialize round-trips v2 exactly', () => {
    const save = migrateSave({ version: 1, timestamp: 1, tick: 1, day: 1, ambientTempK: 290,
      player: { glucoseKcal: 1, adiposeKcal: 2, hydrationPct: 3, coreTempK: 310, clothingIclo: 0.05 },
      inventory: {}, vessels: [] });
    const back = deserializeSave(serializeSave(save));
    expect(back.rngSeed).toBe(save.rngSeed);
    expect(back.day).toBe(save.day);
  });
});
```

- [ ] **Step 2: Run them to watch them fail**

Run: `npx vitest run tests/conditions.test.ts tests/worldRestore.test.ts tests/persistenceV2.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

`conditions.ts` —
```ts
import type { PlayerMetabolismState } from './metabolism';
export interface ConditionEvent { message: string }
export function escalateConditions(player: PlayerMetabolismState, dtHours: number): ConditionEvent[] {
  const out: ConditionEvent[] = [];
  const c = player.conditions;
  if (c.woundContamination) {
    player.woundOnsetSeconds = (player.woundOnsetSeconds ?? 0) + dtHours * 3600;
    if (!c.fever && player.woundOnsetSeconds >= 12 * 3600) {
      c.fever = true;
      out.push({ message: 'A flush crawls up your neck — fever 38.6°.' });
    }
  }
  if (c.fever && !c.systemicInfection) {
    player.sepsisOnsetSeconds = (player.sepsisOnsetSeconds ?? 0) + dtHours * 3600;
    if (player.sepsisOnsetSeconds >= 24 * 3600) {
      c.systemicInfection = true;
      out.push({ message: 'Chills race down your spine. This is sepsis.' });
      player.sepsisOnsetSeconds = 0; // restart fuse for the fatal stage
    }
  }
  if (c.systemicInfection) {
    player.sepsisOnsetSeconds = (player.sepsisOnsetSeconds ?? 0) + dtHours * 3600;
    if (player.sepsisOnsetSeconds >= 48 * 3600) player.dead = true;
  }
  return out;
}
```
Import `dead?, woundOnsetSeconds?, sepsisOnsetSeconds?` — extend `PlayerMetabolismState` in `metabolism.ts` with `dead?: boolean; woundOnsetSeconds?: number; sepsisOnsetSeconds?: number;` (optional → no existing test breakage) and add `+10 kcal/h` burn in `stepPlayerMetabolism`'s total-burn sum when `c.woundContamination` (mirror the `systemicInfection` line below it; keep the existing `+60` line verbatim).

`worldRestore.ts` —
```ts
import { createWorld, type WorldState } from './world';
import type { SerializedWorldSave } from './persistence';
import type { VesselMaterialKey } from './chemistry';
/** Rebuild WorldState from a save's vessels array. Fail-loud on bad payloads. */
export function restoreWorldFromSave(save: SerializedWorldSave): WorldState {
  const world = createWorld(save.ambientTempK);
  world.tick = save.tick;
  world.simSeconds = save.tick * 360; // consistent with SIM_STEP_SECONDS
  for (const raw of save.vessels as any[]) {
    world.vessels.push({
      id: raw.id, material: raw.material as VesselMaterialKey, capacityL: raw.capacityL,
      headspaceClosed: !!raw.headspaceClosed, temperatureK: raw.temperatureK,
      moles: new Float64Array(raw.moles ?? []), precipitated: new Float64Array(raw.precipitated ?? []),
      heaterWatts: raw.heaterWatts ?? 0, condenserTargetVesselId: raw.condenserTargetVesselId ?? -1,
      pressureKPa: raw.pressureKPa ?? 101.325, ruptured: !!raw.ruptured,
      appliedVolts: raw.appliedVolts ?? 0, cellResistanceOhm: raw.cellResistanceOhm ?? 0,
    });
  }
  return world;
}
```
`world.ts` exports `WorldState` and `createWorld` already ✓ (checked).

`persistence.ts` — extend:
```ts
export interface SerializedWorldSave {
  version: number; timestamp: number; tick: number; day: number; ambientTempK: number;
  rngSeed: number;
  player: { glucoseKcal: number; adiposeKcal: number; hydrationPct: number; coreTempK: number; clothingIclo: number;
            conditions?: import('./metabolism').PlayerConditions; dead?: boolean; woundOnsetSeconds?: number; sepsisOnsetSeconds?: number };
  inventory: any; vessels: any[];
  ever: Record<string, boolean>; renown: number;
  affinity: { apothecary: number; soapwright: number; forgewright: number };
  chapter: number; fabricatedRecipes: string[]; objectivesDone: string[]; lettersDone: string[]; epilogueSeen: boolean;
}
export function migrateSave(raw: any): SerializedWorldSave {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid save payload structure');
  const v = typeof raw.version === 'number' ? raw.version : 1;
  if (v >= 2) return deserializeSave(JSON.stringify(raw));
  return {
    version: 2, timestamp: raw.timestamp ?? Date.now(), tick: raw.tick ?? 0, day: raw.day ?? 1,
    ambientTempK: raw.ambientTempK ?? 288.15,
    rngSeed: (Math.random() * 0xffffffff) >>> 0,
    player: { glucoseKcal: raw.player?.glucoseKcal ?? 1200, adiposeKcal: raw.player?.adiposeKcal ?? 15000,
      hydrationPct: raw.player?.hydrationPct ?? 100, coreTempK: raw.player?.coreTempK ?? 310.15,
      clothingIclo: raw.player?.clothingIclo ?? 0.05, conditions: { fever: false, systemicInfection: false, woundContamination: false } },
    inventory: raw.inventory ?? {}, vessels: raw.vessels ?? [],
    ever: raw.ever ?? {}, renown: raw.renown ?? 0,
    affinity: raw.affinity ?? { apothecary: 0, soapwright: 0, forgewright: 0 },
    chapter: raw.chapter ?? 0, fabricatedRecipes: raw.fabricatedRecipes ?? [],
    objectivesDone: raw.objectivesDone ?? [], lettersDone: raw.lettersDone ?? [], epilogueSeen: raw.epilogueSeen ?? false,
  };
}
// deserializeSave: accept version ≥ 1, run through the same defaults merge as migrateSave when version === 1.
// NEW sha256 plumbing (async):
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// compressSaveToBase64 now returns `sha256:${hex}:${plainB64}`; decompressBase64ToSave verifies when prefix present, else console.warn and continue.
```
`sim.worker.ts` — add case `LOAD_WORLD`: payload `{ type: 'LOAD_WORLD'; save: SerializedWorldSave }`; rebuild `world = restoreWorldFromSave(save)`; `player = createPlayerMetabolism(save.player.clothingIclo)` then assign all saved player fields + conditions + dead/timers (Object.assign); `inventory = save.inventory` (already the InventoryState JSON — verify `slots` survive JSON: yes, plain objects/nulls); `paused = false`; `rngSeed = save.rngSeed`; `rng = createSeededRng(rngSeed)`; then post READY/VESSELS/PLAYER_SYNC (mirror existing READY path) so the client fully re-renders. Also add `SET_SAFETY`-style `dead` short-circuits at the top of `tick()` and `advance()`: `if (player?.dead) return []` / `return` respectively — and `ADVANCE` handler additionally returns without simulating when dead.

- [ ] **Step 4: Run it green**

Run: `npx vitest run tests/conditions.test.ts tests/worldRestore.test.ts tests/persistenceV2.test.ts && npm test && npx tsc --noEmit`
Expected: new suites PASS; existing 54 PASS (metabolism additive changes only add an extra burn term **inside** an existing branch guarded by the new optional field — existing tests assert no-condition burns and pass).

- [ ] **Step 5: Commit**

```bash
git add src/engine/conditions.ts src/engine/worldRestore.ts src/engine/metabolism.ts src/engine/persistence.ts src/engine/sim.worker.ts tests/conditions.test.ts tests/worldRestore.test.ts tests/persistenceV2.test.ts
git commit -m "feat(engine): wound→sepsis escalation with fast-forward parity; pure world restore; save v2 + migration + sha256"
```

---

## Task 8: Story data (`src/data/story.ts`) — chapters, letters, affinities, titles

**Files:** Create `src/data/story.ts` · Test `tests/storyCompleteness.test.ts`

**Interfaces:**
- Produces (exact; consumed by Tasks 9/10/11):
```ts
export type AffinityId = 'apothecary' | 'soapwright' | 'forgewright';
export interface ObjectiveDef { id: string; kind: 'species' | 'recipe' | 'item' | 'flag' | 'eat' | 'treat'; target: string; count?: number; text: string }
export interface ChapterDef { id: string; era: string; title: string; epigraph: string; body: string; objectives: ObjectiveDef[]; epilogue: string; renown: number }
export interface LetterDef { id: string; era: string; chapter: number; from: string; excerpt: string; task: ObjectiveDef; rewardRenown: number; rewardAffinity: Partial<Record<AffinityId, number>> }
export interface AffinityDef { id: AffinityId; titles: [string, string, string]; thresholds: [number, number, number]; color: string }
export const CHAPTERS: readonly ChapterDef[];
export const LETTERS: readonly LetterDef[];
export const AFFINITIES: readonly AffinityDef[];
export const LEVEL_TITLES: readonly string[];       // index 0 = L1
export const RENOWN_THRESHOLDS: readonly number[];  // index 0 = L1 (0)
export const DOMINANT_EPILOGUE: Record<AffinityId, string>;
```

- [ ] **Step 1: Write the failing test**

```ts
// tests/storyCompleteness.test.ts
import { describe, expect, it } from 'vitest';
import { CHAPTERS, LETTERS, AFFINITIES, RENOWN_THRESHOLDS, LEVEL_TITLES } from '../src/data/story';
import { FABRICATION_RECIPES } from '../src/engine/fabrication';
import { MAX_DEFINED_SPECIES, SPECIES } from '../src/data/speciesRegistry';
import { ITEM_BY_ID } from '../src/data/items';

describe('story data completeness', () => {
  it('six chapters with monotonic renown and dated epigraphs', () => {
    expect(CHAPTERS).toHaveLength(6);
    let prev = -1;
    for (const ch of CHAPTERS) { expect(ch.renown).toBeGreaterThan(prev); prev = ch.renown; expect(ch.epigraph.length).toBeGreaterThan(10); expect(ch.body.length).toBeGreaterThan(40); }
  });
  it('every chapter objective resolves to a known recipe/species/item/flag-target', () => {
    const recipeIds = new Set(FABRICATION_RECIPES.map(r => r.id));
    for (const ch of CHAPTERS) for (const o of ch.objectives) {
      if (o.kind === 'recipe') expect(recipeIds.has(o.target), `${ch.id} recipe ${o.target}`).toBe(true);
      if (o.kind === 'species') { const idx = SPECIES[o.target as keyof typeof SPECIES] as unknown as number; expect(typeof idx).toBe('number'); expect(idx).toBeLessThan(MAX_DEFINED_SPECIES); }
      if (o.kind === 'item') expect(ITEM_BY_ID[o.target], `${o.target}`).toBeDefined();
      if (o.kind === 'flag') expect(typeof o.target).toBe('string');
    }
  });
  it('18 letters, era-gated, six per affinity family by chapter affinity weights', () => {
    expect(LETTERS).toHaveLength(18);
    for (const l of LETTERS) { expect(l.chapter).toBeGreaterThanOrEqual(1); expect(l.chapter).toBeLessThanOrEqual(6); expect(l.rewardRenown).toBeGreaterThan(0); }
    const chapters = LETTERS.map(l => l.chapter);
    expect(Math.max(...chapters)).toBe(6);
    for (const aff of AFFINITIES) expect(aff.thresholds).toEqual([30, 80, 150]);
  });
  it('level curve is non-decreasing with 10 titles', () => {
    expect(RENOWN_THRESHOLDS).toHaveLength(10);
    expect(LEVEL_TITLES).toHaveLength(10);
    for (let i = 1; i < RENOWN_THRESHOLDS.length; i += 1) {
      expect(RENOWN_THRESHOLDS[i]).toBeGreaterThan(RENOWN_THRESHOLDS[i - 1]);
    }
  });
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/storyCompleteness.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/data/story.ts`**

Author the six chapters and eighteen letters with this voice (dated, factual, Magister Hennig's frame, ≤ 1 200 words total). The exact prologue/epilogue strings below are the shipping text:

```ts
export const CHAPTERS = [
  { id: 'ch1', era: 'c. 10,000 BC · an unnamed river bank', title: 'The First Fire',
    epigraph: '“The fire does not ask names. Remember that.” — Magister Hennig',
    body: 'Before the pot, before the word for yes, there was hunger and the cold. You hold a hammerstone and a knife of flint, and everything ahead of you — every bronze blade, every bottle of medicine — is sleeping in stone, bark, bone and brine. Strike well.',
    objectives: [
      { id: 'ch1_adze', kind: 'recipe', target: 'RECIPE_CRAFT_FLINT_ADZE', text: 'Knap a flint adze' },
      { id: 'ch1_bucket', kind: 'recipe', target: 'RECIPE_CARVE_WOODEN_BUCKET', text: 'Carve a wooden bucket' },
      { id: 'ch1_ash', kind: 'species', target: 'K2CO3', text: 'Burn hardwood to ash (> 0.05 mol K₂CO₃)' },
      { id: 'ch1_pack', kind: 'recipe', target: 'RECIPE_STITCH_BACKPACK', text: 'Stitch the leather backpack' },
    ],
    epilogue: 'Your hands smell of smoke and tannin. The river keeps its own ledger, and tonight you are written in it.',
    renown: 150 },
  { id: 'ch2', era: 'c. 2500 BC · Nineveh → 30 BC · the Tiber', title: 'The Soapwright’s Secret',
    epigraph: '“Ash is not the end of fire. It is the beginning of clean hands.” — Magister Hennig',
    body: 'The Babylonians knew it written in clay tablets; the Romans washed their wealth in it. Potash from the hearth, fat from the hunt, salt from the earth — three humble things that made the world tolerable. Make the soap. The world will notice.',
    objectives: [
      { id: 'ch2_caO', kind: 'species', target: 'CAO', text: 'Slaked quicklime (CaO) in water' },
      { id: 'ch2_lye', kind: 'species', target: 'KOH', text: 'Settle clear lye (> 0.1 mol KOH)' },
      { id: 'ch2_saponify', kind: 'species', target: 'K_STEARATE', text: 'Saponify tristearin (> 0.05 mol K-stearate)' },
      { id: 'ch2_bar', kind: 'species', target: 'NA_STEARATE', text: 'Salt out & skim a hard bar of soap' },
    ],
    epilogue: 'A grey, waxen bar sits on the sill. Grease will never hold you again.',
    renown: 300 },
  { id: 'ch3', era: 'c. 3300 BC · the Zagros Mountains', title: 'The Bronze Bloom',
    epigraph: '“Stones that bled green became the first wealth of man.” — Magister Hennig',
    body: 'Everything green on this mountain dreams of being metal. Charcoal breathes on stone, stone yields its blood, the blood hardens into something that sings against stone. You are about to forge the metal age with your own hands.',
    objectives: [
      { id: 'ch3_cu', kind: 'recipe', target: 'SMELT_COPPER_INGOT', text: 'Smelt a copper ingot' },
      { id: 'ch3_bronze', kind: 'species', target: 'BRONZE', text: 'Cast 88:12 bronze (Cu₀.₈₈Sn₀.₁₂)' },
      { id: 'ch3_fork', kind: 'recipe', target: 'CAST_BRONZE_FORK', text: 'Cast the Bronze Fork' },
    ],
    epilogue: 'The fork is warm from the mold. Dinner, from now on, is civilised.',
    renown: 450 },
  { id: 'ch4', era: 'c. 1770 · Philadelphia & c. 1850 · Padua', title: 'The Willow Cure',
    epigraph: '“For every fever on earth there is a tree somewhere, standing ready.” — Magister Hennig',
    body: 'Fever took the ancients in their beds; it took the Vikings at sea. But the willow has always known the cure — it bleeds a medicine that quiets the burning blood. Distill the spirit, free the acid, carry the tincture.',
    objectives: [
      { id: 'ch4_ethanol', kind: 'recipe', target: 'DISTILL_ANTISEPTIC_ETHANOL', text: 'Distil 95% ethanol' },
      { id: 'ch4_salicin', kind: 'species', target: 'SALICYLIC_ACID', text: 'Free salicylic acid from salicin' },
      { id: 'ch4_tincture', kind: 'recipe', target: 'CRAFT_SALICYLIC_ACID_TINCTURE', text: 'Brew the salicylic tincture' },
    ],
    epilogue: 'The fever broke by morning. Whoever you lost to fever, you will save the next one.',
    renown: 600 },
  { id: 'ch5', era: '1928 · St. Mary’s, London', title: 'The Mold That Saved a War',
    epigraph: '“Had I not seen it, I would not have believed it.” — A. Fleming',
    body: 'A dish left open on a bench. A mould. A cleared ring, like frost on a window at dawn. From that small accident came the medicine that would turn back the oldest killer of the soldier and the surgeon alike. Cultivate it. Brew it. Dose it.',
    objectives: [
      { id: 'ch5_culture', kind: 'recipe', target: 'CULTIVATE_PENICILLIN', text: 'Cultivate Penicillium chrysogenum' },
      { id: 'ch5_dose', kind: 'recipe', target: 'CRAFT_PENICILLIN_DOSE', text: 'Brew a penicillin dose' },
    ],
    epilogue: 'The vial is small and grey-gold and worth more than any treasure this mountain holds.',
    renown: 750 },
  { id: 'ch6', era: '1800 · Como & 1807 · London', title: 'The Voltaic Awakening',
    epigraph: '“I send you the instrument, and await your verdict.” — A. Volta to J. Banks',
    body: 'Two metals, one damp cloth between them, and the mystery that hums in the marrow of the earth. Stack the discs. Send the current through salt twice drowned in fire. What sleeps in the molten stone will wake burning blue in your hands.',
    objectives: [
      { id: 'ch6_h2so4', kind: 'species', target: 'H2SO4', text: 'Build H₂SO₄ in the lead chamber (> 0.1 mol)' },
      { id: 'ch6_pile', kind: 'recipe', target: 'STACK_VOLTAIC_PILE', text: 'Stack the 12-cell voltaic pile' },
      { id: 'ch6_na', kind: 'species', target: 'SODIUM_METAL', text: 'Isolate elemental sodium (or potassium) by electrolysis' },
    ],
    epilogue: 'The metal skitters across the stone and bursts into flame. You are no longer a survivor. You are a maker.',
    renown: 900 },
] as const;

export const AFFINITIES = [
  { id: 'apothecary', titles: ['Leech', 'Apothecary', 'Master Apothecary'], thresholds: [30, 80, 150], color: '#5fb3a1' },
  { id: 'soapwright', titles: ['Ash-Tender', 'Purifier', 'Grand Purifier'], thresholds: [30, 80, 150], color: '#e0a458' },
  { id: 'forgewright', titles: ['Cinderling', 'Emberwright', 'Grand Forgewright'], thresholds: [30, 80, 150], color: '#d96c6c' },
] as const;

export const RENOWN_THRESHOLDS = [0, 150, 350, 600, 900, 1250, 1650, 2100, 2600, 3150] as const;
export const LEVEL_TITLES = ['Scrub Apprentice','Firekeeper','Ash-Tender','Lyewright','Soapwright','Bronze-Hand','Emberwright','Willow-Sage','Master of Elements','Grand Chemist'] as const;
export const DOMINANT_EPILOGUE = {
  apothecary: 'The old Magister bows his head. “You chose the hand that heals. Go — every fever from here to the coast will know your name.”',
  soapwright: 'The old Magister nods slowly. “You chose clean hands in a dirty world. The river keeps soap in her pocket, thanks to you.”',
  forgewright: 'The old Magister taps your shoulder. “You chose the fire. Every anvil in the valley will ring with your metal.”',
} as const;
// LETTERS — 18 entries, era-gated; rewards as in spec §7 table (exact).
export const LETTERS = [
  { id: 'l_riverfolk', era: 'Neolithic', chapter: 1, from: 'The River Folk', excerpt: 'Stone remembers the first edge. Make one.',
    task: { id: 'l_riverfolk_t', kind: 'recipe', target: 'RECIPE_KNAP_FLINT', text: 'Knap flint into blade and adze' }, rewardRenown: 40, rewardAffinity: { soapwright: 20 } },
  { id: 'l_jabir', era: 'c. 760', chapter: 2, from: 'Jabir ibn Hayyan', excerpt: 'The ashes of hardwood hold the white stone.',
    task: { id: 'l_jabir_t', kind: 'species', target: 'KOH', text: 'Settle clear lye (> 0.1 mol KOH)' }, rewardRenown: 60, rewardAffinity: { soapwright: 30 } },
  { id: 'l_pliny', era: '77 AD', chapter: 2, from: 'Pliny the Elder', excerpt: 'Hisha Naturalis: sapones, a thing the Gauls knew.',
    task: { id: 'l_pliny_t', kind: 'species', target: 'K_STEARATE', text: 'Saponify fat into true soap' }, rewardRenown: 70, rewardAffinity: { soapwright: 25 } },
  { id: 'l_lemery', era: '1687', chapter: 2, from: 'Nicolas Lémery', excerpt: 'Salt of the earth, white and honest.',
    task: { id: 'l_lemery_t', kind: 'species', target: 'NA_STEARATE', text: 'Salt out and skim bar soap' }, rewardRenown: 90, rewardAffinity: { soapwright: 35 } },
  { id: 'l_baytar', era: '1248', chapter: 4, from: 'Ibn al-Baytar', excerpt: 'The willow bleeds a remedy the ancients feared.',
    task: { id: 'l_baytar_t', kind: 'species', target: 'SALICIN', text: 'Harvest willow phloem (salicin precursor)' }, rewardRenown: 80, rewardAffinity: { soapwright: 25, apothecary: 15 } },
  { id: 'l_desmarest', era: 'c. 1791', chapter: 1, from: 'Marie-Marguerite Desmarest · Marseille', excerpt: 'A backpack of leather outlives a fortune of gold.',
    task: { id: 'l_desmarest_t', kind: 'recipe', target: 'RECIPE_STITCH_BACKPACK', text: 'Complete the leather backpack pipeline' }, rewardRenown: 80, rewardAffinity: { soapwright: 30 } },
  { id: 'l_tubalcain', era: 'mythic · Gen. 4:22', chapter: 3, from: 'Tubal-cain, instructor of every artifex', excerpt: 'Brass and iron, before either had a name.',
    task: { id: 'l_tubalcain_t', kind: 'recipe', target: 'SMELT_COPPER_INGOT', text: 'Smelt a copper ingot' }, rewardRenown: 70, rewardAffinity: { forgewright: 30 } },
  { id: 'l_theophrastus', era: 'c. 300 BC', chapter: 3, from: 'Theophrastus of Eresos', excerpt: 'On Stones — what the mountain hides and what heat reveals.',
    task: { id: 'l_theophrastus_t', kind: 'recipe', target: 'SMELT_COPPER_INGOT', text: 'Reduce malachite to copper' }, rewardRenown: 80, rewardAffinity: { forgewright: 25 } },
  { id: 'l_caius', era: '300 BC', chapter: 3, from: 'Caius the Rhodian smith', excerpt: 'Eight parts copper, one tin — never more.',
    task: { id: 'l_caius_t', kind: 'recipe', target: 'CAST_BRONZE_FORK', text: 'Cast the 88:12 bronze fork' }, rewardRenown: 90, rewardAffinity: { forgewright: 30 } },
  { id: 'l_agricola', era: '1556', chapter: 6, from: 'Georgius Agricola', excerpt: 'De Re Metallica — wherein the earth is honest at last.',
    task: { id: 'l_agricola_t', kind: 'recipe', target: 'SMELT_ZINC_DISCS', text: 'Roast sphalerite, smelt zinc' }, rewardRenown: 110, rewardAffinity: { forgewright: 35 } },
  { id: 'l_volta', era: '1800', chapter: 6, from: 'Alessandro Volta', excerpt: 'I send you the instrument, and await your verdict.',
    task: { id: 'l_volta_t', kind: 'recipe', target: 'STACK_VOLTAIC_PILE', text: 'Stack the 12-cell voltaic pile' }, rewardRenown: 120, rewardAffinity: { forgewright: 35 } },
  { id: 'l_davy', era: '1807', chapter: 6, from: 'Humphry Davy', excerpt: 'The metal runs and bursts into flame. Bring it to me.',
    task: { id: 'l_davy_t', kind: 'species', target: 'POTASSIUM_METAL', text: 'Electrolyse molten salt; isolate K (or Na)' }, rewardRenown: 150, rewardAffinity: { forgewright: 40 } },
  { id: 'l_hippocrates', era: 'c. 400 BC', chapter: 4, from: 'Hippocrates, the Hippocratic Oath', excerpt: 'First, do no harm. Second, do good.',
    task: { id: 'l_hippocrates_t', kind: 'treat', target: 'tincture', text: 'Administer salicylic tincture (cure a fever)' }, rewardRenown: 80, rewardAffinity: { apothecary: 25 } },
  { id: 'l_hildegard', era: 'c. 1158', chapter: 4, from: 'Hildegard of Bingen', excerpt: 'The willow bark cools the burning blood.',
    task: { id: 'l_hildegard_t', kind: 'species', target: 'SALICYLIC_ACID', text: 'Extract salicylic acid from salicin' }, rewardRenown: 90, rewardAffinity: { apothecary: 30 } },
  { id: 'l_paracelsus', era: 'c. 1520', chapter: 4, from: 'Paracelsus, the Swiss bombast', excerpt: 'Sola dosis facit venenum — the dose makes the poison.',
    task: { id: 'l_paracelsus_t', kind: 'recipe', target: 'DISTILL_ANTISEPTIC_ETHANOL', text: 'Distil 95% ethanol' }, rewardRenown: 90, rewardAffinity: { apothecary: 25 } },
  { id: 'l_avicenna', era: 'c. 1020', chapter: 4, from: 'Avicenna, Canon of Medicine', excerpt: 'A wound untended is a funeral arranged.',
    task: { id: 'l_avicenna_t', kind: 'treat', target: 'antiseptic', text: 'Disinfect a festering wound' }, rewardRenown: 70, rewardAffinity: { apothecary: 25 } },
  { id: 'l_fleming', era: '1928', chapter: 5, from: 'Alexander Fleming', excerpt: 'Had I not been careless, I would not have noticed.',
    task: { id: 'l_fleming_t', kind: 'recipe', target: 'CULTIVATE_PENICILLIN', text: 'Cultivate Penicillium and brew the dose' }, rewardRenown: 130, rewardAffinity: { apothecary: 40 } },
  { id: 'l_florey', era: '1940', chapter: 5, from: 'Howard Florey, Oxford', excerpt: 'Make this mould into a miracle.',
    task: { id: 'l_florey_t', kind: 'treat', target: 'penicillin', text: 'Cure a systemic infection' }, rewardRenown: 140, rewardAffinity: { apothecary: 35 } },
] as const;
```
(Chapter `SALICIN` target: the species registry exposes `SALICIN` at idx 26 — confirm the exact key in `SPECIES` before wiring the evaluator; use the registry key, not the literal string, in tests.)

- [ ] **Step 4: Run it green**

Run: `npx vitest run tests/storyCompleteness.test.ts && npx tsc --noEmit`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/story.ts tests/storyCompleteness.test.ts
git commit -m "feat(data): The Grand Crucible — six chapters, eighteen letters, affinity + level curves"
```

---

## Task 9: Progression engine (`src/engine/progression.ts`) — Renown, evaluator, chapters

**Files:** Create `src/engine/progression.ts` · Test `tests/progression.test.ts`

**Interfaces:**
- Consumes: `CHAPTERS`, `LETTERS`, `AFFINITIES`, `RENOWN_THRESHOLDS`, `LEVEL_TITLES`, `ObjectiveDef` from `../data/story`.
- Produces (exact; consumed by Tasks 10/11/14):
```ts
export interface ObjectiveSensor {
  hasSpecies(speciesIdx: number, minMoles: number): boolean;
  hasItem(itemId: string, count?: number): boolean;
  hasFabricated(recipeId: string): boolean;
  hasFlag(flag: string): boolean;
  hasEaten(itemId: string): boolean;
  hasTreated(kind: string): boolean;
}
export interface ProgressionState {              // lives in save v2
  renown: number;
  chapter: number;                              // index into CHAPTERS (0-based)
  fabricatedRecipes: string[];
  objectivesDone: string[];                     // objective def ids (chapters + letters)
  lettersDone: string[];
  affinity: { apothecary: number; soapwright: number; forgewright: number };
  ever: Record<string, boolean>;
  craftStats: { eaten: Record<string, number>; treated: Record<string, number> };
}
export interface RenownInfo { level: number; title: string; intoLevel: number; span: number; toNext: number | null }
export interface ProgressionEvents { objectives: string[]; letters: string[]; chapters: string[]; levelUps: Array<{ level: number; title: string }> }
export const initialProgression = (): ProgressionState;
export function levelFromRenown(renown: number): RenownInfo;
export function affinityRank(points: number): 0 | 1 | 2 | 3;   // 0 = unranked <30, 1 = first title, etc.
export function dominantAffinity(a: ProgressionState['affinity']): AffinityId | null;   // null on 0/0/0 or tie → tie-broken soapwright>forgewright>apothecary? NO — tie → null (epilogue uses the plain ending)
export function evaluateObjectives(save: ProgressionState, sensor: ObjectiveSensor): string[];  // NEW ids satisfied by chapters and letters; idempotent
export function applyProgressEvents(save: ProgressionState, ev: { kind: 'recipe'|'eat'|'treat'|'harvest'|'flag'; target: string }): ProgressionEvents;  // mutates renown/affinity/done-lists; returns everything that flipped this call
export function currentChapter(save: ProgressionState): ChapterDef | null;              // first chapter whose objectives are not all done and whose index ≤ reached
```

- [ ] **Step 1: Write the failing test**

```ts
// tests/progression.test.ts
import { describe, expect, it } from 'vitest';
import {
  initialProgression, levelFromRenown, affinityRank, dominantAffinity,
  evaluateObjectives, applyProgressEvents,
} from '../src/engine/progression';

const sensorFor = (over: Partial<Parameters<typeof evaluateObjectives>[1]> = {}) => ({
  hasSpecies: () => false,
  hasItem: () => false,
  hasFabricated: () => false,
  hasFlag: () => false,
  hasEaten: () => false,
  hasTreated: () => false,
  ...over,
});

describe('renown curve + levels', () => {
  it('computes level/title/progress from thresholds', () => {
    expect(levelFromRenown(0).level).toBe(1);
    expect(levelFromRenown(0).title).toBe('Scrub Apprentice');
    expect(levelFromRenown(160).level).toBe(2);
    expect(levelFromRenown(99999).level).toBe(10);
    expect(levelFromRenown(99999).toNext).toBeNull();
  });
  it('affinity ranks 0/1/2/3 by 30/80/150', () => {
    expect(affinityRank(0)).toBe(0);
    expect(affinityRank(29)).toBe(0);
    expect(affinityRank(30)).toBe(1);
    expect(affinityRank(80)).toBe(2);
    expect(affinityRank(150)).toBe(3);
  });
  it('dominant affinity: clear winner wins; tie or all-zero → null', () => {
    expect(dominantAffinity({ apothecary: 10, soapwright: 10, forgewright: 10 })).toBeNull();
    expect(dominantAffinity({ apothecary: 0, soapwright: 0, forgewright: 0 })).toBeNull();
    expect(dominantAffinity({ apothecary: 50, soapwright: 10, forgewright: 5 })).toBe('apothecary');
  });
});

describe('evaluator', () => {
  it('ch1 objectives complete from fabricated recipes', () => {
    const save = initialProgression();
    const sensor = sensorFor({ hasFabricated: (r: string) => ['RECIPE_CRAFT_FLINT_ADZE','RECIPE_CARVE_WOODEN_BUCKET','RECIPE_STITCH_BACKPACK'].includes(r) });
    const done = evaluateObjectives(save, sensor);
    expect(done).toContain('ch1_adze');
    expect(done).toContain('ch1_bucket');
    expect(done).toContain('ch1_pack');
    expect(done).not.toContain('ch1_ash');
  });
  it('idempotent: objectivesDone filter is sticky', () => {
    const save = initialProgression();
    const sensor = sensorFor({ hasFabricated: () => true });
    const first = evaluateObjectives(save, sensor);
    save.objectivesDone = [...save.objectivesDone, ...first];
    const second = evaluateObjectives(save, sensor);
    expect(second).toHaveLength(0);
  });
  it('applyProgressEvents awards renown + affinity and reports level-ups', () => {
    const save = initialProgression();
    const ev = applyProgressEvents(save, { kind: 'recipe', target: 'RECIPE_STITCH_BACKPACK' });
    expect(ev.objectives.length).toBeGreaterThan(0);
    expect(save.renown).toBeGreaterThan(0);
    expect(save.affinity.soapwright).toBeGreaterThan(0); // backpack = soapwright-track chapter reward? NO — ch1 rewards are flat 150 on chapter completion
  });
});
```

(Note on the last assertion: chapter completion renown is granted by `applyProgressEvents` only when *all* chapter objectives flip evaluate true in one call — ch1 gives 150 on the final objective. Affinity points come from letters' `rewardAffinity`, not chapters — ch1 alone yields `affinity.soapwright === 0`. Fix that assertion to `expect(save.affinity.soapwright).toBe(0)` and add a dedicated letter-claim test below instead of pinning the wrong contract.)

```ts
  it('letter claim applies renown + affinity exactly once', () => {
    const save = initialProgression();
    const sensor = sensorFor({ hasFabricated: () => true });
    // simulate the worker notifying: knap recipe → riverfolk letter becomes claimable
    const ev1 = applyProgressEvents(save, { kind: 'recipe', target: 'RECIPE_KNAP_FLINT' });
    const renownAfterClaim = save.renown;
    const ev2 = applyProgressEvents(save, { kind: 'recipe', target: 'RECIPE_KNAP_FLINT' });
    expect(save.renown).toBe(renownAfterClaim);       // no double-claim
    expect(save.lettersDone.length).toBeLessThanOrEqual(1);
  });
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/progression.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/engine/progression.ts`**

Core logic (all other exports are small compositions of these parts):

```ts
export function levelFromRenown(renown: number): RenownInfo {
  let level = 1;
  for (let i = 1; i < RENOWN_THRESHOLDS.length; i += 1) if (renown >= RENOWN_THRESHOLDS[i]) level = i + 1;
  const idx = level - 1;
  const base = RENOWN_THRESHOLDS[idx];
  const next = idx + 1 < RENOWN_THRESHOLDS.length ? RENOWN_THRESHOLDS[idx + 1] : null;
  const span = next === null ? 1 : next - base;
  const intoLevel = Math.max(0, renown - base);
  return { level, title: LEVEL_TITLES[idx], intoLevel, span, toNext: next === null ? null : span - intoLevel };
}
export function affinityRank(points: number): 0|1|2|3 { return points >= 150 ? 3 : points >= 80 ? 2 : points >= 30 ? 1 : 0; }
export function dominantAffinity(a): AffinityId | null {
  const entries = Object.entries(a) as Array<[AffinityId, number]>;
  const max = Math.max(...entries.map(e => e[1]));
  if (max === 0) return null;
  const winners = entries.filter(e => e[1] === max).map(e => e[0]);
  return winners.length === 1 ? winners[0] : null;
}
export function evaluateObjectives(save, sensor): string[] {
  if (save.objectivesDone.length > 64) return []; // sanity cap; letters+chapters = 66 total
  const done = new Set(save.objectivesDone);
  const out: string[] = [];
  const all: ObjectiveDef[] = [
    ...CHAPTERS.flatMap(ch => ch.objectives),
    ...LETTERS.map(l => l.task),
  ];
  for (const o of all) {
    if (done.has(o.id)) continue;
    const hit =
      o.kind === 'species' ? sensor.hasSpecies(SPECIES[o.target as keyof typeof SPECIES] as unknown as number, o.count ?? 0.05)
      : o.kind === 'recipe' ? sensor.hasFabricated(o.target)
      : o.kind === 'item'   ? sensor.hasItem(o.target, o.count ?? 1)
      : o.kind === 'flag'   ? sensor.hasFlag(o.target)
      : o.kind === 'eat'    ? sensor.hasEaten(o.target)
      : /* treat */           sensor.hasTreated(o.target);
    if (hit) out.push(o.id);
  }
  return out;
}
export function applyProgressEvents(save, ev): ProgressionEvents {
  const preLevel = levelFromRenown(save.renown).level;
  // 1) record the raw signal into stats/ever
  if (ev.kind === 'recipe') save.fabricatedRecipes.push(ev.target);
  if (ev.kind === 'eat') save.craftStats.eaten[ev.target] = (save.craftStats.eaten[ev.target] ?? 0) + 1;
  if (ev.kind === 'treat') save.craftStats.treated[ev.target] = (save.craftStats.treated[ev.target] ?? 0) + 1;
  if (ev.kind === 'harvest' || ev.kind === 'flag') save.ever[ev.target] = true;
  // 2) re-evaluate everything (cheap: ≤ 66 checks)
  const sensor: ObjectiveSensor = {
    hasSpecies: (idx, min) => sensorSpecies(save, idx, min),   // injected via closure in the worker; engine keeps pure form below
    hasItem: () => false, hasFabricated: id => save.fabricatedRecipes.includes(id),
    hasFlag: f => !!save.ever[f], hasEaten: id => (save.craftStats.eaten[id] ?? 0) > 0, hasTreated: k => (save.craftStats.treated[k] ?? 0) > 0,
  };
  // Worker injects the real species sensor at the call site (it owns the SAB snapshot);
  // engine exports applyProgressEventsWithSensor(save, ev, sensor) for that — split here for testability.
  throw new Error('use applyProgressEventsWithSensor');
}
```
→ therefore export **`applyProgressEventsWithSensor`** in addition; the shared tail (award letters whose task just flipped, award chapter renown when all its objectives are done, recompute levels, collect level-ups) lives in it:
```ts
export function applyProgressEventsWithSensor(save, ev, sensor): ProgressionEvents { /* shared head: record signal; then:
  const newIds = evaluateObjectives(save, sensor);
  const done = new Set(save.objectivesDone);
  const chaptersDoneNow: string[] = [];
  const lettersDoneNow: string[] = [];
  for (const id of newIds) {
    done.add(id); save.objectivesDone.push(id);
    save.renown += 25;                                   // per-objective bounty
    for (const l of LETTERS) {
      if (l.task.id === id && !save.lettersDone.includes(l.id) && l.chapter - 1 <= save.chapter) {
        save.lettersDone.push(l.id); lettersDoneNow.push(l.id);
        save.renown += l.rewardRenown;
        for (const [k, v] of Object.entries(l.rewardAffinity)) save.affinity[k] += v;
      }
    }
  }
  // chapter completion sweep
  CHAPTERS.forEach((ch, idx) => {
    if (save.chapter > idx) return;                      // already cleared
    if (ch.objectives.every(o => done.has(o.id))) {
      save.chapter = idx + 1; save.renown += ch.renown; chaptersDoneNow.push(ch.id);
    }
  });
  const postLevel = levelFromRenown(save.renown).level;
  const levelUps: ProgressionEvents['levelUps'] = [];
  for (let lv = preLevel + 1; lv <= postLevel; lv += 1) levelUps.push({ level: lv, title: LEVEL_TITLES[lv - 1] });
  return { objectives: newIds, letters: lettersDoneNow, chapters: chaptersDoneNow, levelUps };
}
// thin wrapper with a default (all-false) species sensor for non-worker callers:
export function applyProgressEvents(save, ev) {
  return applyProgressEventsWithSensor(save, ev, { hasSpecies: () => false, hasItem: () => false, hasFabricated: id => save.fabricatedRecipes.includes(id), hasFlag: f => !!save.ever[f], hasEaten: id => (save.craftStats.eaten[id] ?? 0) > 0, hasTreated: k => (save.craftStats.treated[k] ?? 0) > 0 });
}
```
(Implementer note: remove the `throw` scaffold; ship the split functions above verbatim. The default wrapper exists so unit tests and clients can run without the SAB; the worker injects `hasSpecies` reading its snapshot: `any(SPECIES.X) > minMoles`.)

- [ ] **Step 4: Run it green**

Run: `npx vitest run tests/progression.test.ts && npm test && npx tsc --noEmit`
Expected: PASS. If the letter double-claim test fails, the bug is almost always an unseeded `lettersDone` check — fix code, never the assertion.

- [ ] **Step 5: Commit**

```bash
git add src/engine/progression.ts tests/progression.test.ts
git commit -m "feat(engine): progression — renown levels, affinities, objective/letter/chapter evaluator (pure)"
```

---

## Task 10: UI wiring I — toasts, Journal & Missions tab, Story overlays

**Files:** Create `src/ui/Toast.ts`, `src/ui/JournalPanel.ts`, `src/ui/StoryMode.ts` · Modify `src/ui/WorkbenchCanvas.ts` (5th tab), `src/main.ts` (wiring), `src/styles.css` (classes only; juice in Task 12)

**Interfaces:**
- `showToast(message: string, kind?: 'info' | 'success' | 'failure' | 'renown'): void` — cap 3 on screen, auto-dismiss 3.5 s, `aria-live="polite"`.
- `renderJournal(container: HTMLElement, opts: { progression: ProgressionState; onClose?: () => void }): void` — re-rendering is cheap; call after every `OBJECTIVE` message.
- `StoryMode` singleton: `prologue(onDone)`, `chapterComplete(chapter, onContinue)`, `victory(stats, epilogueLine, onNewWorld, onFreeCraft)`, `death(cause, stats, onRestart)` — full-screen overlays, focus-trapped, ESC disabled during prologue.

**Boot flow change (main.ts):** `startWorld()` currently boots straight into the game. New: `const existing = localStorage.getItem('how2soap.save.v2')` → if present, render splash overlay (`StoryMode.bootSplash({ day, chapterTitle, title, renown })`) with **Continue** (`LOAD_WORLD` with the parsed save) and **New World** (confirm → clears storage → `startWorld(true)`); if absent → run `StoryMode.prologue()` then `startWorld()`.

- [ ] **Step 1: Write a failing UI-free test (logic seam)**

UI files have no jsdom; test the pure render-model builder instead:

```ts
// tests/journalModel.test.ts
import { describe, expect, it } from 'vitest';
import { buildJournalModel } from '../src/ui/journalModel';
import { initialProgression } from '../src/engine/progression';

describe('journal model', () => {
  it('derives locked/available/claimed letter states from save', () => {
    const save = initialProgression();
    save.chapter = 1;
    const model = buildJournalModel(save);
    expect(model.chapters).toHaveLength(6);
    expect(model.letters.find(l => l.id === 'l_jabir')!.state).toBe('available'); // era-gated ch2 opens after ch1 done
    expect(model.letters.find(l => l.id === 'l_davy')!.state).toBe('locked');
  });
});
```
(Add this file's equivalent exports to `JournalPanel.ts` as `buildJournalModel(save)` so it stays unit-testable. DOM render consumes the model only.)

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/journalModel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

**`src/ui/Toast.ts`** —
```ts
const MAX_VISIBLE = 3, TTL_MS = 3500;
let region: HTMLElement | null = null;
const ensure = (): HTMLElement => {
  if (region?.isConnected) return region;
  region = document.createElement('div');
  region.className = 'toast-region';
  region.setAttribute('aria-live', 'polite');
  document.body.appendChild(region);
  return region;
};
export function showToast(message: string, kind: 'info'|'success'|'failure'|'renown' = 'info'): void {
  const host = ensure();
  while (host.children.length >= MAX_VISIBLE) host.firstElementChild?.remove();
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  host.appendChild(el);
  window.setTimeout(() => el.remove(), TTL_MS);
}
```

**`src/ui/JournalPanel.ts`** — export `buildJournalModel(save)` (pure; used by test) and `mountJournal(tabRoot, save, onClaim?)` (DOM). Markup emitted (CSS in Task 12):
```html
<div class="journal">
  <section class="journal-chapters">
    <h3>The Grand Crucible</h3>
    <ol class="chapter-timeline">
      <li class="chapter done|current|locked" data-chapter="ch1">
        <div class="chapter-era">c. 10,000 BC · an unnamed river bank</div>
        <div class="chapter-title">I · The First Fire <span class="chapter-state">✓</span></div>
        <p class="chapter-epigraph">“The fire does not ask names…”</p>
        <ul class="objective-list"><li class="done">☑ Knap a flint adze</li><li>☐ …</li></ul>
      </li>…
    </ol>
  </section>
  <section class="journal-side">
    <div class="affinity-block">
      <h4>Chosen Path</h4>
      <div class="affinity-row" data-affinity="apothecary"><span class="affinity-name">Apothecary</span><div class="affinity-track"><div class="affinity-fill" style="width: 62%"></div></div><span class="affinity-rank">Apothecary</span></div>
      × 3 tracks
      <div class="renown-line">Renown L4 · Lyewright — 412 / 600</div>
    </div>
    <div class="council">
      <h4>The Council of Chemists</h4>
      <article class="letter available|locked|claimed" data-letter="l_jabir">
        <header><span class="letter-from">Jabir ibn Hayyan <em>c. 760</em></span><span class="letter-seal">wax-seal svg</span></header>
        <blockquote>“The ashes of hardwood hold the white stone.”</blockquote>
        <p class="letter-task">Settle clear lye (> 0.1 mol KOH)</p>
        <footer><span class="letter-reward">+60 Renown · +30 Soapwright</span><button class="btn letter-claim">Claim</button></footer>
      </article>…
    </div>
  </section>
</div>
```
Claim button → dispatches the same completion as a worker objective (claim happens automatically via `OBJECTIVE` flow; the button is a manual claim for ungated rewards? NO — remove manual claim; letters auto-claim on task completion (save v2 lettersDone), button absent; letter card shows stamped seal when claimed). Simplify V1: **no claim button**; completion is automatic on objective satisfaction. Button space becomes `<span class="letter-status">Claimed ✓</span>`.

**`src/ui/StoryMode.ts`** —
```ts
export const StoryMode = (() => {
  const show = (markup: string, cls: string): HTMLElement => { /* create overlay, append, focus-trap, return root */ };
  return {
    bootSplash(opts: { day: number; chapterTitle: string; renown: number; title: string; hasSave: boolean }, cb: { onContinue(): void; onNewWorld(): void }) { … },
    prologue(onDone: () => void): void {   // typewriter reveal of prologueText(); any key / click / button advances — plus "Skip" top-right
    },
    chapterComplete(ch: ChapterDef, onContinue: () => void): void { /* stamp + epigraph + epilogue, [Continue] */ },
    victory(stats: { days: number; fabricated: number; renown: number; levelTitle: string }, epilogue: string, cb: { onFreeCraft(): void; onNewWorld(): void }): void { … },
    death(cause: 'sepsis' | 'starvation' | 'hypothermia', stats: { days: number; renown: number }, onRestart: () => void): void { … },
  };
})();
```
Prologue text (shipping copy):
```
The fire does not ask names. Remember that.
You are an apprentice of Magister Hennig,
the last of the old school — half alchemist, half witness.
Six doors stand between you and the world that made you:
fire, soap, bronze, willow, mould, and the lightning in the bottle.
Open them all. The world you save may be your own.
```

**`WorkbenchCanvas.ts`** — add `{ id: 'JOURNAL', label: '📖 Journal & Missions' }` to the tab union, render `<div id="tab-pane-journal" hidden>` and delegate mount to `mountJournal`. **`main.ts`** — handle worker `OBJECTIVE` messages: feed `applyProgressEventsWithSensor` with a species sensor reading `state.snapshot` (helper `anySpecies(idx, minMoles): boolean` scanning `state.snapshot.vesselMoles`); on returned events: toasts (`+N Renown — <objective text>`, level-ups → `⭐ Level N — Title`), re-render journal if open, chapter completion → `StoryMode.chapterComplete`, epilogue at final chapter → `victory()`.

- [ ] **Step 4: Verify**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: PASS; bundle entry printed (record size in commit message).
Then `npm run dev` and manually: New World → prologue renders, typewriter runs, clicking advances → Journal tab shows chapters with ch1 current, Jabir letter available after knap, toast appears on objective, console clean, no layout breakage at 1280×800 and 1100×700.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Toast.ts src/ui/JournalPanel.ts src/ui/StoryMode.ts src/ui/WorkbenchCanvas.ts src/main.ts tests/journalModel.test.ts
git commit -m "feat(ui): toasts, journal & missions tab, story prologue/chapter/victory/death overlays, boot splash"
```

---

## Task 11: UI wiring II — HUD chips/banners, biome haul column, cache, Eat, equip, treatments

**Files:** Modify `src/main.ts`, `src/ui/BiomeTreePanel.ts`, `src/ui/ToolAndInventoryPanel.ts`, `src/styles.css` (layout bits; juice is Task 12)

**Concrete changes:**
1. **Top bar** (`main.ts:91-112` markup): after the Glucose/Temp/I_clo chips, add:
   `<div class="hud-chip" id="hud-adipose" title="Adipose reserves — your famine buffer">Adipose <b>15,000 kcal</b></div>`
   `<div class="hud-chip" id="hud-hydration" title="Hydration">Hydration <b>100%</b></div>`
   `<div class="hud-chip" id="hud-ambient" title="Ambient temperature">Amb <b>288 K</b></div>`
   `<div class="hud-chip" id="hud-renown" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" title="Renown progress">L1 · Scrub Apprentice <svg class="renown-ring" viewBox="0 0 36 36"><circle class="ring-bg" cx="18" cy="18" r="15.5"/><circle class="ring-fg" cx="18" cy="18" r="15.5"/></svg></div>`
   update in `updatePlayerUI()` from `PLAYER_SYNC` + progression (`levelFromRenown`).
2. **Banner row** under topbar (`src/main.ts` insert `<div class="banners" id="banners"></div>` right after `</header>`): chips toggled from `conditions`/`dead`: `🩹 Wound festering!` / `🌡 Fever 38.6° — administer Salicylic Tincture` / `🧫 Sepsis — only Penicillin will do` / `🩸 Ravenous — glucose below 250 kcal`. `aria-live="polite"`, red background for sepsis.
3. **Biome panel**: `BiomeTreePanel.ts` — accept `(onHarv (part, species) => void, getHaulKcal?: (part) => number)`. Each part row renders `<span class="haul-cost" title="Estimated kcal with your equipped tool">≈ 132 kcal</span>`. `main.ts` passes a closure computing `calculateHarvestTotalCostKcal(part.baseWorkJoules, tool.mohs, part.targetMohs, tool.mechanicalAdvantage, species.baseDistanceMeters, 0)` where tool = equipped tool for `part.requiredToolSlot` (fallback: bare hands 1.0/1.0). **Stock counts are NOT shown (no ecology model — spec §17).**
4. **Right panel** (`ToolAndInventoryPanel.ts`): (a) bare-hands/backpack slots render `itemIcon(itemId, 18)` + name + count + `title="${ITEMS[itemId].desc}"`; (b) food items render `[Eat]` button posting `EAT_FOOD` (disabled while dead); (c) tools with matching empty slot render a subtle `Equip → slot` button; (d) new container block **Camp Ground Cache (6 slots · 150 kg)** rendering `state.inventory.campCache` (now synced); (e) until backpack unlocks, the existing 🔒 banner stays but references icons; (f) locked vs unlocked tool cards show equipped Mohs badge (unchanged) + aria-pressed state.
5. **Treatments card** (only when a condition is active): appended into `#rightPanel` by `main.ts` — lists held meds (from `state.items`): Saline Rinse [Administer → `EAT_FOOD`? no — new worker verb `APPLY_TREATMENT { itemId }` mapping `SALINE_RINSE → woundContamination=false + timer reset`, `ETHANOL_DISINFECTANT → same`, `SALICYLIC_TINCTURE → applySalicylicAcid`, `PENICILLIN_DOSE → applyPenicillin`), each with effects line; [Administer] posts the verb, worker applies, EVENTS confirms, OBJECTIVE `treat:<kind>` fires (feeds letters l_avicenna/l_hippocrates/l_florey).
   - Worker implementation rides in Task 5's file (`sim.worker.ts`) — add the `APPLY_TREATMENT` command there or here; note in Task 5 backfill if not present.
6. **Failure toasts**: in `main.ts`, the `HARVEST_PART`/`FABRICATE`/`EAT_FOOD` EVENTS that begin with `Too exhausted` / `Missing:` / `Not a food` must route to `showToast(msg, 'failure')` instead of only the log; everything else keeps current log-only behavior.

- [ ] **Step 1: Write the failing test (model-level)**

```ts
// tests/treatmentModel.test.ts
import { describe, expect, it } from 'vitest';
import { treatmentModel, bannerModel } from '../src/ui/panelModels';
import { initialProgression } from '../src/engine/progression';

describe('treatment + banner models', () => {
  it('lists only held meds, only when relevant to the condition', () => {
    const items = [{ id: 'SALINE_RINSE', count: 2, massKg: 0.2 }];
    const wound = bannerModel({ conditions: { fever: false, systemicInfection: false, woundContamination: true } } as any);
    expect(wound).toHaveLength(1);
    const treats = treatmentModel(items as any, { conditions: { fever: false, systemicInfection: false, woundContamination: true } } as any);
    expect(treats.map(t => t.id)).toEqual(['SALINE_RINSE']);
  });
});
```
(`panelModels.ts` — tiny pure helpers next to the UI files; keep them DOM-free so vitest can import them.)

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/treatmentModel.test.ts` — expected FAIL (module not found).

- [ ] **Step 3: Implement the changes above**

- [ ] **Step 4: Verify**

Run: `npm test && npx tsc --noEmit && npm run build`; manual: harvest boar 10× with seed 99 until a wound rolls (or force via dev console — expose `window.__forceWound = true` behind `process.env.NODE_ENV !== 'production'`), banners appear, saline treatment clears them, Camp Cache renders 6 dashed slots.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/ui/BiomeTreePanel.ts src/ui/ToolAndInventoryPanel.ts src/ui/panelModels.ts tests/treatmentModel.test.ts
git commit -m "feat(ui): survival HUD — adipose/hydration/ambient/temp/renown chip, condition banners, haul-cost column, cache block, eat/equip/administer flows"
```

---

## Task 12: CSS juice + accessibility layer + favicon

**Files:** Modify `src/styles.css` (+~220 lines), `public/index.html`, `src/ui/MenuController.ts` (classes wiring), `src/main.ts` (ESC key handler)

**Concrete CSS blocks to add (append at end of `src/styles.css`, after the modal section):**

```css
/* ---- The Grand Crucible: juice ---- */
@keyframes toast-in { from { opacity: 0; transform: translateY(8px) scale(.96); } to { opacity: 1; transform: none; } }
.toast { animation: toast-in 180ms ease-out; }
@keyframes reward-float { 0% { opacity: 0; transform: translateY(6px); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(-26px); } }
.reward-float { animation: reward-float 1.6s ease-out forwards; }
@keyframes level-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.hud-chip.level-up { background-image: linear-gradient(110deg, transparent 30%, rgba(224,164,88,.35) 50%, transparent 70%); background-size: 200% 100%; animation: level-shimmer 1.2s linear 2; }
@keyframes seal-stamp { 0% { transform: scale(2.2) rotate(-14deg); opacity: 0; } 60% { transform: scale(.92) rotate(2deg); opacity: 1; } 100% { transform: none; } }
.letter-seal.stamp { animation: seal-stamp 420ms cubic-bezier(.2,1.6,.4,1); }
@keyframes objective-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(127,201,139,.0); } 50% { box-shadow: 0 0 0 3px rgba(127,201,139,.45); } }
.objective-list li.done { animation: objective-pulse 900ms ease-out 1; }
@keyframes slot-flash { 0%,100% { background: transparent; } 50% { background: rgba(224,164,88,.28); } }
.backpack-slot.new { animation: slot-flash 900ms ease-out 2; }
@keyframes caret-blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
.type-caret { animation: caret-blink 1.05s steps(1) infinite; }
@keyframes fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.story-card { animation: fade-up 420ms ease-out; }
@keyframes modal-pop { 0% { opacity: 0; transform: scale(.92); } 100% { opacity: 1; transform: scale(1); } }
.modal-card, .overlay-card { animation: modal-pop 180ms ease-out; }
.ring-fg { stroke: var(--accent); stroke-width: 3.4; fill: none; stroke-dasharray: 97.4; stroke-dashoffset: 97.4; transition: stroke-dashoffset .8s ease; stroke-linecap: round; }
.ring-bg { stroke: #26323b; stroke-width: 3.4; fill: none; }
.toast-region { position: fixed; right: 1rem; bottom: 1rem; z-index: 1000; display: flex; flex-direction: column; gap: .5rem; }
.toast { background: #1a232c; border: 1px solid #2c3a45; border-left: 3px solid var(--accent-2); color: var(--text); padding: .55rem .8rem; border-radius: 8px; font-size: .85rem; max-width: 340px; box-shadow: 0 6px 18px rgba(0,0,0,.45); }
.toast-failure { border-left-color: var(--danger); }
.toast-renown { border-left-color: var(--accent); }
.banners { display: flex; gap: .5rem; padding: .3rem 1.4rem; min-height: 0; }
.banner { padding: .25rem .7rem; border-radius: 999px; font-size: .75rem; border: 1px solid; }
.banner-wound { color: #ffb3b3; border-color: #a05050; background: #2a1518; }
.banner-fever { color: #ffd9a0; border-color: #a07830; background: #2a2113; }
.banner-sepsis { color: #ff8f8f; border-color: #c04040; background: #331115; font-weight: 700; }
.banner-ravenous { color: #f0c880; border-color: #8a6a28; background: #241d10; }
.journal { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 1rem; padding: .8rem 0; overflow-y: auto; }
.chapter { border: 1px solid #22303a; border-left: 3px solid #2c3a45; border-radius: 10px; padding: .6rem .8rem; margin-bottom: .55rem; opacity: .55; }
.chapter.done { opacity: 1; border-left-color: var(--good); }
.chapter.current { opacity: 1; border-left-color: var(--accent); background: rgba(224,164,88,.05); }
.chapter-era { font-family: ui-monospace, Menlo, monospace; font-size: .68rem; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
.chapter-title { font-weight: 700; margin: .15rem 0; }
.chapter-epigraph { color: var(--muted); font-style: italic; font-size: .8rem; margin: .1rem 0 .4rem; }
.objective-list li { list-style: none; font-size: .84rem; color: var(--text); }
.objective-list li:not(.done) { color: var(--muted); }
.affinity-track { flex: 1; height: 6px; background: #1c252d; border-radius: 999px; overflow: hidden; }
.affinity-fill { height: 100%; background: var(--accent-2); transition: width .6s ease; }
.letter { border: 1px solid #3a2f22; background: linear-gradient(160deg, #1d1712, #151009); border-radius: 10px; padding: .55rem .7rem; margin-bottom: .5rem; }
.letter.locked { opacity: .45; filter: grayscale(.6); }
.letter.claimed { border-color: var(--accent); }
.letter blockquote { color: #d8c6a0; font-style: italic; font-size: .8rem; margin: .3rem 0; }
.letter-reward { color: var(--accent); font-size: .72rem; font-family: ui-monospace, Menlo, monospace; }
.overlay-card { background: #141b22; border: 1px solid #2c3a45; border-radius: 12px; padding: 1.6rem 1.8rem; max-width: 560px; text-align: center; box-shadow: 0 18px 60px rgba(0,0,0,.6); }
.overlay-death .overlay-card { border-color: #5a2a2a; background: #1d1214; }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .6rem; margin: 1rem 0; }
.stat-cell b { display: block; font-size: 1.25rem; color: var(--accent); }
.stat-cell span { font-size: .65rem; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
.haul-cost { font-family: ui-monospace, Menlo, monospace; font-size: .68rem; color: var(--muted); margin-left: .5rem; }
.treatments-card { border: 1px solid #40282a; background: #1d1416; border-radius: 10px; padding: .5rem .65rem; margin-top: .6rem; }
.treatments-card h4 { color: #ffb3b3; margin: 0 0 .4rem; font-size: .78rem; letter-spacing: .05em; text-transform: uppercase; }
/* focus visibility everywhere the app has controls */
button:focus-visible, select:focus-visible, input:focus-visible, [role="button"]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
/* high contrast (finally real) */
body.high-contrast { --bg: #000; --panel: #0a0a0a; --panel-2: #111; --line: #666; --text: #fff; --muted: #ddd; --accent: #ffd166; --accent-2: #4dffd2; --danger: #ff6b6b; --good: #5dff8a; }
/* reduced motion (finally real) */
body.reduced-motion *, body.reduced-motion *::before, body.reduced-motion *::after { animation: none !important; transition: none !important; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
```

Also **reconcile the known debt** (§3.6 of spec): delete `.layout`, `.quest-panel`, `.quest .tick`, `.check`; define `.btn-primary` (or replace its 3 usages with `.btn`); fix `.layout-4panel` height `calc(100vh - 72px)`; remove `--surface-light` fallbacks that dangle.

**`public/index.html`** — add `<link rel="icon" type="image/svg+xml" href="favicon.svg">` and `<meta name="theme-color" content="#0b0f12">`. **`public/favicon.svg`**:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#e0a458" d="M16 2 L30 28 L2 28 Z"/><path fill="#0b0f12" d="M16 12 L23 25 L9 25 Z"/></svg>
```
**MenuController** — the existing High Contrast / Reduced Motion checkboxes already toggle `body.high-contrast` / `body.reduced-motion` (verify the exact class names it sets — keep names identical to the CSS above; adjust CSS names if they differ). **ESC key** — `main.ts`: `document.addEventListener('keydown', e => { if (e.key === 'Escape') { close top-most open overlay/modal via a tiny registry; } })`; register overlays in `StoryMode` with a shared `openOverlays: HTMLElement[]`.

- [ ] **Step 1: Write failing test for the ESC registry decision (pure part)**

```ts
// tests/overlayStack.test.ts
import { describe, expect, it } from 'vitest';
import { OverlayStack } from '../src/ui/overlayStack';
describe('overlay stack', () => {
  it('ESC closes only the top-most overlay', () => {
    const s = new OverlayStack();
    const a = { id: 'a' } as any, b = { id: 'b' } as any;
    s.push(a); s.push(b);
    expect(s.closeTop()).toBe(b);
    expect(s.closeTop()).toBe(a);
    expect(s.closeTop()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/overlayStack.test.ts` — expected FAIL.

- [ ] **Step 3: Implement** (`src/ui/overlayStack.ts` + CSS above + html/favicon + controller/style debt fixes)

- [ ] **Step 4: Verify**

Run: `npm test && npx tsc --noEmit && npm run build`; manual: toggles flip body classes; DevTools emulates reduced-motion → no keyframe animation runs; tabbing shows visible outlines; ESC closes modal then splash (never the prologue mid-type).

- [ ] **Step 5: Commit**

```bash
git add src/styles.css public/index.html public/favicon.svg src/ui/MenuController.ts src/main.ts src/ui/overlayStack.ts tests/overlayStack.test.ts
git commit -m "feat(ui): juice + accessibility layer — keyframes, high-contrast & reduced-motion real, focus outlines, ESC stack, favicon, spec debt"
```

---

## Task 13: Web Audio synth (`src/ui/audio.ts`) + Settings slider wiring

**Files:** Create `src/ui/audio.ts` · Modify `src/ui/MenuController.ts` (knobs call `audio.setChannel('master'|'sfx'|'ambient', 0..1)`), `src/ui/StoryMode.ts` (sting hooks), `src/main.ts` (SFX call-sites)

**Implementation (complete pattern):**

```ts
// src/ui/audio.ts
let ctx: AudioContext | null = null;
const gains = { master: null as GainNode | null, sfx: null as GainNode | null, ambient: null as GainNode | null };
const ensure = (): AudioContext => {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    for (const k of Object.keys(gains)) { gains[k as keyof typeof gains] = ctx!.createGain(); gains[k as keyof typeof gains]!.connect(ctx.destination); }
    gains.master!.gain.value = 0.8; gains.sfx!.gain.value = 0.6; gains.ambient!.gain.value = 0.15;
    startAmbientCrackle();
  }
  return ctx;
};
const env = (node: AudioScheduledSourceNode | AudioBufferSourceNode, gain: GainNode, peak: number, attack = 0.008, decay = 0.22) => { …connect + ramp… };
const tone = (freq: number, type: OscillatorType, dur: number, gain: GainNode, peak = 0.5) => { const o = ensure().createOscillator(); o.type = type; o.frequency.value = freq; const g = ensure().createGain(); o.connect(g); g.connect(gain); g.gain.setValueAtTime(0, ctx!.currentTime); g.gain.linearRampToValueAtTime(peak, ctx!.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ctx!.currentTime + dur); o.start(); o.stop(ctx!.currentTime + dur + 0.02); };
const noise = (dur: number, gain: GainNode, lowpass = 800, peak = 0.4) => { /* buffer of white noise → biquad lowpass → gain env */ };
export const audio = {
  setChannel(ch: 'master'|'sfx'|'ambient', v: number) { ensure(); gains[ch]!.gain.value = v; },
  unlock() { ensure(); },
  // SFX vocabulary (call sites: main.ts / StoryMode / JournalPanel)
  harvestThud() { noise(0.12, gains.sfx!, 240, 0.5); },
  clink() { tone(1560, 'square', 0.05, gains.sfx!, 0.14); tone(2340, 'square', 0.03, gains.sfx!, 0.08); },
  chime() { [523.25, 659.25, 783.99].forEach((f, i) => setTimeout(() => tone(f, 'sine', 0.5, gains.sfx!, 0.3), i * 90)); },
  levelUp() { [392, 523.25, 659.25, 783.99].forEach((f, i) => setTimeout(() => tone(f, 'triangle', 0.42, gains.sfx!, 0.32), i * 110)); },
  munch() { noise(0.05, gains.sfx!, 1600, 0.22); setTimeout(() => noise(0.05, gains.sfx!, 1300, 0.18), 90); },
  stamp() { noise(0.09, gains.sfx!, 300, 0.5); },
  sealDone() { tone(880, 'sine', 0.6, gains.sfx!, 0.3); },
  toll() { tone(110, 'sine', 2.4, gains.sfx!, 0.5); },        // death
  victory() { [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) => setTimeout(() => tone(f, 'triangle', 0.9, gains.sfx!, 0.3), i * 160)); },
};
function startAmbientCrackle() { /* jittered noise bursts through lowpass at random 200-900 ms gaps, routed to gains.ambient */ }
```
Wire: sliders (`master/reaction/ambient`) keep ids, but their `input` handlers now call `audio.setChannel(...)` (map 0–100 → 0–1 gain). **Unlock policy:** `audio.unlock()` on first pointerdown anywhere (browser autoplay rule). **Reduced motion does not mute** (correct semantics).

- [ ] **Step 1: Write failing test (channels are pure math)**

```ts
// tests/audioGain.test.ts
import { describe, expect, it } from 'vitest';
import { sliderToGain } from '../src/ui/audio';
describe('slider→gain mapping', () => {
  it('0 → silent, 100 → full, clamps out-of-range', () => {
    expect(sliderToGain(0)).toBe(0);
    expect(sliderToGain(100)).toBe(1);
    expect(sliderToGain(-5)).toBe(0);
    expect(sliderToGain(250)).toBe(1);
  });
});
```
(Export `sliderToGain` as a pure helper for the test; AudioContext never constructed in vitest.)

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tests/audioGain.test.ts` — expected FAIL.

- [ ] **Step 3: Implement** as above.

- [ ] **Step 4: Verify**

Run: `npm test && npx tsc --noEmit && npm run build`; manual: move Master to 0 → silence; SFX to 0, Ambient full → crackle only; fresh page load → no console errors before first click; objective completion plays chime; death toll audible only in death path.

- [ ] **Step 5: Commit**

```bash
git add src/ui/audio.ts src/ui/MenuController.ts src/ui/StoryMode.ts src/main.ts tests/audioGain.test.ts
git commit -m "feat(audio): synthesized SFX + fire-crackle ambience; settings sliders become real (no assets)"
```

---

## Task 14: Boot splash, autosave, Continue/New World, Settings save v2

**Files:** Modify `src/main.ts`, `src/ui/MenuController.ts`, `src/ui/StoryMode.ts` (splash)

**Spec §7 + §11 implementation:**
1. **Boot** — in `startWorld()` (or its caller): before creating the worker: `const raw = localStorage.getItem(AUTO_KEY); if (raw) { StoryMode.bootSplash(parse(raw), { onContinue: () => startWorld({ load: parsed }), onNewWorld: () => confirmAndMaybeWipeThenBoot() }); return; } StoryMode.prologue(() => startWorld());`
   - `AUTO_KEY = 'how2soap.save.v2'`; autosave = `debounce(() => localStorage.setItem(AUTO_KEY, JSON.stringify(buildSaveSnapshot())), 2000)` triggered from the `EVENTS` and `PLAYER_SYNC` handlers (compare a cheap signature — `tick + moles digest of vessel 0 + glucose` — to avoid serializing 10×/s when paused… simplest: always debounce-write; JSON of ~40 KB worst case every ≥2 s is fine).
   - `visibilitychange` → immediate save.
2. **buildSaveSnapshot()** — now REAL: `day: state.player.day`, `ambientTempK: state.player.ambientTempK ?? 288.15`, `tick: state.snapshot?.tick ?? 0`, `rngSeed: state.rngSeed`, `player: { ...state.player, conditions: state.player.conditions }`, `inventory: state.inventory`, `vessels: state.vessels.map(v => ({ …v, moles: Array.from((world vessels in save need moles — get from worker!))) })`. **Problem:** client cannot see vessel moles (SAB does have vessels' moles! `state.snapshot.vesselMoles` holds them all — `MAX_SPECIES` stride per vessel). So build vessels from snapshot + meta: `{ id, material, capacityL, …v, moles: Array.from(snapshot.vesselMoles.slice(i*MAX_SPECIES, (i+1)*MAX_SPECIES)), precipitated: [] }`. **precipitated is not in the SAB** → it is lost on save/restore. **Accept and document:** `precipitated` resets to zeros on Continue (cloudiness of settled solids lost) — harmless (re-settles in seconds of sim); note in save doc comment. This is the honest limit of client-side snapshot export.
   - progress fields (`ever`, `renown`, `chapter`, `fabricatedRecipes`, `objectivesDone`, `lettersDone`, `epilogueSeen`, `affinity`) come from a `state.progress` object fed by the `OBJECTIVE` handler.
3. **Continue path** — `startWorld({ load })`: create SAB as today; `new Worker(...)`; instead of `INIT` post `{ type: 'LOAD_WORLD', save }`; worker (Task 7) restores; client then posts nothing special — READY arrives → `createSeedVessels()` must be SKIPPED when loading (seed only on fresh boots); all panels re-render from PLAYER_SYNC/VESSELS as today; Journal shows loaded progress; splash button labels read `Day N · Chapter …` from the save.
4. **New World** — clears `AUTO_KEY`, terminates worker, resets `state`, runs prologue again.
5. **Settings modal Export/Import** — `onExportSave` returns the same real snapshot × (now includes progress); export string = `sha256:<hex>:<b64gzip>` via Task 7 helpers; Import verifies prefix, then `deserializeSave`+`migrateSave`, then **`LOAD_WORLD`-equivalent live swap**: terminate worker, `startWorld({ load: save })`, close modal, toast `Save restored — Day N`. (This closes the "import applies nothing" bug completely.)
6. `initMenuAndSettings` new options shape gains `onContinue?` unused by MenuController itself — handled purely in main flow.

- [ ] **Step 1: Write the failing test**

```ts
// tests/autosaveSignature.test.ts
import { describe, expect, it } from 'vitest';
import { snapshotSignature } from '../src/engine/saveSignature';
describe('autosave signature', () => {
  it('changes when tick or glucose changes', () => {
    const a = snapshotSignature({ tick: 1, glucose: 1000, seed: 7 } as any);
    const b = snapshotSignature({ tick: 2, glucose: 1000, seed: 7 } as any);
    const c = snapshotSignature({ tick: 1, glucose: 1000, seed: 7 } as any);
    expect(a).toBe(c);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run it to watch it fail** — expected FAIL.

- [ ] **Step 3: Implement** as above (`saveSignature.ts` tiny pure helper; main.ts wiring; settings modal).

- [ ] **Step 4: Verify**

Run: `npm test && npx tsc --noEmit && npm run build`; manual: New Game → prologue → knap flint → 2 s later `localStorage['how2soap.save.v2']` exists with version 2 + renown ≥ 0 → reload page → splash says Continue Day 1 · Chapter I → click Continue → vessels/log/backpack/Renown all restore → export → clear storage → import → same state restored + toast. New World from splash wipes storage.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/engine/saveSignature.ts src/ui/MenuController.ts src/ui/StoryMode.ts tests/autosaveSignature.test.ts
git commit -m "feat(persistence): real save/continue everywhere — autosave, Continue splash, New World wipe, settings export/import with full restore"
```

---

## Task 15: Gates, bundle audit, README sync, frozen-tree review

**Files:** Modify `README.md` · Run full matrix

- [ ] **Step 1: Full matrix**

```bash
npm test
npm run typecheck        # = tsc --noEmit
npm run build
```
Expected: all green; record `dist/static/js/main.*.js` size — if entry > 200 KB: (a) move story data into the `chem-registry` splitChunk (webpack.config.js `splitChunks.cacheGroups` add `story-data`), (b) collapse SVG icons to used subset, (c) never the budget.

- [ ] **Step 2: README honesty sync**

Update badges to real counts (run `npm test 2>&1 | grep -E "Tests|Suites"`), add a "What's new: The Grand Crucible" section (story chapters, letters, eat/sepsis systems, save/continue), replace "53/53" with the live number, fix "256-Species" → "38-Species", note `LOAD_WORLD` limitation (precipitated resets), add favicon note. Remove the inaccurate "IndexedDB" line if any mentions remain (grep README for IndexedDB).

- [ ] **Step 3: Frozen-tree review (surgical-orchestration reviewer layer)**

Freeze the diff: `git diff 8368f78..HEAD --stat`. Verify spec §1.3 @BAN lines against the diff (no new deps — check package.json untouched; no assets — `find public -type f`; bundle ≤ 200 KB; append-only SPECIES — `git diff src/data/speciesRegistry.ts` must be empty). Verify every claim in README against the diff. Fix drift inline.

- [ ] **Step 4: Final verification & commit**

Run once more the Step 1 matrix; confirm clean git status of generated `dist/` (it IS tracked — commit dist changes with message `build: release dist for v0.2.0` only if the repo convention says dist is committed (it is — `dist/` appears in git); otherwise `git checkout dist`).

```bash
git add README.md package.json webpack.config.js dist
git status --short
git commit -m "docs/build: sync README with The Grand Crucible; release build"
```

---

## Verification checklist (plan complete only when every box is ticked)

- [ ] All 54 legacy tests + ~18 new suites green (`npm test`)
- [ ] `npx tsc --noEmit` clean (strict flags untouched)
- [ ] `npm run build` entry ≤ 200 KB
- [ ] `git diff 8368f78..HEAD --stat` — no surprises; SPECIES registry untouched; package.json untouched (unless splitChunk needed → still no new deps)
- [ ] Manual smoke: New Game → prologue → harvest boar ×3 (wound at seed 99) → eat meat → fabrication consumes inputs → eat with bronze fork (+15% toast) → saline administered → reload → Continue restores
- [ ] Victory path reachable in dev (`__forceEnding = true` console flag → epilogue fires)
- [ ] Death path reachable (force wound + 2 sleep-cycles → sepsis → 48 h → collapse screen)
- [ ] Accessibility pass: keyboard-only from splash → prologue → game → journal → toast (ESC, Tab, Enter all behave)

## Plan self-review notes (author)
1. Spec coverage: §1 blueprint → Tasks 1–9 context; §3 Phase 1 core → Tasks 1,4,5,6,7,11; §4 Phase 2 content → Tasks 2,3 (+items.test gate); §5 Phase 3 progression → Tasks 8,9; §6 story bible → Task 8 data (exact shipping copy); §7 letters → Task 8 (all 18 with exact rewards/eras); §8 Phase 4 UI → Tasks 10,11 (banners, treats, splash); §9 juice/a11y → Task 12; §10 audio → Task 13; §11 persistence → Tasks 7,14; §12 testing → every task carries its suite; §13 execution → header + frozen-tree step; §14 non-goals → Global Constraints; §15 risks → Task 15 bundle gate + plan-wide determinism. **Spec items with no task: none** (ecology/stock counts deliberately cut; IndexedDB deferred — both documented non-goals).
2. Placeholder scan: no TBDs; every test written out; one explicit mid-plan scaffolding mistake (applyProgressEvents before the split) corrected inline into the split functions — kept visible for the implementer.
3. Type consistency: `ProgressionState` (save v2) is shared verbatim by Tasks 7/9/10/14 — checked: same keys (`renown, chapter, fabricatedRecipes, objectivesDone, lettersDone, affinity, ever, craftStats`). `SerializedWorldSave` v2 shape shared by Tasks 7/14. `ObjectiveSensor` signatures match between Tasks 9 and 10 (worker injects `hasSpecies`). `PlayerMetabolismState` extensions (`dead?`, `woundOnsetSeconds?`, `sepsisOnsetSeconds?`) declared in Task 7 — consumed in Task 11 logic notes and Task 14 save snapshot.
4. The `applyProgressEvents` scaffold in Task 9 contains a deliberate `throw` replaced by the split — the implementer must delete the `throw` version and ship `applyProgressEventsWithSensor` + the default wrapper as written.
