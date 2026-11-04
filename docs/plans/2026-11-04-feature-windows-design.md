# Feature Windows — Design for How2Soap's Major Features

**Status:** DESIGN — awaiting approval · **Date:** 2026-11-04 · **Scope:** UI architecture only; no engine changes unless noted
**Trigger (user):** "FEATURES NEEDING INDIVIDUAL WINDOWS AND MORE DETAIL: BIOME EXPLORER, CHEMICAL WORK BENCH, FABRICATION BENCH, ANIMAL PADDOCKS AND MANY MORE! INVESTIGATE AND DESIGN ACCORDINGLY!!!!"

---

## 0. What the user gets

Every major feature opens as an **individual window** — a focused, full-detail dialog layered over the simulation — instead of being squeezed into a 4-column grid or a narrow tab. The sim continues underneath; windows are how the player *works on* things.

## 1. Investigation findings (measured, not vibes)

### 1.1 Current shell (`src/styles.css:428`)
`.layout-4panel` = fixed grid `310px | 210px | 1fr | 340px`, `height: calc(100vh - 72px)`, no page scroll. Four permanently-visible columns, each with hard width limits:

| Panel | File | Size | What fits |
|---|---|---|---|
| Biome Explorer (left) | `BiomeTreePanel.ts` (71 LOC) | 310px | Species list only — no detail pane, no search/filter; costs shown inline |
| Vessels (center-left) | `views.ts` (refactor) | 210px | Vessel buttons + "+ Add bucket" — fine as-is |
| Workbench (center) | `tab-*` + `views.ts` + 4 UI modules | 1fr | **Tabbed**: REACTIONS (inline vessel table + 180px-tall 3D bench), FABRICATION (`renderFabricationTab` — every recipe card in a ~700px scroll), PADDOCKS, STRATEGY, JOURNAL |
| Tools & Inventory (right) | `ToolAndInventoryPanel.ts` (214 LOC) | 340px | 6 tool slots + 2×2 bare hands + 24-slot backpack + treatments — dense even at 340px |

### 1.2 Honesty defects found while investigating (must fix in the redesign)
1. **Paddock roster is fake** — `renderPaddockTab` hardcodes "Capra hircus … 1.2 L milk / 54 g butterfat per day" rows regardless of actual `paddock.animals[]` (worker sends real `animals` in `PLAYER_SYNC.paddock`). A player with zero goats sees goat yields.
2. **Feeding costs nothing** — FEED_PADDOCK just increments `storedFeedKg`; no fodder item is consumed. (Decision needed — see §7.)
3. **Fabrication has no search, no filter, no live "can I afford this" check** — 60+ recipe cards rendered flat; the button is never disabled with a reason; missing inputs are invisible until FABRICATE fails via worker EVENTS.
4. **Biome Explorer has no species detail view** — description exists in data (`p.description`) but the panel gives no room for tool-vs-Mohs math, yields, distance→kcal curves.
5. **Workbench is a context switch with gold content trapped at 180px height** — the WebGL diorama + 4 readouts + salt/ash buttons all live in the 1fr column; on <1200px it's unusable.
6. **Chemical Compendium (38 species), Settings, Save/Export all live behind one modal** (`MenuController.ts`) with three tabs — proven pattern, but cramped and visually identical to the rest of the game.

### 1.3 What already works and we keep
- Modal overlays: `StoryMode` (overlayStack), `CrisisModal` (role=dialog + focus trap), `MenuController` modal — the pattern is proven; `MenuController` even already dedupes its modal by ID.
- `workerMessages.ts` dispatch + `src/app/` orchestration layer — windows mount/unmount through it.
- 3D Bench (`LabBench3DCanvas`) — promote it, don't rewrite it.
- Strategy map, Journal model (`buildJournalModel` — already pure + testable).

## 2. Architecture — `src/ui/WindowManager.ts`

### 2.1 Contract
```ts
export interface WindowSpec {
  id: string;                    // 'biome' | 'reactions' | 'fabrication' | 'paddocks' | ...
  title: string;
  icon: string;                  // emoji/glyph, consistent with nav
  width?: 'narrow' | 'wide' | 'full';  // 480px | 840px | min(96vw, 1200px)
  onMount: (body: HTMLElement) => void; // renderer fills in details
  onClose?: () => void;          // optional teardown (timers, rAF)
}

export const WindowManager = {
  open(spec: WindowSpec): void;   // singleton per id: re-open focuses existing
  close(id: string): void;
  closeTop(): void;
  isOpen(id: string): boolean;
  registerOpeners(navEl: HTMLElement): void;  // wires launcher + buttons
};
```

### 2.2 Behavioral contract (all windows)
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="window-<id>-title"`.
- Focus trap (Tab cycles inside), initial focus on first interactive element or title, **ESC closes** (windows opt into ESC via `overlayStack.closeTop()`), focus returns to the launcher button on close.
- Singleton per id; a second `open()` call restores/raises the existing window instead of stacking duplicates.
- Backdrop: dim + blur; clicking backdrop closes (standard for auxiliary windows — never for CrisisModal).
- One window open at a time in v1 (modal); v1.1 may allow side-by-side on ≥1600px viewports (explicitly deferred).
- **Mobile**: window becomes a full-screen sheet (`inset: 0`) under 720px; every interactive element ≥24×24 CSS px (WCAG 2.5.8); content scrolls internally.
- Reduced-motion: slide-up animation replaced by instant appearance (`prefers-reduced-motion`).
- No draggable/floating geometry in v1.0 (drag adds zero gameplay and breaks focus predictability; noted as v1.1 option).

### 2.3 Launcher
A slim icon rail appears at the top of the center workbench column (or in the topbar under `⋯`): 🔬 Chemical Workbench · 🔨 Fabrication Bench · 🌾 Animal Paddocks · 🗺️ Strategy & Labor · 📖 Journal · 🎒 Inventory & Tools · 🧭 Biome Explorer · ⚙️ Menu & Compendium. Each button ≥24px, labeled, with `aria-pressed` state. Keyboard shortcuts `1`–`8` (disabled while typing in inputs), `0` = close all. Documented in an in-game help card (already have Menu → Settings).

## 3. Per-feature window specs

### 3.1 Biome Explorer (`biome`, wide) — left panel, promoted
**Layout:** split view — left rail tree (searchable), right species dossier.
**Detail upgrades:**
- **Search + filter**: text filter over species name/id; toggle chips: 🌿 Flora · ⛏️ Mineral · 🐾 Fauna.
- **Species dossier** (per species): icon, name, habitat blurb (`biomeNodes.ts` already carries description), distance (m), difficulty (Mohs vs equipped tool — computed live from `inventory.tools` via the existing `calculateHarvestTotalCostKcal` path), residue notes, parts list.
- **Per part**: name, description, work joules, haul kcal (live, equipped-tool-adjusted), yields (items), required tool slot + icon, and a Harvest button.
- Standing readout: "Your equipped hammer: Mohs 6.5 · MA ×2.0" in the dossier footer.

### 3.2 Chemical Workbench (`reactions`, full) — the heart, finally full-size
**Layout:** two columns inside one full-viewport window.
- **Left column — Bench view**: the WebGL diorama promoted from 180px → fills column (min 320px), vessel selector left, material badge (Wood/Clay/Ceramic/Copper/Borosilicate), lid state toggle, ruptured state banner.
- **Right column — Telemetry & Controls**: T (K/°C), pH with interpretation line ("strongly caustic", "near-neutral"), pressure kPa with warn color >140, volume L; contents table (species, mol, g, phase, sorted by moles); heater slider (0–1200 W) + live equilibrium-temperature preview (existing `predictEquilibriumTempK`); Voltaic Pile V/Ω; condenser routing dropdown; Decant/Skim buttons (with target select); salt/ash/water/fat quick-adds.
- **Bottom strip — Bench history sparkline** (v1.1): client-side ring buffer of `{tick, tempK, pH, pressure}` sampled 1 Hz via the existing 10 Hz snapshot, drawn on a tiny canvas. SAB layout unchanged (67,648 B invariant intact). Shipped only if it stays ≤30 LOC.
- WS: the reaction **string** of the vessel ("K₂CO₃ + Ca(OH)₂ → 2KOH + CaCO₃↓") when a known recipe completes — pulled from `reactionRules.ts` event messages already emitted by the worker (parse-or-ignore; never blocks).

### 3.3 Fabrication Bench (`fabrication`, full) — searchable master/detail
**Layout:** left recipe list (280px) + right detail pane.
- **Search + tier filter chips** (Tier 1–5) + "Craftable now" toggle.
- **List item**: recipe icon, name, kcal cost, have/need indicator dot (green/yellow/red derived from live inventory counts).
- **Detail**: name, tier badge, description, materials list with **live have/need counts** (`"Charcoal 2 × (have 3)"` green / `"KOH pellets 1 × (have 0)"` red + "Missing: 1× Willow Bark…" summary), energy cost adjusted by equipped tool MA, work hours, outputs, "✓ Fabricated" seal if `progression.fabricatedRecipes` includes it.
- **Fabricate button**: disabled with the *reason* rendered inline when infeasible ("Need: 2× charcoal, 1× KOH"), instead of failing after click.
- Fabrication itself still executes through the worker (FABRICATE command unchanged) — the window is a projection, not a second authority.

### 3.4 Animal Paddocks (`paddocks`, wide) — from fake roster to live ledger
**Layout:** header stats + animal cards grid + action footer.
- **Live roster from worker state** (`PLAYER_SYNC.paddock.animals[]` — already shipped): each card = species (emoji/glyph), capture tick, feed/day, water/day, yield/day (milk/butterfat or eggs/guano), age. **No more hardcoded goat rows** — zero animals, zero fake cards; an honest empty state ("Paddock stands empty — capture a goat or fowl to begin").
- **Header stats**: Livestock count · Stored fodder kg · Water trough L · Manure/nitre kg (all live).
- **Projection line** (pure, tested): "Stored fodder feeds your N head for **D** days" = `storedFeedKg / Σ(dailyFeed per animal)`; warn under 3 days.
- **Actions**: +5 kg Fodder, +10 L Water Trough, Capture Goat / Jungle Fowl / Aurochs (with kcal costs), (future) Butcher.
- **Decision baked into design** (§7): feeding draws from camp fodder stock when it exists; if none, fodder is "foraged" for free but capped at 10 kg/day.

### 3.5 Strategy & Labor (`strategy`, full) — Colony Command
Strategy map + colonist roster + job assignment in one window: canvas left (70%), right rail (30%): roster cards with morale bar, archetype color, wage contract, assigned job, stimulant buttons. Same callbacks as today (`onRecruit`, `onAssignJob`, …) — pure re-housing, no engine change.

### 3.6 Journal & Missions (`journal`, wide)
Existing `mountJournal` model renderer, re-homed: letters column (left) + chapters/timeline + affinities with progress tracks. Adds: letter open/close, unread dot on launcher button.

### 3.7 Inventory & Tools (`inventory`, wide)
Tools column (each slot: tool icon, name, **Mohs bar** 0–10, MA multiplier, special note) + containers column (bare hands / backpack / camp cache tabs) + treatment items with live counts and one-click administer.

### 3.8 Compendium & Settings (`menu`, narrow)
Existing `MenuController` modal becomes a window (same tabs: Settings & Audio · Chemical Compendium · Save/Export). WCAG target-size audit applies here too.

## 4. Shell outcome
- The 4-panel grid **stays**, but loses its monopolies: left biome column collapses to a thin icon rail + "Open Biome Explorer" button (or is hidden on <1200px); right tools panel likewise becomes a launcher target (auto-hide <1400px). The center keeps vessel list + active tab, because the bench is moment-to-moment; **everything else is a window.**
- Result: same information density, one-tenth the chrome, detail on demand.

## 5. Phases & gates (all `npm test` + `tsc` + bundle <200 KB at every merge)
- **Phase A** (this design → ~2–3 sessions): WindowManager + CSS foundation + Biome + Chemical Workbench (without sparkline) + Fabrication; 4 launcher buttons; shell reduced; mobile sheet; a11y contract test-first (open/close/ESC/singleton/focus-return via headless boot assertion).
- **Phase B** (~1–2 sessions): Paddocks (live roster + projection + empty state), Strategy window, Inventory window, Menu→window migration, Journal window.
- **Phase C** (polish, ~1 session): bench sparkline, reaction-string display, launcher badge unread counts, extra key shortcuts, playtest pass (external ×5: "find how to craft X" task success ≥90%).
- Save-compat: zero schema changes (UI-only). Crisis modal unchanged (it is deliberately not a window).

## 6. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Window framework vs existing CrisisModal duplication | CrisisModal stays standalone (non-dismissable by design); documented exception |
| `MenuController` id-based dedup conflicts with WindowManager | Migrate, delete modal shell, keep tabs as window body |
| iOS `backdrop-filter` cost on full-screen sheets | `@supports` gate; solid background fallback |
| 1000+-line god components re-created | Each window ≤300 LOC + pure model helpers (fabrication feasibility, paddock projection) unit-tested |
| Layout regressions on small screens | ≥720px sheet mode + Playwright-free manual viewport matrix (1600×900, 1366×768, 1280×720, 390×844) |

## 7. Decisions needed from you (defaults in brackets — say "all defaults" to accept)
1. **Workbench becomes a window too, or stays inline?** [Stays inline for REACTIONS; everything else windows. Rationale: bench is the moment-to-moment loop.]
2. **Feeding animals — free button or consume fodder?** [Consume `ANIMAL_FODDER` from camp cache when present; else free forage up to 10 kg/day. Needs item if missing — check `items.ts`.]
3. **Launcher placement** [Icon rail at top of center column] or topbar right […]?
4. **One window at a time** (v1.0 modal) [yes] or allow multi-window on ≥1600px [defer v1.1]?
5. **Phase A scope** [WindowManager + Biome + Chemical Workbench + Fabrication] — or start with Paddocks (fake-roster fix) first?

**Kickoff prompt for execution session:** "Approved — Phase A, defaults, go."
