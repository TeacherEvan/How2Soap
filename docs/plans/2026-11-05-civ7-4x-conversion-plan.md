# Plastic Surgery Blueprint: How2Soap → Alchemist's Empire
## A Civilization VII–class top-down 4X conversion — detailed plan (DRAFT v8)

**Date:** 2026-11-05 · **Status:** Plan (v8 — post-review hardening) — decision gates Q1 (full turn-based) & Q3 (Triumphs + Dedications) **locked** by user 2026-11-05; **recipe property + the Exchange + person-to-person windows + correspondence + The Influence Window + Missions + Built Works (cement/rope/glue/acids/wood composite)** all locked by user steering 2026-11-05 · Q2/Q4/Q5/Q6 defaulted, veto by 2026-11-07 · **Gate:** sign-off on remaining gates required before implementation · **v8 deltas (2026-11-05, post-review):** factual fixes (§6.16 `TimedRequest` wording, D7 attribution), 25-path onboarding math (§6.26), window-ceiling reconciliation (§12); new §4.3 content-authoring pipeline; save-size budget + procedural codex thumbnails (§4.1); falsifiable M2 kill-gate pass table (§9 M2, §12); pre-committed cut ladder + calendar checkpoints (§9); CI named as enforcement surface (§11); new risks (§12); new scope-outs (§13); alternatives-considered recorded (§12)
**Target stack:** TypeScript ES2022 · Webpack 5 · SAB + SeqLock Web Worker (turn-batched) · hand-rolled Canvas 2D (`mapMath.ts`) · lazy Three.js chunk · PWA (SW `how2soap-v1`)

> **This document is the plan. It intentionally changes nothing.** Every "preserve" claim below was verified against the source at this commit (`6cadb71`), file:line included.

---

## 0. Executive Summary

**How2Soap** is an emergent-chemistry survival engine with a working colony-labor layer, a radial ±1600 m survey map, telegraphed crises, renown progression, a chaptered campaign — and, as of 2026-11-05, a mandate to be **chemistry-first, nation-serving**: you start as a **nobody in a mud-port**, craft your first thing and a patron chooses itself, you rise from commissioner to Crown alchemist, you run **multi-turn experiments**, you **build and store recipes**, you **sell your secrets** (or die trying to keep them), you send **op-missions** into rival camps, you woo or **topple the Crown**, you master **masonry** (lime-cement, ropes, glue, acids, laminated wood) against the Wasting — and answer to **three estates** that can rally against you. The Magister never ages; only the country does. Civilization VII is the architecture: three Ages, transitions, Civ-dependent unlocks, Quarters, Triumphs, Influence, endgames.

The honest read: **the game already contains ~40% of a 4X engine in organic form** — a hearth economy, multi-commodity wages, morale, desire-path logistics, seeded cinematic calamities, a six-chapter linear progression that *is* three ages waiting to be decoupled, and a dead `CivBuildPanel.ts` + `tests/civ-ui.test.ts` pair recording Civ VII design intent (adjacency, Quarters, overbuild) explicitly. The conversion is therefore an **architectural lift**, not a rewrite: the chemistry engine, worker spine, save system, and HUD survive largely intact; a new **campaign layer** lands on top of the colony layer, and the clock is reformed into **Civ-style turn-based play** (one turn = one game day, user-locked 2026-11-05).

**What this plan is not:** a claim that solo development ships Civ VII. Scope is tiered (M0–M9) with a vertical-slice gate at M2 — if M2 cannot be played start-to-Age-Transition in one sitting, the rest of the plan does not run.

---

## 1. Phase 0 Record — Alignment (answered 2026-11-05)

| Axis | Verdict | Evidence |
|---|---|---|
| Mobile/Desktop | **Responsive hybrid** | PWA + Vercel COOP/COEP (`vercel.json`), `any-pointer`-aware CSS, `@media (max-width: 720px/1100px)`, coarse-pointer ≥44 px targets (`styles.css:81`) — but map/panel density is desktop-weighted |
| Private/Commercial | **Private, personal, open-source** | `package.json` `"private": true`, MIT, github.com/TeacherEvan/How2Soap, no storefront, $0 recurring budget (contender plan §4) |
| Adult/All audiences | **Adult / specialized** | Dark astrolabe aesthetic, sepsis/hypothermia pathology, "Grand Magister" fiction — but clean-cut: no gore, no age-rated content |

**Workspace theme lock:** *Alchemical Survey Cartography* — slate `#12151c`, brass `#e0a458`, teal `#5fb3a1`, serif display (`Iowan Old Style/Palatino/Georgia`), vignette + scanline, "Council of Solitude correspondence" fiction. The 4X skin must extend this, not replace it.

---

## 2. Phase 1 Record — Investigation & Pre-Op Defect Catalog

### 2.1 Pre-op telemetry scan (skill linter, scoped to shipped surface `src/`)
- **1 HIGH** — `LAYOUT_THRASHING_ANIMATION` at `src/ui/timedRequests.css:89`: `transition: width` on `.req-progress-fill`. Fix: width → `transform: scaleX()` (compositor-only), origin-left. Fold into M0.
- Docs HTML archives report only LOW `NUMERIC_JITTER` noise — out of scope, per skill guidance ("sweep the app root, never chase LOW noise").
- Full-repo gate currently **fails** on that one HIGH; zero other HIGH/MEDIUM findings in `src/`.

### 2.2 Pre-op defect catalog (functional + structural)

| # | Defect | Evidence | Disposition |
|---|---|---|---|
| D1 | `windows.css` (209 LOC, all window/launcher rules incl. `.window-backdrop`, `.launcher-btn`, `.fab-*`, `.bench-win*`) **imported nowhere** — windowed UI ships unstyled in prod | `WindowManager.ts`, `launcher.ts`, `main.ts`; grep = 0 occurrences | M0: import from `main.ts` (eager, ~4 KB) or merge into a chunk CSS |
| D2 | `soapKettle.css` (123 LOC) orphaned the same way | grep = 0 importers | M0 |
| D3 | Strategy-map class drift: JS emits `.strategy-layout`, `.strategy-viewport-container`, `.strategy-map-canvas`, `.map-controls` — **zero CSS rules**; CSS styles `.strategy-canvas`/`.map-controls-overlay` instead | `StrategyMapCanvas.ts:110–790` vs `styles.css:1444–1529` | M0: redefine contract during map rewrite |
| D4 | `timedRequests.css:89` width-animated progress bar (HIGH, above) | §2.1 | M0 |
| D5 | **Save omits colony + paddock; rngSeed regenerated every autosave** — localStorage restore loses the entire colony layer and breaks crisis determinism | `autosave.ts:14–59`; `persistence.ts:18–48` | M0 + hard prerequisite for Age-Transition determinism |
| D6 | Worker `LOAD_WORLD` does not restore `timedRequests`; `emittedSpeciesMilestones` re-emits on load | explore report §8 | M0 (with v3 save shape) |
| D7 | `mandates.ts` — complete "Council mandates" system (72 h timers, renown rewards); **dead in the app** (imported only by `tests/telegraphAndMandates.test.ts`, never wired into the worker or UI) | `engine/mandates.ts:1–62` | **Revive as "Dispatches from the Crown" (§6.18.4)** — the national frame demands timed state requisitions |
| D8 | `worldRestore.ts:restoreWorldFromSave` — inline duplicate used instead | `sim.worker.ts:386–405` | M0: cull or single-source |
| D9 | `CivBuildPanel.ts` — Civ VII HUD scaffold (Yields incl. Influence, District→Quarter, adjacency ghost, Wonder button), **inert; no CSS; no importers; no worker contract** | `CivBuildPanel.ts:1–124`; `tests/civ-ui.test.ts` (conceptual, doesn't import it) | M3: promote concepts into real engine + real CSS; delete stub |
| D10 | `StrategyMap3D.ts` + `GLTFLoader.ts` — orphaned Three.js orthographic mining view + loader wrapper; nothing imports them | full tree grep | M3 (map rewrite) decision: complete as optional 3D view behind a settings toggle, else delete M9 |
| D11 | `StrategyMapCanvas` mixes render + input + dock DOM + **gameplay timers in hot render loop** (hotspot spawner lives in `renderCanvas`) | `StrategyMapCanvas.ts:434–450` | M3 rewrite quarantines hot loop |
| D12 | `COLONY_SYNC` posts full colonist array + 1024-number grid whenever a sync fires — fine ≤30 colonists; under turn-based pacing this self-throttles to once per turn, but the 10 Hz free-run path behind `ADVANCE` still spams during bursts | `sim.worker.ts:214–226, 352` | Auto-mitigated by Q1-b; M2: suppress COLONY_SYNC inside turn bursts except final frame; SAB cannot grow (invariant) |
| D13 | Recruit names use `Math.random()` in UI (cosmetics only) | `StrategyMapCanvas.ts:311–320` | M3: move to seeded worker or keep (cosmetic) — flag only |
| D14 | SAB `SAB_BYTE_LENGTH` documentation defect (spec said 67584, code/tests say 67648) — already resolved in-code; **do not touch** | `memoryLayout.ts:9–20`, `tests/memoryLayout.test.ts` | Preserved verbatim |
| D15 | `timedRequests` fulfillment: renown only; no GDP/Influence hooks | `timedRequests.ts:95–180` | M2: extend, don't replace |
| D16 | No `noUncheckedIndexedAccess` in tsconfig; `any` widespread in worker messages | `tsconfig.json`, `sim.worker.ts:147–270` | M1: tighten new campaign modules only (strict-new, not mass retrofit) |
| D17 | `sw.js` cache `how2soap-v1` must bump on shell change; precache covers only shell | `sw.js:7` | Every milestone that ships assets: bump to `-v2`, verify offline reload |
| D18 | `Growth: no population growth system exists` (recruit-only) | `colony.ts` | M4: settlement population model (§6.4) — new, not a patch |

### 2.3 Invariants that must survive (non-negotiable)
1. `SAB_BYTE_LENGTH === 67648` — enforced by `tests/memoryLayout.test.ts`. **All new systems use structured `postMessage` (like COLONY_SYNC today). The SAB grows never.**
2. `three@0.160.0` pinned, only in a lazy chunk; entrypoint ≤ 200 000 B, `hints:'error'` (`webpack.config.js:106–114`).
3. Entry CSP stays `'self'`-only (`public/index.html:13`); no eval, no inline scripts; SW production-only.
4. `npx tsc --noEmit` = 0; `npx vitest run` green; `npm run build` under budget — the three gates from `AGENTS.md §6`.
5. `window.crossOriginIsolated` flow + `SharedWorldView` SeqLock untouched.
6. HUD contract ids preserved or migrated 1:1 (list §8.1).
7. Accessibility: all interactive targets ≥24 px (≥44 px coarse), `:focus-visible` dual ring `#5aa5ff`, `prefers-reduced-motion` + `prefers-contrast` + `forced-colors` blocks, `role=progressbar`+`aria-valuenow` on progress chips.
8. `globalOverlayStack` + ESC discipline; crisis modal stays ESC-inert by design.
9. Determinism: seeded RNG (`mulberry32`/`hashSeed`) for anything the sim consumes; `Math.random()` permitted only for cosmetic jitter.

### 2.4 Workspace 4X target mapping (theme → technique)
- **Surface/depth:** `oklch()` night-survey slate with +3–4% lightness per z-layer; `inset 0 1px 0 oklch(1 0 0 / .14)` specular top edges; brass 1 px borders; 1.5% SVG anti-banding dither reserved for the map viewport only.
- **Tactile:** six-state buttons (rest → hover lift `translate3d(0,-1px,0)` 140 ms `cubic-bezier(.22,1,.36,1)` → active `25 ms` depress/scale .985 → focus-visible ring → width-locked loading → `disabled` desaturate). No resting `translate3d(0,0,0)` (VRAM).
- **Kinetic:** all decay/spring motion through `expDecay`/`stepSpringSubstepped` (never `* 0.1` per-frame lerps); FLIP for district slot fills; staggered 15–25 ms entrances, ≤250 ms.
- **Telemetry:** `font-variant-numeric: tabular-nums` on every live number (yields, timers, odds, GDP); glowing status pips; `<kbd>` keycaps for launcher shortcuts (existing 1–4, 0 pattern generalizes to 5–7).
- **Budget:** ≤2 overlapping blur layers, ≤16 px radius, DPR clamp [1,2], compositor-only transforms.

---

## 3. Civ VII Research Digest (what we're actually cloning)

Civ VII (Feb 2025) as amended by **Test of Time** (19 May 2026, free, live):

| Pillar | Launch (Feb 2025) | Test of Time (current live canon) | How2Soap verb |
|---|---|---|---|
| **Ages** | Antiquity / Exploration / Modern; new civ pool, new resources/techs/civics, map grows | unchanged (+ Time-Tested civs: stay one civ all game, Syncretism/Affirmation at transitions) | **Adopt.** Three ages (§6.1) |
| **Campaign flow** | Age Progress meter → simultaneous Age Transition for all civs; new map | unchanged | **Adopt** as "The Turning" — §6.2 |
| **Civ switching** | Age-exclusive civs; new civ picked at transition; lineage options from prior civ | **Optional** — may keep one civ (Syncretism/Affirmation) | **Adopt both** — §6.3 |
| **Leader vs Civ** | Decoupled at setup; leaders have Attributes; milestones grant Leader Attribute Points at transitions | 6 Attributes (Militaristic/Cultural/Scientific/Economic/Diplomatic/Expansionist) | **Adopt** — §6.3 |
| **Legacy economy** | Legacy Paths (4/age, age-themed milestones → Legacy Points → Legacy Cards at transition; path complete = Golden Age, ignore whole path = Dark Age) | **Replaced** by **Triumphs** — Major (Dedications at transition) + Minor (instant); six attributes; five default Dedications always available; optional | **Decision gate Q3** (§10) — plan defaults to Test of Time model, data-model-compatible superset |
| **Milestone→transition payout** | Legacy Cards (pick at transition w/ points) | **Dedications** (pick 3/transition; 5 always-available defaults) | **Adopt Dedications** |
| **Crisis** | Multi-stage "Age Crisis" ending each age, hits all civs; outcome seeds Golden/Dark age | "…Managing the previous Crisis successfully" unlocks Dedications | **Adopt** on top of existing `crisis.ts` — §6.9 (the repo's strongest existing asset) |
| **Settlements** | Towns (no build queue, production→Gold, buy with Gold, Focus specializations, growth overflow to cities) vs Cities (full queue); Settlement Limit w/ Happiness penalty; Capital always a City; **overbuilding** old-age buildings at reduced yield; Quarters = 2-building districts; Unique Quarters | unchanged | **Adopt** — §6.4–6.6 |
| **Districts** | Adjacency bonuses; full District = Quarter; placed districts claim adjacent tiles | unchanged | **Adopt** |
| **Influence** | New yield for diplomacy | unchanged | **Adopt** — §6.7 |
| **Independent Powers** | Minor factions, 4 types (Mil/Sci/Cul/Eco); hostile/friendly; befriend→Suzerain; levy/incite/incorporate (influence); vanish at age end; suzerains respawn neutral | unchanged | **Adopt** — §6.8 |
| **Victory** | 4 types gated to Modern age (wonder/relic paths); Points Victory if unclaimed | **Reworked, cross-Age scoring:** Military = **Dominion** (per settlement +2 original capitals/conquered), Cultural = **Tourism** (Wonders, uniques, Celebrations), Economic = **GDP** (slotted resources + gold buildings + treasure convoys/factories), Scientific = **Innovation** (projects, codices, 100 Innovation + launch pad → 5-turn countdown); Exploration Age can crown an early winner; thresholds ramp; score victory breaks ties | **Adopt Test of Time scoring** — §6.10 |
| **Tech & Civic trees** | Two separate trees per age | unchanged | **Adopt** — §6.11 (existing linear tier objectives refactor into trees) |
| **Wonders** | Age-flavored, city-built | unchanged | **Adopt, 9 authored** — §6.12 |
| **Religion** | Minor Antiquity → major Exploration (beliefs) | unchanged | **Cut (v1)** — §6.13, honest rationale |
| **AI** | 7 AI leaders, full diplomacy wars/support | unchanged | **Cut (v1)** — §6.14; solo threshold victories; Rival Expedition stays the scripted antagonist |
| **Fog/exploration** | Distant Lands, new regions per age | new map type in ToT | **Adopt** fog + expanding map (Decision Q2) |

Sources: 2k.com dev diaries (Ages, Test of Time victory/triumph diaries), Polygon/GameSpot/PCGamer Legacy-Path & Influence guides, Civilization Support patch notes 2026-05-19, well-of-souls Civ7 analyst. Key strategic fact: **Test of Time removed the forced-railroad criticism** — the conversion should ship the decoupled system or it clones a design that was already patched out.

---

## 4. Target Architecture (post-conversion)

```
┌─ PUBLIC SHELL (contracts preserved or migrated, §8.1) ─────┐
│ public/index.html  (CSP unchanged)  +  new yield bar chips  │
│ public/sw.js  (bump v2)  ·  manifest unchanged              │
└─────────────────────────────────────────────────────────────┘
┌─ APP ORCHESTRATION  src/app/  (direction unchanged) ─────────┐
│ state.ts  (+state.campaign namespace)  workerMessages.ts     │
│ panels.ts (HUD: End Turn primary, Dawn Report)  ·  views.ts  │
│ worker time: turn-batched day burst on END_TURN (§6.16)      │
│ autosave.ts (v3: colony/paddock/timedRequests/settled fix)   │
└─────────────────────────────────────────────────────────────┘
┌─ UI LAYER  src/ui/ ─────────────────────────────────────────┐
│ StrategyMapCanvas → HEX MAP RENDERER (pure draw, no spawns)  │
│ SettlementWindow (WindowManager) · AgeTransitionOverlay      │
│ YieldBar · TriumphsRail · ColonyDock (renamed dock mental    │
│ model: Tavern→Recruitment is unchanged at the DOM level)     │
└─────────────────────────────────────────────────────────────┘
┌─ ENGINE  src/engine/campaign/  (NEW, pure, node-tested) ─────┐
│ age.ts · settlement.ts · districts.ts · techTrees.ts         │
│ triumphs.ts · influence.ts · independentPowers.ts · victory.ts│
│ wonders.ts · fog.ts · campaignRng (seeds in save v3)         │
│ experiments.ts (§6.17) · realm.ts (§6.18 indices)            │
│ countries.ts (§6.18.0 asymmetry data) · estates.ts (§6.18.8) │
│ recruitment.ts (§6.19.1–2) · bounties.ts (§6.19.3)           │
│ notables.ts (§6.19.4 named souls) · adoption.ts (§6.21        │
│   tech maturity + TEACH_THE_REALM) · milltown buildings via  │
│   the districts engine (§6.20 Lab/Blacksmith/Harbour)        │
│ codex.ts + exchange.ts (§6.27) · correspondence.ts (§6.28)   │
│ influence.ts + rebels.ts (§6.29) · missions.ts (§6.30)       │
└─────────────────────────────────────────────────────────────┘
┌─ UNTOUCHED CORE (invariant) ─────────────────────────────────┐
│ chemistry.ts · memoryLayout.ts (67648) · sim.worker.ts spine │
│ colony.ts · metabolism.ts · crisis.ts · progression.ts       │
└─────────────────────────────────────────────────────────────┘
```

**Dependency direction:** `main → app → ui → engine`. Campaign engine is **pure functions + explicit state** — no DOM, no worker coupling; the worker wires it like crisis.ts today. SAB layout: **bit-identical**. Structured clones carry all new state (settlements are ≤ a few KB each; fog is a packed `Uint8Array` per region sent only on reveal deltas).

### 4.1 Save format v3 (`how2soap.save.v3`, v2 read-compat)
```ts
interface SerializedCampaignSave extends SerializedWorldSave {   // v2 base, colony/paddock now included
  campaignVersion: 3;
  age: 0 | 1 | 2;                    // Age of Ash / Age of Brass / Age of Volta
  ageProgress: number;               // 0..100, deterministic thresholds
  leaderId: string;                  // decoupled leader pick
  civId: string;                     // current Age civ (switches at transitions)
  attributePoints: AttributeBag;      // granted at transitions from triumphs/milestones
  dedications: string[];             // picked at each transition (≤3 each)
  triumphs: { minor: string[]; majorDone: string[]; pinned: string[] };
  settlements: SettlementSave[];     // full kind/focus/buildings/adjacency/overbuild state
  techNodes: string[];  civicNodes: string[];
  wonders: string[];
  influence: number;                 // banked Influence yield
  independentPowers: IndependentPowerSave[];
  victoryScores: { dominion: number; tourism: number; gdp: number; innovation: number };
  ageCrisis: AgeCrisisSave | null;   // wraps crisis director at transitions
  fogRevealed: string[];             // hex keys revealed (delta-sync)
  grandProjects: string[];           // Innovation project completions
}
```
`migrateSave` gains a v2→v3 step (fresh campaign fields, chapters preserved as triumph history). Autosave fixes land here (D5/D6). Save corpus test: every prior v2 fixture must load at M1.

**Storage budget (localStorage is ~5 MB and `autosave.ts` currently swallows quota errors silently):** v3 saves must stay under a hard **512 000-byte** budget, measured by a headless 60-turn soak at M1. **Codex "founding batch photos" are re-rendered procedurally from saved vessel telemetry at render time — never base64-stored** (`codex: string[]` keeps recipe ids only). v2→v3 migration failure restores the pre-migration snapshot from a backup key (`how2soap.save.v2.bak`) instead of booting a corrupt world. Quota-exceeded writes must surface a visible banner ("The Realm's ledger is full — export your save"), never fail silently. Export/import round-trip added to the M1 corpus test.

### 4.2 Worker protocol v3 additions (all new commands/messages are **additive**, never rename)
New UI→sim: `END_TURN` (primary loop), `END_TURN_MARCH` (multi-turn skip with auto-break, or `#skip-turns`), `FOUND_SETTLEMENT`, `CONVERT_TO_CITY`, `SET_TOWN_FOCUS`, `PLACE_DISTRICT`, `PLACE_BUILDING`, `SLOT_RESOURCE`, `RESEARCH_TECH`, `RESEARCH_CIVIC`, `PIN_TRIUMPH`, `AGE_TRANSITION_CHOICE` (civ + dedications), `AGE_TRANSITION_ATTRIBUTES`, `SUZERAIN_POWER`, `LEVY_POWER`, `INCITE_POWER`, `INCORPORATE_POWER`, `END_AGE` (queue Turning when progress = 100), `BUILD_WONDER`, `SPONSOR_TRADE`.
New sim→UI: `CAMPAIGN_SYNC` (age, progress, scores, settlements summary), `SETTLEMENT_SYNC` (per-open settlement: queue, districts, adjacency preview — now yields/turn projections), `TURN_RECAP` (turn, buffered event ledger, yields — drives the recap modal, §6.16), `TRANSITION_PROMPT` (trigger full-screen overlay), `TRIUMPH_SYNC` (toasts + rail), `AGE_CRISIS_SYNC` (piggybacks `CRISIS_SYNC` envelope with `tier:'age'`), `POWER_SYNC` (independent powers).
Exhaustiveness guard extended; unknown commands still surface as EVENTS (never silent).

### 4.3 Content authoring & validation pipeline (v8 — new)

The 4X half of this plan is **authored content**, not systems: 5 countries, 9 civs, 5 patrons × 3-age payoff scenes, 3 age crises, 40+ triumphs, 9 wonders, 10 authored letter templates per correspondent, petitions, bounties, missions, dispatches. "Data-driven everywhere" must be *tooled*, not merely asserted:

- **Authoring format:** all narrative/campaign content lives in `src/data/content/*.ts` (typed rows, like `countries.ts`/`civs.ts`) — never inline in engine modules. One row per entity; ids are stable, unique strings (`patron.odric.s1.scene`), lint-checked.
- **Validation tests** (run in `vitest`, no DOM): every referenced id exists (prereqs, unlocks, recipients); every letter/petition/dispatch template's `{vars}` resolve; no template ships an empty field; every triumph/dedication row carries icon + text + reward; content ids never collide across reloads (v3 id corpus test).
- **Per-milestone content budgets** in the M-gates: M2 = 5 countries + 5 patron arcs v0 + Age I civs; M6 = 4 powers × 2 ages + Dispatch roster; M7 = full Age II/III corpus + Built Works text rows. **The patron-60% cut rule generalizes to every content track:** if a track ships below 60% authored by its milestone, cut to a thin skin rather than a hollow king.
- **Authoring cadence:** one content-writing sprint per milestone (M1/M2/M6/M7), reviewed by a checklist, not by vibes; telemetry of authored-row counts goes in the milestone notes.

---

## 5. Invariant: what does NOT change

- Chemistry vessels, pH solver, electrolysis, SAB layout, SeqLock, `WORKER_HZ`, `SIM_STEP_SECONDS`, `DAY_TICKS`.
- Colony labor loop (recruit → assign → harvest → payroll → morale/strike), desire-path decay (may be *rendered* differently, not re-simulated).
- Metabolism/pathology (glucose, hydration, sepsis) — integrated per **turn** (§6.16), unchanged mid-turn.
- Crisis director internals — wrapped and re-clocked from tick-schedule to **turn-schedule** (§6.9/§6.16), not forked.
- Six-chapter narrative reframed as the three-age spine (§6.1) with letter content reused wholesale.
- Renown → the **Culture/Tourism** currency; affinity system (apothecary/soapwright/forgewright) → the **Civ identity** system (§6.3).
- CSS token system (`:root` in `styles.css`), launcher/window/overlayStack patterns.
- `ADVANCE` stays in the worker as the **internal fast-forward primitive** reused by `END_TURN`, but is no longer player-facing as a wall-clock accelerator.

---

## 6. System Specification (file-level)

### 6.1 Three Ages (content skeleton)
| Age | Name | Chapters | Tech range | Ends with |
|---|---|---|---|---|
| I | **The Age of Ash** | ch1 *The First Fire*, ch2 *The Soapwright's Secret* | T1–T2 (fire → bar soap, tallow, ash, bronze precursors) | The Turning → §6.9 |
| II | **The Age of Brass** | ch3 *The Bronze Bloom*, ch4 *The Willow Cure* | T3–T4 (metallurgy, pharma, ethanol, salicin, penicillin) | The Turning |
| III | **The Age of Volta** | ch5 *The Mold That Saved a War*, ch6 *The Lightning in the Bottle* | T5 (full volt pile → pure Na/K) | Victory assessment (§6.10, §6.18.5) |

The national frame (§6.18) threads all three: **stop the bleeding → arm and endure → eradicate**. Age I is soap, cloth and firewood; Age II is medicine at scale, bronze watches, fermented vigor; Age III is penicillin, volt and the final eradication — the Crown's ledger against the Wasting.

Age-exclusive content: resources (Age I: halite, hardwood, tallow fat, willow; Age II: malachite/cassiterite, sulfur, willow, oak bark, penicillium loam; Age III: sphalerite, niter, copper/zinc stratigraphy), leaders/civs, wonders, independent power rosters, map extent.

### 6.2 Age Progress & "The Turning"
`ageProgress += Σ` deterministic accrual **per turn** from: objectives/triumphs (retro-fit existing OBJECTIVE milestones), settlement founding (+12), district placed (+3), wonder completed (+15), calamity survived (+5), Rival Expedition defeats (+8). At 100: `TRANSITION_PROMPT` → the worker enters transition hold (no ticks processed until the player chooses) → Age-Transition overlay (§8.4). Solo transition is unilateral; canonical simultaneous all-civ transition degenerates cleanly. The metabolic clock is honestly halted in transition hold — precisely what `SET_PAUSED` does today, under a better name.

### 6.3 Leader vs Civilization (decoupled)
- **Leaders** (new content, fictional, Adult tone, all-audiences-safe–adjacent): e.g. *Hypatia the Cypher* (Scientific lean), *Volkmar Forgehand* (Economic), *Sienna of the Ash Wind* (Cultural), *Brenna Wolfmeld* (Militaristic), *Tias the Envoy* (Diplomatic), *Ostro Cartographer* (Expansionist). Leader pick at new-game; identical across ages (canon). Unique per-leader, per-age bonus (lightweight data row).
- **Civilizations** (3 per age, locked by lineage at transition):
  - Age I: **The Ash Walkers** (Apothecary — unique: *Willowscript Remedy Quarter*), **The Salt Folk** (Soapwright — unique: *The Great Salt Ledger*), **The Forgeborn** (Forgewright — unique: *Emberheart Slag District*).
  - Age II/III: successor civs per lineage (Ash Walkers → *The Stillbound Synod*; Salt Folk → *The Carthaginian Cartel* → *The Voltaic Concord*; Forgeborn → *The Bronze Compact* → *The Fulgurate League*). Lineage table in `src/data/civs.ts`.
- **Time-Tested option (Test of Time):** skip the civ switch, take Syncretism (adopt another age-relevant civ's unique) or Affirmation (double-down on own unique). One checkbox in the overlay.
- Existing `AFFINITIES` data becomes the Age-I civ stat line; `DOMINANT_EPILOGUE` epilogue texts survive as civ-specific codices.

### 6.4 Settlements — Towns & Cities
```ts
interface SettlementSave {
  id: string; name: string; kind: 'CAMP' | 'TOWN' | 'CITY';
  q: number; r: number;              // axial hex
  population: number; growthPool: number;
  focus?: TownFocus;                 // FARMING | MINING | TRADE_OUTPOST | FORT | URBAN_CENTER | GROWING
  isCapital: boolean;  buildings: BuildingInstance[];
  districts: UrbanDistrictSave[];    // adjacency graph, 2 buildings/district → Quarter
  workedHexes: string[];             // auto-improved, permanent locations
  overbuilt: string[];               // Age-N buildings carried forward at 50% yield
  foundedCampaignDay: number;
}
```
- **Camp→Town→City** gating: camp = current hearth (existing (0,0) world coordinates → hex `(0,0)`); founding via a **Charter/Expedition** action costing: 2× BAR_SOAP + 4× COPPER/BRONZE parts + 1 colonist detach (existing recruit pool) + influence if near an Independent Power. Towns: production→Trade (gold-analogue); upgrade cost scales with city count (canon).
- **Settlement Limit:** base 3 + campaign bonuses (civics, wonders, Charter Laws); over-limit → −4 Morale per settlement per day (feeds existing strike system — no new penalty bus).
- **The start is a populated country, not a vacant shoreline** (per §6.18.0): the country's 2–3 settlements are **pre-placed** on the map at game start, each with its own mood and need ledger; "founding" a settlement is now a **frontier charter** — an influence-or-crops-costing expedition grant that plants a new hearth at the edge of the Realm, rather than colonization theatre. Capital = the Realm's chief settlement (always the hearth, same mechanics).
- **Growth:** food from worked hexes (farms on improved nodes) + paddock output; permanent tile assignment (canon); town output to capital for overflow (abstracted: yields pool per settlement, capital gets +15% trade on overflow — simplified canon).
- **Focus:** locked per Age per Town at selection (canon: Focus cannot change mid-age).

### 6.5 Districts, Quarters, adjacency
Fold the inert `CivBuildPanel` intents into `src/engine/campaign/districts.ts`:
- Urban districts only adjacent to city-center/urban districts (enforced in `PLACE_DISTRICT` validator; reuse Mohs-style hard-gate error messaging pattern from harvest).
- 2 buildings per district → **Quarter**; Unique Quarter = 2 same-civ unique buildings (Unique Quarter bonus).
- **Adjacency table** (authored, data-driven): e.g. *Smithy* +1 Production per adjacent *Ore Vein* or salt flat; *Stillhouse* +1 Discovery per adjacent *Willow/Oak*; *Mint* +1 Trade per adjacent *Road* (desire-path 2.0 milestone → roads, see 7.3); *Scriptorium* +1 Culture per adjacent *Ancient Ruin* wonder tile.
- **Overbuilding** (canon): previous-age buildings remain, yield at 50%, build slots reclaimed after placement. This is the Age Transition's "world evolves" beat made mechanical.
- District founding **claims the 6 adjacent hexes** (canon: border claim), extending fog reveal & resource access.

### 6.6 Renown = Culture/Tourism; Morale = Happiness
No new morality layer: Renown accrual becomes Tourism-generating (buildings/Wonders/Celebrations add Tourism rate); strikes/celebrations are the same morale system surfaced in 4X skin. Feasts/Celebrations: 1 per settlement per Age via food threshold (canon "Happiness-induced Celebration") — celebration = +N Tourism + score stinger.

### 6.7 Influence (new 7th yield)
Sources: *Monument*-analogue building (+4/Age), Hub Town focus, certain Wonders, diplomacy accepts. Sinks: befriend Independent Power (escalating), levy units, incite raid, free pact, prevent denounce, incorporate settlement, speed conversion, +1 dedication slot cost? (No — dedication slots stay 3.) Monument pricing in salt units keeps economy closed-loop.

### 6.8 Independent Powers
Four rosters (one per attribute): **Wolf-Kin Raiders** (Militaristic — "The Pale" rival remnant, extends existing RIVAL_EXPEDITION crisis), **The Painted Lodge** (Cultural), **The Salt Caravan Factors** (Economic), **The Stillbound Hermitage** (Scientific). Hostile by default in Age I; befriendable (influence over 3–5 actions); Suzerain bonuses; levy; incorporate (settlement instantly, free conversion). **Age-gated spawn/expire** (canon): at transition all unincorporated Powers vanish, suzerain locations respawn neutral. Timed Requests (existing 3-slot demand engine) become their *quest* flavor — keep as-is under new skin.

### 6.9 Age Crisis = wrapped crisis director
At age-progress 100 the worker raises `tier:'age'` crisis: reuse `createCrisisDirector` with **AgeCrisisDef** table (new 3 entries in `crisis.ts` extension or `campaign/ageCrisis.ts`):
- Age I→II: *The Failing Hearth* (ash blight + raiders convergence)
- II→III: *The Hollow Crucible* (industrial fever + pale schism)
- III (end): *The Long Silence* (no Turning; resolves into final victory scoring)
Outcome: **Golden Age** (all yields +15%, one bonus Dedication) / **Dark Age** (−15%, Dark Dedication pool) / wounded middle (no modifier). Telegraph beats re-clock from ticks to turns (§6.16): an Age Crisis telegraphs one full turn ahead, stays active across 2–3 turns, and auto-resolves to the `worst` choice after 3 unanswered turns. The crisis schedule stays a pure function of (seed, ageCycle) — now keyed to **turn** index, not wall tick. `CRISIS_SYNC` envelope unchanged; UI tier badge added (`.crisis-sigil.age`); resolution happens in the turn "Awaiting the Magi's word" hold (no turn advances until a choice is made — the turn-based equivalent of the current crisis modal's ESC-inert pause).

### 6.10 Victories — Test of Time scoring (cross-age)
`victoryScores` accrual, deterministic:
- **Dominion** (Military): +1 per settlement found/held each turn; +6 per incorporated/captured; +12 original capitals.
- **Tourism** (Cultural): +2 per Wonder, +3 per Unique Quarter, +1 per Relic-analogue (*Salve/Trophy* items flagged `relic:true`), +4 per Celebration, +5 per unique Improvement (Town Focus building).
- **GDP** (Economic): +1/turn per slotted strategic resource in Cities; +X per Trade Outpost hub; +2 per trade convoy returned (extends `timedRequests` fulfillment → convoy abstraction, D15).
- **Innovation** (Scientific): +10 per Grand Project (3 authored: Age I *The First Lye*, Age II *The Magnum Opus*, Age III *The Voltaic Ascension*), +5 per unique University-Tech node, +100 threshold with launch-pad equivalent (*The Fulgurator*) → 5-turn countdown → Scientific Victory challenge.
- Thresholds per age ramp (Exploration-Age win enabled if threshold hit — canon ToT), else score victory at Modern end; ties broken by total score (already the ToT rule).
- Solo game: **threshold victories vs authored AI-less bar** (no fake opponent). Optional Phase 9 Rival AI → race semantics later (§10 Q4).

### 6.11 Tech & Civic trees
Refactor linear chapter objectives into **two trees × 3 ages**, nodes in `src/data/techTree.ts` / `civicTree.ts`:
- Each node: `{ id, age, cost, kind:'tech'|'civic', prereqs[], unlocks: (recipe|building|district|civAbility|wonder)[], icon, text }`.
- **Maturity is part of the node** (§6.21): every mastered node carries `maturity: 0|1|2|3` — **invention** (just recipes) → **practice** (≥1 settlement using; ×1.1 yields) → **doctrine** (≥3 settlements; ×1.25 + special effect). Mastery accrues in turns of *use*, not turns of sitting — the country must actually adopt what you invent.
- Research pacing: Discovery (Science) & Culture (Civics) pools accrual per settlement + buildings; player confirms research at the **Workbench → "The Curriculum"** panel (new window) and **"The Charter"** (civics).
- Existing FABRICATE/HARVEST hard-gates: recipes get `tech` prerequisites — victory is blocked until researched (today's soft gate becomes a hard one — the only deliberate gameplay-regression-with-intent; flagged for M2 playtest).
- All 6 chapters' objectives become nodes; **journal letters remain the narrative delivery** for era completion.

### 6.12 Wonders (9 authored)
Age I: *The Great Kettle of Ardor*, *The Tallow Cathedral*, *The Salt Pilgrimage Road*. Age II: *The Bronze Reliquary*, *The Willow College*, *The Meridian Still*. Age III: *The Voltaic Telegraph*, *The Fulgurator*, *The Amber Archive*. Rules: one per settlement; global-unique; adjacency-immune but district-adjacent required; yield Tourism + attribute points at transitions.

### 6.13 Religion — cut (documented)
Civ VII Exploration-era faith is an entire subsystem (beliefs, missionaries, conversion). How2Soap's bottle is constrained; the fiction doesn't need proselytizing. **Cut.** If ever revisited: "The Salt Doctrine" spreading to Powers in Age II as a dedication.

### 6.14 AI — cut (documented)
Solo, scripted antagonist (Rival Expedition) only. Architecture keeps an `AIController` seam (`campaign/ai.ts` stub, no logic) so a later sprint can bolt on utility AI without engine surgery. Victory stays threshold/score-based (§6.10).

### 6.15 Difficulty, immortality & the survival layer
Three tiers (Apprentice / Alchemist / Grandmaster) map onto existing metabolism constants: Apprentice = −50% metabolic burn, no sepsis; Alchemist = current; Grandmaster = +25% burn, strikes bite. **Player personal survival is kept** (it is the game's fingerprint) but re-themed in 4X HUD as "The Magister — vital signs". Colony feeding/H2O stays abstracted through paddock+campCache (as today). **The Magister does not age and cannot die of age, ever** (user mandate 2026-11-05++): the metabolic model tracks caloric accounting, not a lifespan — death arrives only by the knife (Pale/sickness at Grandmaster), deposal, or abdication. The world outlasts the work; if everyone is kept, the country *keeps* advancing.

### 6.16 The Turn Loop (Q1 — LOCKED: full turn-based, user 2026-11-05; chemistry-first per user steering 2026-11-05)

**Unit of play: one turn = one in-game day** — but the turn is *chemically lived*, not merely calendared. `DAY_TICKS = 240` (existing, `time.ts:5`) becomes the length of a single turn's burst. **Pressing End Turn means "let the flasks do their work": every vessel, steep, ferment, culture, smelt and convoy in flight advances one day.** Chemistry is not one subsystem among others — it is the majority of what a turn advances. Between turns the simulation is suspended; pressing **End Turn** resolves one day atomically.

**Turn pipeline (worker, on `END_TURN`):**
1. Guard: busy flag kills double-presses; UI shows `End Turn ▸ resolving…` (width-locked button, `.btn-surgical[data-loading]`).
2. Input lock: the worker enters *turn hold* — chemistry, colony, metabolism accept no further commands until the burst completes (existing `paused` gate, reused as the hold mechanism).
3. **240-tick burst:** identical to today's `advance(24)` code path (`sim.worker.ts:331–343`) — chemistry vessels, metabolism, paddock (day rollover), colony (payroll, path decay), timed requests, crisis director, **plus every in-flight multi-turn experiment** (`turnsLeft -= 1`, §6.17) — with one difference: every event, milestone, payroll miss, strike trigger, telegraph, triumph and completion pumped during the burst is **tagged `turn: N` and buffered** for the recap.
4. Day rollover (`tick % 240 === 0`) closes the turn: settlement growth, yield accrual (food/production/trade/discovery/renown/influence/gdp), age-progress accrual.
5. Output: `TURN_RECAP` (new message) — `{ turn, events[], yields, crises, triumphs, deaths[] }`.
6. UI: **Turn Recap** —
   - *Uneventful turn:* compact toast row (`Day 12 — yields: +14 Discovery, +9 Renown…`), auto-saves and returns to play.
   - *Events present:* full-screen illustrated recap (StoryMode-class; two-column ledger, Fraunces headers, brass dividers) grouped by: **Omens** (crisis telegraphs), **Deeds** (triumph/wonder/project completions), **Losses** (deaths, strikes, misses), **Council** (letters). Dismiss with Enter/Space/click; recap never auto-dismisses.
7. Autosave (`buildSaveSnapshot`) fires on recap close — save cadence becomes turn-aligned (roughly one save per minute of play).

**End Turn ergonomics (HUD, §8.1):**
- Primary control replaces Pause/Sleep: `#end-turn` (`.primary`, `Space`/`Enter` hotkey, focus ring, always visible top-right). `#skip-turns` offers ×1/×8 (reskinned sleep buttons) — multi-turn skips suppress per-turn recaps and use **auto-break**: any crisis, death, triumph, or victory accrual halts the march and opens the recap early.
- **Dawn Report** button (uses `simulateWatchForecast`, re-labeled, evaluated per turn): hover/press shows tomorrow's projected caloric burn, boiling risk, strike probability. It is deliberately *imprecise* (a morning mist, not a spreadsheet).
- `SET_PAUSED` survives in the engine as internal hold; `#pause` is **removed from the shell** (ratified exception to the "preserve HUD ids 1:1" rule — recorded as such in §8.1).

**Crisis re-clocking (§6.9 details):** `FIRST_CRISIS_TICK`/`CYCLE_MIN`/`CYCLE_SPAN` re-derived in turns (crisis earliest on day ~3; ~1 crisis per 5–7 days, telegraphed 1 turn ahead, 2–3 effective turns to resolve, worst-choice after 3). `LEAD` = 1 full turn of foreshadow shown in the Dawn Report and `#banners` live region.

**Turn determinism:** identical seed + identical action sequence ⇒ identical recap. New soak test: record/replay a 30-turn scripted action log twice, assert byte-equal `SerializedCampaignSave`.

**Timed deadlines in turns:** timed requests expire/accrue in game-days — today's `TimedRequest` is tick-scheduled (`spawnTick`/`deadlineTick`/`durationTicks`, e.g. 90–120 ticks); the turn clock supersedes wall-tick timers throughout the campaign. Season deadlines in quarters — no real-seconds anywhere in campaign logic.

**Performance budget:** one turn (240 ticks) is mechanically identical to today's `ADVANCE(24)` — sub-100 ms on target hardware, worker-resident, no main-thread stall. If M2 playtests show recap latency >150 ms perceived, chunk the burst across 2–3 rAF-aligned worker slices (never change sim semantics — only message pacing).

**Bench Ledger (added to the recap):** the recap modal gains a first-class **The Bench** column — every active experiment, its turns remaining, and its completions ("⏳ *Vegetable-Tanned Leather* — Day 14/14 ✓"). The Bench is the player's reason to turn the page. Chemistry-class durations are authoritative in §6.17.

**Risk of this lock (recorded):** real-time pressure was the survival genre's hook; turn-based trades urgency for deliberation — the Magister now *chooses* the pace. Mitigation: Dawn Report pressure readout, crisis telegraphs, and objective timers keep every turn loaded with consequence. If playtests find turns saggy, tune **turn granularity** (day vs half-day §12) — never re-litigate real-time.

### 6.17 Chemistry-first turns — `workTicks` becomes real (user mandate 2026-11-05)

**The finding that unlocks this:** every recipe in `FABRICATION_RECIPES` already carries `workTicks` — authored in **hours** (`fabrication.ts:223` `48 // 48 hours (2 days)`; tanning 48 h, penicillin 48 h, grain mash/fermentation 24 h, backpack soak 12 h, `WORK HOURS ≤ 3` for bench work). The runtime **never reads it**: `FABRICATE` is synchronous and instant (`sim.worker.ts:621–700`). The author laid the fuse; nothing lit it.

**Design — experiments are the clock:**
- **Duration authority:** `workTicks` is reinterpreted as `workHours` (rename at migration; zero data re-authoring). Conversion in a locked constant: `TURNS_PER_EXPERIMENT = ceil(workHours / 24)` at `TURN_HOURS = 24`. Everything ≤ 3 h completes within the turn; tanning/penicillin/fermentation become **2 / 2 / 1-turn** operations. Short reactions behave exactly as today; slow ones become the waiting game.
- **Queue model** — new pure module `src/engine/campaign/experiments.ts`:
  ```ts
  interface ExperimentInstance {
    id: string;                 // exp_N, persisted
    recipeId: string;
    turnsStarted: number;
    turnsLeft: number;          // decremented once per END_TURN burst
  }
  ```
  `startExperiment()` performs today's FABRICATE legality checks (tool slot, mass/vessel inputs, glucose budget), **consumes inputs at reservation** (the flasks are physically committed; steeping is steeping — cancel refunds nothing after ignition), and enqueues. `stepExperiments()` runs inside the turn burst; on completion: grant outputs (same slot-routing as today), emit `OBJECTIVE recipe` milestone, add a **Bench Ledger** recap entry (✦ done / ⏳ n-days left / 📜 sour? never in v1 — deterministic).
- **Concurrency:** `maxExperiments = 4 + benchBuildings` (base 4; a new Age-II building *The Alembic Hall* adds +2; hard cap = `MAX_VESSELS` 32 invariant).
- **What stays live:** vessels remain fully kinetic (temperature, pressure, pH, Arrhenius) — experiments are a **scheduling skin over existing chemistry**, not a second simulation.
- **Living processes carry seeded sour rolls** (`sourChance` on recipe; v1: fermentation 12%, penicillin culture 20%, mash 15%, tanning 0): a failed culture is the one bench failure in the game; bench bench chemistry (heat, decant, distill, smelt, stone-mixing) is deterministic. Fouled batches may be released (criminal negligence) or dumped (sunk cost) — the Realm punishes both the unlucky and the reckless (§6.18.7).
- **Determinism:** identical seed + action log ⇒ byte-equal completion turns. Test: script 10 experiments across 10 turns, assert stable queue order & save bytes.
- **UI:** Fabrication window splits **Workbench** (instant bench actions — heat, decant, skim) from **The Day Book** (queued experiments with day counters, progress glyphs `⏳ 1/2`, cancel-with-confirm). Completion toasts surface in the recap's Bench Ledger. `⚗` badge on the fabrication launcher when jobs are in flight.
- **Scale check:** this is *the* feature that makes chemistry — not map-painting — the dominant rhythm of play. Weave into §6.16's pipeline as step 3's inline sub-burst.

### 6.18 The Country — Science in Service of the Nation (user mandates 2026-11-05 & 2026-11-05+)

**The frame: "The Wasting"** — a gray, patient phthisis is sweeping the Realm. Workshops close; the harvest rots in the field; the soldiers sicken on the levy road. The Crown summons its finest chemist — **your** chemist, in **your** country, chosen at the title screen. Every system in this conversion now serves one question: **can chemistry carry a country through its darkest decade?** Adult themes, zero gore, delivered with dignity — competence as comfort; you cannot consult your way out, you boil, cure, stitch and triumph. If you fail, the Realm does not merely sicken — it **rallies against you** (§6.18.7).

**Session structure:** New Game → **Choose Your Country** (§6.18.0) → you arrive a **nobody in a mud-port** — jobless, title-less, with one hammerstone and a heap of scrap (§6.22): your first craft silently crowns your patron (soldier's spear, lord's perfume, healer's tincture, forge's steel). After one Age of patronage you **earn the Crown's summons** — the appointment audience, now staged as *promotion*, not origin. The country is fixed for the run; the civic *character* (Civ VII civs) still evolves per Age (§6.3) — the country is the employer, civs are what they're becoming.

**Three national indices** — *derived, never spendable, never new currencies.* `RealmState { health: 0–100, safety: 0–100, vigor: 0–100 }` in save v3; computed by `src/engine/campaign/realm.ts`; decaying −1/turn baseline (the Wasting is patient):
- **Public Health** — lifted by Bar Soap and medicine distribution (soap *is* the vector control, historically true); tincture distribution +10; soap +4–8; salicin/penicillin +12; drives Dispatches difficulty and victory flavor.
- **Public Safety** — lifted by cloth + arms; governs crisis severity and strike incidence.
- **Hearth Vigor** (the stimulant gauge) — lifted by stimulant distribution; amplifies colony output; at 60+ exposure, burn-out cascade (§6.18.1).

#### 6.18.0 The Five Countries (chosen at New Game; starting endowments asymmetry is the point)

| # | Country (working title) | Endowments | People & hardship | Ruler | Estate temperament |
|---|---|---|---|---|---|
| 1 | **The Brass Coast** | Cu/Sn/gems abundant; food scarce; docks & wharves | Merchant-guild sailors; levy-frontier raiders | *Lord Admiral Corvin Thall* | **Measured** — Crown/Army/Crowd all swing slowest |
| 2 | **The Salt Steppes** | Halite, livestock, horses; timber scarce | Nomadic horse-tribes; banditry is the tax | *The Great Khan Baatar* | **Proud** — Army meter swings fast; crowd slow |
| 3 | **The Fever Marches** | Willow, river-ooze, lush farms; TERRIBLE disease load (Public Health starts at 40) | River-village farmers; priests of the Weir | *Queen Serahl of the Weir* | **Desperate** — crowd & court swing fast; doctor's miracles cheered hardest |
| 4 | **The Ember Highlands** | Sulfur, zinc, obsidian; cold, thin; few souls | Highland miners & forge-clans | *Prince-Engineer Galan Emberhart* | **Sturdy** — everything swings slowest; hardest people to sway, hardest to break |
| 5 | **The Verdant Vale** | Breadbasket; linen/cloth; ZERO mineral wealth (metals by convoy-trade only) | Vale townsmen & weavers; densest population | *Countess Odilia Maro* | **Fickle** — Public swings fastest; highest population → biggest soap demand |

- **Mechanics:** country data in `src/data/countries.ts` — `{ id, name, epithet, endowments: {…yields/stockpile deltas}, biomeWeights, startSettlements: [{name,q,r,kind}], startPublicHealth, estateTemperament: {crown, army, public}, ruler, colors[], bio }`. At `INIT` the worker applies deltas (stockpiles, settlements pre-placed on the map, Public Health floor, biome procgen weights) — asymmetry is the 4X expectation and costs nothing but data.
- **Civ slots (§6.3) unaffected:** the country is your fixed employer; your per-Age *civic character* (Ash Walkers → successor traditions) still evolves at transitions — country is loyalty, civs are evolution.
- **All victory paths stay open everywhere** — endowments bias, never gate (Vale can still win Military via the Pale frontier; Steppes can still win Science).

#### 6.18.1 The Dose — stimulant program
`DISTRIBUTE_STIMULANTS { commodity: WILLOW_TEA | MINT_TONIC | NITROUS_TONIC, crates, settlementId? }` — consumes tea/tonic crates on End Turn:
- **Effect (3 turns):** +12% assigned-job yield, +8 hauler speed, +6 Morale (canton-wide).
- **Exposure gauge per settlement** (0–100): +15 per willow/mint dose, +35 per nitrous; recovers −8 per turn; at ≥60: **crash roll** — `strikeBell`, −20 Morale, 2-day dose immunity for that settlement. The 1844 temptation, honestly modeled: the Realm may run hot, but the ledger always collects.
- **Item reality check:** willow tea brewable Day 1 (bark + boiled water); nitrous tonics only at Age III voltaics. The Dose is a *progression*, not a button.
- **Triumphs (Q3-a pairs):** Major *The Dose — Three Shifts* (30 crates across Age II) → Dedication *Second Wind* (+15% job yields, permanent). Minors: *A Crate for the Collier* · *Morning Bitters* · *The Third Shift*.

#### 6.18.2 The Hearth Cloth — clothing program
`DISTRIBUTE_CLOTHES { tunics }` — new item **LEATHER_TUNIC** (from `VEGETABLE_TANNED_LEATHER` ×1 + sinew thread; I_clo 1.0-equivalent abstracted to settlement tally "clothed pairs"; goat hides already feed the hide→dehair→tannin chain in-engine):
- Per tunic: +2 Public Safety, +1 Morale/turn (that settlement), −10% severity from FEVER_WAVE/cold-snap crisis rolls, and lifts the new-settlement cold-snap early-game cliff.
- **Physical economy:** tanning is 2 turns per batch (§6.17) — the wardrobe is a *production commitment*; the frontier will not dress itself.
- **Triumphs:** Major *The Great Clotheshorse* (25 tunics delivered, closes Age I) → Dedication *Winter's Remedy* (−1 crisis severity step). Minors: *Suit the Weather* · *Fifteen Pairs of Hands* · *The Tanner's Tithe*.

#### 6.18.3 The Arsenal of the Chemist — weapons & miners' TNT
`DISTRIBUTE_WEAPONS { weapons: BRONZE_SPEAR | BRONZE_AXE | FLINT_* }` → each delivered weapon +1 **Guard** (max 5/settlement):
- Guard scales down raid crisis losses (Wolf Pack / Pale Raid damage × `1 − 0.15·guard`), unlocks the **"Stand Ready"** crisis response (−1 severity, no −Morale), +2 Public Safety each.
- **The TNT line** (new, honest chemistry from existing reagents; sulfur via the sphalerite roast that today's `ZnS → ZnO + SO2` reaction already implies):
  - New items: **SULFUR** (Tier 4, sphalerite off-gas fines), **GUNPOWDER** (75:15:10 KNO3:S:C_charcoal, workHours 1, bench-mix), **TNT_CHARGE** (gunpowder + sawdust + tallow binder, workHours 2 — corned, stable, transportable; doubles as demo-charge for `DEEP_MINE`).
  - `DEEP_MINE` order (settlement + charges): opens deep veins — **2.5× Cu/Sn/Zn/S yields**, rare geodes; every blast rolls a **CAVE_IN** crisis subtype (new entry in `crisis.ts`: collapses that settlement's production for 3 turns unless "Timber up!" is chosen with axe capability; worst-choice via existing auto-resolution).
  - Combat identity: **"Blow the Breach"** option appended to Pale Raid crisis choices (consume 1 charge → assault ends, +6 Dominion) — the chemist's chemistry *is* artillery.
- **Triumphs:** Major *The Watch Armed* (guard ≥3 settlements to 4+, Age II) → Dedication *Quarter Under Arms* (once per Age Crisis, Guards answer automatically). Major *The Corned Chemist* (first TNT detonation). Minors: *Miner's Friend* · *The Breach*.

#### 6.18.4 Dispatches from the Crown — the requisitions engine (revive D7)
`mandates.ts` becomes **Dispatches from the Crown**: 2 concurrent timed orders ("Ship 4 Bar Soap by Day 9 → +15 Renown; fall short → −8 Morale — the Crown remembers"), turn-based timers end-to-end, tiered by Age (Age I: soap/clothing; Age II: guards/tonics; Age III: penicillin consignments). Flavor and cadence are authored, not simulated — these are the *macro* objectives pulling the player toward the Realm path. UI: three slots in Journal ("Dispatcher's Desk"), parchment styling, same expiry/penalty semantics as today's timed requests but single-source-of-truth renown.

#### 6.18.5 Defeat & victory, throned on the frame
- **No fail-by-sickness death screen:** Public Health collapse no longer ends the run outright — it bleeds the **Public** estate (§6.18.8) and starves Dispatches; the run ends when an Estate reaches zero. The drama is institutional, not biological.
- **Victory reframe (§6.10 amended):** Scientific = **The Cure** — Voltaic Ascension *plus* stockpiled penicillin/salicine consignments delivered to ≥5 settlements (or Public Health ≥80 in Age III): you save the country with the chemistry itself, on the clock. Cultural = **The Grand Magister** (Tourism + Crown favor via Dispatches mastery). Economic = **The Salt Ledger**. Military = **The War for the Nation's Breath** (the Pale defeated at the frontier).
- **The three endings, three ways out (see §6.18.8):** should all fail with no victory claim, the run closes on one of three deposal texts — *Recalled to the Court* / *The Sword Decides* / *The Crowd Decides* — each authored, each blameable, each a 21-gun salute to a specific pillar of the Realm you broke.
- **Chapter/prologue re-anchor (content authoring, not engine):** Hennig's letters become Dispatches; Ch4/Ch5 (willow cure / the mold) become the "the Realm is dying" midpoint reveal; Ch6 pivots to *winning the peace* — the safety arc (cloth, arms, sanitation) is the final Age's mechanical spine. Existing prose survives wholesale.

#### 6.18.6 HUD & panel additions
The Realm strip: three new chips — `#hud-health`, `#hud-safety`, `#hud-vigor` — `role=progressbar`, `aria-valuenow`, `tabular-nums`, under `.telemetry` (additive ids; 390 px: thumb-scroll with existing strip). Launcher key 6 opens **The Realm** (`realm-panel`): three gauges + the three program ledgers (Dose exposure bars, tunics delivered, guards assigned) + epilogue-tracked "the Country remembers" tally. All readouts `tabular-nums`; all bars `scaleX`-transformed (D4 lesson).

#### 6.18.7 The Release Loop — the game's central machine (user mandate 2026-11-05+)
Every order in this conversion is one verb: **release your science on the country and live with what the country does with it.** The core loop, explicit on the box:

`Lab → Release → Consequence` — brew it → sign the release order → survive the aftermath.

Concretely:
1. **Brew** (§6.17): run the multi-turn experiment. **Living processes carry a seeded sour roll** (`sourChance` on recipe; v1: fermentation 12%, penicillin culture 20%, mash 15%; bench chemistry — boiling, distilling, smelting, mixing — is deterministic skill). A spoiled batch can still be *released* (criminal negligence) or **dumped** (sunk cost honoured). Fouled loads released → the Realm suffers (see below).
2. **Release** (one order type per program): `DISTRIBUTE_*` (soap, tunics, weapons, tonics, doses). Everything is "releasing an experiment on the kingdom" — literally, historically honest, Frostpunk-tense, and the delivery mechanism of every objective in this section.
3. **Consequence** (within 1–3 turns, visible): Dockward fever drops; the colliers march stronger then crash; the tanners riot over lye burns; the watch holds the Pale at the ford; the Crown summons you — or thanks you. Consequences land as recap ledger entries, banner notices, and estate deltas (§6.18.8).

**Anti-"always good" rule:** no release is strictly positive. Soap saves lives *and* dries hands raw (flour-leather-worker complaint events); tonics sharpen focus *and* hollow the sleepers; tunics warm the cold *and* hide lice (flavor events). Effects are computed on the seeded RNG; the UI always states the risk band before you sign (a 0–100 "confidence" shimmer — **not** a hidden roll — the game never lies about odds).

#### 6.18.8 The Three Estates — Crown, Sword and Crowd: the deposal endgames
Your mandate to remain the Realm's chemist is an **audit, renewed daily**. Three meters — each 0–100, each starts at 60, each swings per country temperament (§6.18.0):

| Estate | Meter | Rises | Falls | At zero |
|---|---|---|---|---|
| **The Crown** (the Court, the Regent) | `estate.crown` | Dispatch completed (+2, +4 early), victory milestones (+8), wonder raised (+6) | Dispatch missed/expired (−5), fouled-batch catastrophe (−15), refusing a Dispatch | **The Dismissal** — they summon you, revoke the laboratory charter, and exile you to the provinces. Game over: *"Recalled to the Court"* (soft deposal — ends run, preserves save-as-museum) |
| **The Army** (the levy, the watch, the frontier) | `estate.army` | Guard delivered (+2/guard), Pale repelled (+6), carried-water/arms consignment met | Dispatch to a garrison missed (−4), settlement falls guardless (−10), unrest suppressed by force (−4) | **The Mutiny** — the barracks barricade; the Pale rides unopposed to the gates. Game over: *"The Sword Decides"* (hardest fictionally — the country becomes a battlefield) |
| **The Public** (the towns, the tanneries, the tenements) | `estate.public` | Tunics/soap-trains delivered (+3), Celebration (+4), Public Health ≥70 maintained (+4/turn), sour batch *refused* (+2 honesty) | Fouled batch lands (−6/release), strike (−4), too many Doses without recovery (−5 at exposure ≥80), mystery deaths | **The Pyre** — pamphleteers in the market, torches at the laboratory gates. Game over: *"The Crowd Decides"* (the most thematic — they burn the alembics to soot) |

- **Telegraphs, always twice, ≥2 turns apart:** at 25 — Event log warns ("The Chamberlain's summons sits on the desk, unread", "The watch changes the barracks watchword", "Pamphlets appear in the market"); at 10 — `#banners` full-width warning + a **Dispatch emergency summons** (free +20 on any estate restored). No deposal ever fires without two warnings; the Magister can always claw back (soap trains, guard parades, a public dose-*stop* proclamation — a real Order, historically the 1844 temperance movement).
- **UI:** one new HUD chip `#hud-mandate` showing the **lowest** estate with its name ("Mandate: The Crowd 18"), `role=progressbar`, `aria-valuenow`; clicking opens **The Realm** (key 6) showing all three meters with history sparklines. Crisis-style warning overlays use existing `.crisis-overlay` pattern (never ESC-dismissed past telegraph, only past the final warning).
- **The Sickening (§6.18.5) demoted:** Public Health at 0 for 2+ turns now feeds `estate.public` a −5/turn bleed and narrows Dispatches — no separate fail clock. The only ways out are failure — or the first great cure.
- **Where the Three Estates sit vs Civ VII:** Influence remains the *foreign* instrument; Estates are the *domestic* instrument. Between them they cover Civ VII's diplomacy + cultural legitimacy in one honest, Anthropocene-projectible pair of levers.

**Scope delta:** +3.5–4.5 person-weeks across M1–M8 (country data + select screen M2, `estates.ts` + Telegraph wiring M4/M6/M8, three ending rewrites in M8, ledger recap grouping, mandate chip). Fold into M1/M2/M4/M6/M7/M8 scope rows below.

### 6.19 The Realm's Hands — hires, retainers, and named souls (user mandate 2026-11-05++)
The tavern recruits we already have (fees: Forager `1 Dried Meat/Rowan`, Miner `1 Copper/Bronze`, Herbalist `1 Willow/Mint`, Chemist `1 Bar Soap`; daily wages in multi-commodity) are the seed of a full **national labour market**:

**6.19.1 Tiered hires** (one order, `HIRE { tier, count, settlementId, wageContract }`):
| Tier | Who | Cost & upkeep | Fieldcraft | Estate signal |
|---|---|---|---|---|
| **Locals** | Settlement-born labourers | Cheap commodity wages; +local morale | Standard yield; know the land (+10% haul) | Public-friendly (+1 Public per 5 hired) |
| **Specialists** | Master tanner/smelter/apothecary (unlocks per tech) | Mid commodity wage; 2-turn notice | +40% on their recipes | Crown loves them |
| **Mercenaries** | Coin-hungry blades (worked example: **The Brass Company**) | 3× wage in Trade-weight-equivalents (copper ingot or salt); leaves if unpaid 2 turns | +50% in raids & guard work | Army +1 |
| **Warriors** | Frontier tribesmen/Steppe riders | Commodity wages + weapons on hire | Strongest vs Pale & raiders; poor town hands | Army +2 |
| **Gangsters** | "The Guild of Thorns" — thieves' union | Crate of tonics + 20% of convoy tolls, no questions | Eliminates "problems" (bounty enforcement, rival camps) silently | Public −2 per contract; Crown −1 (deniable, always) |

**6.19.2 How you pay**
- Three legs live today: **rations** (food day-wage — keeps satiety, weak wages), **stipends** (soap/tonics/copper — strong wages, drains your bench stock), **bounties** (see 6.19.3). Payment is per-settlement configurable; unpaid crews degrade (`morale −1/day unpaid`, strike threshold at 20 — existing strike system is the enforcement, unchanged).
- **Gangsters take tolls** on convoys (Convoy GDP −15% while they ride "escort") — and will happily collect them twice.

**6.19.3 Bounties** (`PLACE_BOUNTY { targetRef, payout, scope: 'LOCAL'|'REALM'|'FOREIGN' }`)
- Targets are **named**: the Pale war-chief, the bandit "Grey Ross", the Dockward rat-catcher turned traitor, a dissident pamphletist (dark). Seeded 7-day deadline; resolution roll on NPC trackers (caravan encounters, guard patrols, gangster kill-shot).
- Rewards paid from Trade/commodity payout on completion; **Estates react honestly**: bounty on a raider (+Army, +Public), bounty on a political enemy (+Crown, −−Public, tyranny pressure), bounty on a beast (shown as safety). Political bounties are an efficient, corrupting tool — the frame's sharpest knife.
- Mechanically: `BountyInstance { id, targetRef, payout, deadlineTurn, spawnedTick, tier }`, resolved by existing timed-request scheduler pattern; never auto-targets children, never targets your own colonists (game refuses — honest fence, hard rule).

**6.19.4 Named souls & cohort trials — "giving only certain individuals your gifts"**
- Every release order (§6.18.7) gains `scope: 'ALL' | 'COHORT'` and `doseShare: 5 | 10 | 20 | 100%`. **COHORT** = one settlement's role-tagged named citizens (≤24 notable citizens tracked in save v3, `notableCitizens[]`: name, role, settlement, diet/treatment tags, outcome state).
- **The payoff is the scientific method as a mechanic:** a full cohort cycle (3 turns) at any doseShare yields **+3 Innovation** per completed trial and unlocks the precise dose-curve of that release (perk: permanent +5% yield for that effect, or discovered toxicity, or a genuinely better drug). Full-release gives NO data — better outcomes per body, worse understanding.
- **Named outcomes land in the recap by name** — "Berto the collier sang with double his shift — and slept through Sunday." Seeded from an authored name/event pool; zero gore, all omen.
- Manually: trial of tools (equip one settlement with bronze only), trial of tonics (miners only), trial of soap formulation (Dockward only). **Information asymmetry is the resource.**

**6.19.5 The Magister's Guard** — personal protection funded in Trade/turn (3–12 upkeep): prevents/mitigates the rare Pale destabilizer "The Knife in the Dark" crisis; scales with the Army estate. Guaranteed no Pale endgame soft-lock on your lab door.

**6.19.6 Never old age** (locked by user 2026-11-05++)
The Magister does not age and cannot die of it — the metabolic clock has **no year constant**; the world advances because the country flourishes or falls, never because the calendar is cruel. Campaign ends only on: victory (§6.18.5), deposal (§6.18.8), or player-chosen abdication (new menu option — save-as-museum epilogue). Recorded as a deliberate design truth; Grandmaster may keep age out too (die only in service).

### 6.20 The Built Realm — Laboratory, Blacksmith, Harbour (user mandate 2026-11-05++)
Three new buildings — as **urban district buildings** (§6.5 mechanics, Quarter-eligible), each unlocked by Crown charter (Dispatch delivery thresholds), never by research alone:

**6.20.1 The Laboratory** (3 tiers) — the player's physical home:
- *T1 Portable Cauldron* (free, 1 bench) — age I default. Throughput: base 4 max experiments (§6.17).
- *T2 The Alembic Hall* (District building) — +2 concurrent experiments, yields **+1 Discovery/turn while any experiment is in flight** (the lab is humming).
- *T3 The Grand Magnum* — +4 concurrent, **unlocks batch cultures** (penicillin at national scale: fermentation ×4/batch) and **assay services**.
- Consequence threading: The Laboratory is the only building whose **collapse** (raid, sabotage, Mutiny) soft-locks science — guards, gangsters, and the Magister's Guard exist to prevent this.

**6.20.2 The Blacksmith** — batch fabrication:
- Craft **batches** (×8 spears per job, 6 turns; tools/utensils/axes/maces) — the difference between outfitting 3 watches and outfitting 300.
- **Tool wear** introduced here (not globally): tools in colonist hands degrade every ~40 turns; repair jobs consume charcoal/iron capacity — without a Blacksmith, wartime maintenance collapses.
- Gates Guard rating > +2 (§6.18.3) — the watch cannot out-arm its maintenance base.

**6.20.3 The Harbour** — waterfront settlement only, unlocked by settlement kind at coast hexes:
- **Buoyancy assay** (Archimedes): density verification using the *actual* vessel chemistry (phase-pure density from the Materials table — weighted alloy density is computed, not fudged: 88 wt% Cu (8.96 g/cm³) + 12 wt% Sn (7.30) → expect ≈8.80 ± 0.03 for true bronze). Ore cargoes/loaning: catches gilded fakes, verifies Salt deposits purity, gates best-in-class tool MA (+0.5 if assay-verified). *The crown's last honest merchant is your scale.*
- **The Quarantine Gate** — ships roll off the horizon against the Wasting (seeded): accept (GDP +, Convoy money, mystery fever risk), fumigate with your brew (your own chemistry literally on the docks — great flavor, small soap cost), or burn (Public Health safe, trade −, Crown grumbles). First contact of every age is a harbour question.
- Enables convoy GDP (§6.10) and Treasure-Convoys (Age II).

### 6.21 The Grand Ledger — how everything connects (user mandate 2026-11-05++)
The interconnection is the game. Every system below names what it **feeds**, what **feeds it**, how it **fails**, and **where you see it**. Anything not listed here does not exist.

| System | Feeds (who consumes its output) | Fed by (what it needs) | Failure mode | Surface (UI) |
|---|---|---|---|---|
| Vessels & chemistry (`chemistry.ts`) | Recipes §6.17 → items → bench/barter/tunics | Bench time, glucose (player), reagents | Stranded flasks (too cold/wrong volts) — no death, no progress | Workbench, Bench 3D diorama, `#rs-*` chips |
| Experiments queue (§6.17) | Bounties of time; Magister renown; OBJECTIVES | Bench concurrency, inputs committed, turns | Sour batch (living), stalled inputs | The Day Book, Bench Ledger |
| Multi-commodity wages | Colonist morale → labor yield → gathers | Camp cache stock (SOAP/TONICS/COINS…) | Strike at <20 (existing) | Roster morale bars, Tavern |
| The Dose (§6.18.1) | Hearth Vigor → haul/yield + | WILLOW_TEA/TONICS stock, exposure gauge | Crash cascade: strike + dose-immunity (≥60) | The Realm strip chip `#hud-vigor` |
| The Hearth Cloth (§6.18.2) | Public Safety → crisis severity − | Leather chain (hides→tan→tunic) | Sold short: no tunics, no safety | Realm strip `#hud-safety`, tunic counters |
| The Arsenal (§6.18.3) | Guard rating → raid losses ×(1−0.15·g) | Bronze/tools from Blacksmith/smelts | Under-armed frontier: settlement falls (−10 Army) | Guard pips on settlement window |
| Dispatches (§6.18.4) | Crown stability; building charters (Lab T2/T3, Blacksmith, Harbour) | Bench output, timed delivery (existing pattern) | Dismissal spiral (estate.crown → 0) | Journal "Dispatcher's Desk" |
| Convoys (M6) | GDP victory points; Influence abroad; supply lifelines | Harbour, Trade, roads (§7.3) | Convoy lost: −6 Renown, −4 Public | Convoys tab, Map caravans |
| Bounties (§6.19.3) | One bad actor removed; Army/Public shaping | Trade payout, alarm noise | Political backlash (Public −), wrong man | Journal bounty list |
| Named citizens (§6.19.4) | Innovation +3/trial; dose curves | Settlements, dose delivery, 3 turns | Fouled cohort (−6 Public, deaths) — the trial is LOST if the batch sours | The Realm → Notable Ledger |
| Tech maturity (invention→practice→doctrine, §6.11) | Multiplies yields/Pioneer: ×1.1 → ×1.25 → special | Turns of *use* in settlements | Mastery never gels (<3 users): tier-I forever | Charter window "Doctrines" |
| `TEACH_THE_REALM` (knowledge release) | Passive country Health/Safety/yield | 3–5 turns broadcast; nothing else | None — but no Discovery/turn during spread | Bench "Proclaim" button |
| Estates (§6.18.8) | All of the above (the gates) | Everything you deliver | Deposal: Crown/Army/Public → 0 (3 endings) | `#hud-mandate`, The Realm sparklines |
| The Wasting (Public Health −1/turn) | Tension clock; Dispatches difficulty | Nothing "beats" it except your science | The Sickening: −5 Public/turn, Dispatch famine | `#hud-health`, hospital letters |
| Husbandry/paddock | Calories, leather, sinews → everyone | Feed/water; 6-animal cap | Starvation → satiety → morale → strike | Paddocks window |
| Settlement yields → Trade | Wages, guards, purchases, bribes, bounties | Labor, buildings, roads, convoys | Ledger drains: unpaid crews → strike | `.civ-yield-bar` |
| Independent Powers / Influence (M6) | Suzerain bonuses; frontier help | Monument discovers, Trade | Powers raid you (sanction/incite) | Powers panel, map |
| The Realm strip (§6.18.6) | Player's readout on all of it | Live aggregates | Misestimation — no, it's derived, never wrong | HUD chips |
| **The Age boundary (§6.2)** | Civilization resets forward (overbuild 50%, civic switch) | Age progress from all the above | Dark Age (worst outcomes) unless managed | The Turning overlay |

**The three master loops (visible in any 60-second slice of play):**
1. **Bench → Country → Crown → Bench** — science buys charters, charters buy labs, labs buy deeper science.
2. **Soap → Health → Compliance → Labor → Soap** — sanitation is an economic engine; the Wasting is a tax you pay if you skimp.
3. **Gun → Guard → Frontier → Loot → Guns** — the Pale keep the metallurgy honest.

**Interlocking die rules (no exceptions):**
- Every spendable commodity in the game traces to a vessel. Every vessel traces to a tech. Every tech traces to an experiment turn. Every experiment traces to bench hours. **The chemistry web is the whole web.**
- Nothing is created from nothing: guards consume tools, tools consume ore, ore consumes time — scarcity is topological, not numeric.
- Every release of science costs physical stock, and returns *either* data, *or* health, *or* power — never all three at full rate. The Citizen ledger makes this explicit in one line: *"What you know costs what you spend."*

---

### 6.22 The First Commission — a jobless start (user mandate 2026-11-05+++)

**The new opening, beat by beat (supersedes the "appointment audience" as game start; the appointment is now a *promotion* at the Age I → Crown handoff):**

0. **You are owed nothing.** Title screen → choose your country (§6.18.0) → cold open as a stranger at a mud-port tavern door: no lab, no stock, no patron, no rank, only what you can find and what you can make.
1. **The heap** — the rat-folio of a man with no name: 2 sticks, 1 loose stone, a knife point of sinew, a cauldron dregs, three handfuls of ash. Interaction: you *make your first thing* — no menus of classes, the game imposes nothing. Your artifact **is** your character build:

| You make… | Inputs | Your patron (auto-assigned) | Their arc (Age I → III) | They'd feed you… |
|---|---|---|---|---|
| **Spear** | stick + stone + sinew | **Serjeant Odric Vane** — a rich soldier seeking a maker | Muster → war-chief's house → frontier lord → **warden of the marches** → Crown marshal | Ore, sinews, hunts, the Marches' charter language |
| **Perfume / Soap** | tallow + ash + brine | **Madame Serafine** — a wealthy merchant's steward for the lord's household | Perfumer → the Guild of Scents → **Magistrate of the Spice Guild** → royal alchemist of the court | Luxury reagents, letters of credit, the Court's ear |
| **Tincture** | willow + clean water | **Sister Aurel of the Weir** — a healer with herbs to spare | Herbalist → tincturist → **district physician of the Weir** → royal physician of the realm | Willow country, clinics, the Realm's gratitude (Public +) |
| **Charcoal / rough bronze** | foraged ore + charcoal | **The Forge clans** — smiths who pay in traded metal | Coal-burner → smith → **Master of the Deep** → lord of the Ember Road | Ore rights, bellows, the mines (mineral wealth!) |
| **Nothing, wander off** | — | **The hedge-witch** (fifth patron, poverty path) | Self-sufficient hermit → the country's quiet saint | Food from the hedgerows, solitude, the Domain of Quiet |

2. **The term audition (the patron's patience):** the patron sets a **first commission** — always completable, always free-form in *how*: e.g. Odric: *"Arm my huntsmen for the wolf season — three good heads of iron by first frost."* — you tell Odric **what you need** (bushido of small begging: ore? sinew? time? hands?) and he funds what his purse bears. **Repeatable commissions** follow forever; patrons pay in stock, not in coin (commodity economies — no fake gold is introduced).
3. **The patron loop (mechanically identical for every patron — the content differs):**
   - `COMMISSION` — patron names the ask, deadline, payout (stock bundle), and a *fallback penalty* (trust, never death).
   - `REQUISITION_ORDER` — you answer with a shopping list; patron approves partial/decline/counter-offer based on **patronTrust** (seeded; shifts with deliveries).
   - **Deliver** → stock payout + trust ±, partial → half trust's worth, fail → trust −, no stock.
   - **Trust tiers:** 0 Abandoned → 1 Stranger → 2 Familiar → 3 Sworn (patron vouches for you at Court) → 4 Cherished (patron gifts a minor wonder, e.g., a named blade, a great still, a regiment banner — Wonder-adjacent bonus cosmetics + small yield).
4. **You gather workers and resources under patronage:** commissions exceed your hands — you must recruit peasants (§6.19.1 tiers), source raw stock (harvest orders), and haul it home — the entire economic loop already built runs under the patron's banner now, with patron stock *and* stock convoys (timed deliveries) as your lifeline.
5. **Butterfly effects, explicitly:**
   - Spear road → military economy from Day 1, mining from Age II, aggressive — you conquer the marches earlier, get hated by the Vale sooner, survive the Pale better.
   - Perfume road → GDP from Day 1, feasts (Celebrations) of the court, slower health response — in a fever outbreak, *you smell beautiful but the Wards are dying*.
   - Tincture road → health from Day 1, no combat economy, Pale pain, strong Public/Crown — softest opening, hardest Pale.
   - Forge road → ore for everyone forever, but the Crown is less gentle with a non-sunlight dynasty — Ember's revenge potential for the finale.
   - Hedge-witch → no patron, no charters, total autonomy — slower everything, untouched by faction debts; endgame: the Realm crowns "the village's conscience" (best Cultural ending) if Public high.
6. **Pattern:** whichever patron you serve, at **Age I → II Turning the Crown closes the loop**: your patron rides to Court *as your sponsor*; the Crown recalls your name; the appointment audience happens now as promotion (writ, lab charter, sealed orders). The §6.18 frame is unchanged downstream — only the *who signed your first papers* rotates, and history remembers it in letter-writing.

### 6.23 The Petitioners' Board — community complaints (user mandate 2026-11-05+++)
Ordinary people now file **petitions**, rendered as first-class entries (Journal "Dispatcher's Desk" gains a second tab — **"The Petitioners' Board"**, and The Realm panel gains its ledger):
- **Petition** = { petitioner (named, from the §6.19.4 pool), settlement, demand (text), deadline (3–8 turns), severity (1–3), estate tag (Crown/Army/Public-facing), resolution options }.
- Examples: *"The tanners of Millstreet say the lye burns their hands"* (Public: send tunics? indemnify? open a clinic?); *"The watch wants three days in arrears"* (Army: pay or lose face); *"The harbour master prays over the eastbound crates"* (Public: fumigate); *"The guild wants the Dockward dose trial's records… now"* (Crown: hand over or refuse — intrigue!).
- **Resolution shapes:** settle (stock/deltas), dismiss (Estate − small, +small payoff), defer (delay once, then compounds), scapegoat (another named soul takes it — steep Public −15, Crown +3) — the dark option, never required, always haunting.
- **The Board is the "community" in "community complaints"**: 0 petitions answered 3 turns running → a **mob event telegraph** (Public −4 next turn); 5 answered within deadline → **"People's Champion"** (Cultural affinity +5, and the Mad King never dismisses *you* by crowd).

### 6.24 The Built Realm UI — window transitions & affordance laws (user mandate 2026-11-05+++)
Grounded in the actual code: `WindowManager.open()` is instant today; `splash.ts:104` already has the inter-display veil; `launcher.ts` juggles launch keys; `.window`/`.window-backdrop` rules were orphaned until M0 (D1). The rules for the whole chrome:

**Transition law:**
- Launcher → window open: **160 ms** — scrim fade `0→0.45`, panel `scale(.96)→1 + opacity`, `cubic-bezier(.22,1,.36,1)`; titlebar icon **FLIP-morphs** from its launcher button position to the window titlebar (one transform, compositor-bound). Close: **120 ms** reverse (scrim closes first). No display-area veiled cuts outside recaps/Turnings — windows feel like tools in a belt, not scene changes.
- Window ↔ window (same size class): shared-axis slide 180 ms; grid resize only where required (none allowed — same size class shares geometry).
- Recaps/Turnings/The First Commission/Deposal keep the full-screen veil (`transitionDisplay`) — the three cinematic exceptions.
- **Reduced motion:** every transition above collapses to an instant swap (0.01 ms); zero content hidden by reveal-by-default; the FLIP morph degrades to fade.

**Affordance law ("are the interactive features highlighted?"):**
- **Any surface with a pending action carries `.has-activity`** — a 2.4 s breathing halo (`opacity 0.35→0.85`, compositor-only + a 4 px ring in `--accent`), plus a launcher badge dot. Cleared on open. Coarse pointers: static ring (no pulse); reduced motion: static ring.
- **First-time unlocks**: new window/launcher slot inaugurates with one 1.6 s brass sheen (one-shot, never loops) + kbd hint.
- The six-state button law (§8.6) applies to every control incl. petitions, bounties, commissions, deposal choices (the deposal button is red and plainly labeled — no fake "Continue").
- **Hover = inspect, not commit**: every order button shows its full cost/effect preview in a `.inspect-card` on hover/focus (a deterministic `<dialog>`-less tooltip) — the player is never surprised by the price, and no metric hides behind opacity.

**Dedicated windows inventory (all user-mandated elements get homes):**
| Key | Window | Size | Content |
|---|---|---|---|
| 1 | Chemical Workbench 🔬 | full | Reactions, bench, live telemetry (existing) |
| 2 | Fabrication 🔨 | full | Workbench + The Day Book (§6.17) |
| 3 | Paddocks 🌾 | wide | Existing, plus Notable herds ledger (§6.19.4 link) |
| 4 | Biome Dossier 🧭 | full | Existing DAG + hex lens |
| 5 | **Settlement Ledger** | wide | Towns/Cities, districts, overbuild, Quarters (M4/M5) |
| 6 | **The Realm** | full | Estates, health/safety/vigor, Petitioners' Board (tab), bounty list, Notable Ledger |
| 7 | **The Charter** | full | Civics + tech tree + Doctrines (maturity tiers §6.11) |
| 8 | **The Dispatcher's Desk** | wide | Dispatches (Crown orders), convoys, quarantine log |
| 9 | **The Influence Window** | full | Stance, Rebels, Threats, Built Works (§6.29) |
| Esc | close top | — | overlayStack discipline, unchanged |

### 6.25 The Map of Pressure — territorial contest (user mandate 2026-11-05+++)
"Other villages, civilians or kingdoms try to conquer your territory from time to time" — mechanized:
- **Incursions** are seeded, named, telegraphed 1 turn in advance (dawn report), scoped: (a) a **Pale frontier raid** (existing crisis spine), (b) a **Rival march** (The Ember Republic / The Vale League / The Coast Companies — one rival per country, seeded opposition, never aligned with your patron), (c) an **internal poor-harvest raid** (neighbours stealing grain — defend, bribe, or let them loot the granary and keep council).
- **Conquest ladder** (escalation with age): Age I villages raid roads → Age II a rival *takes a frontier settlement* (guards contest resolution, §6.18.3/6.19.5) → Age III full march routes (your garrisons vs their hosts; **reclaim** is a full military objective tier — see Victory §6.18.5). Losing a settlement: yields drop, buildings **lost** (overbuild stakes), refugees inflow (+2 mouths/turn, −1 Public), Crown −8 — the run continues but the map bleeds.
- **Defensive win condition** lives inside the Military victory path — the War for the Nation's Breath is *the reclaiming of every stolen hearth*.

### 6.26 Tutorial integrity contract (user mandate 2026-11-05+++)
Tutorial must never glitch:
1. **Deterministic & idempotent**: every step re-entrant (safe to reopen mid-lesson); reload-safe (step id persisted in v3 save; a reopened session resumes step N, not zero).
2. **Selector law**: spotlights key off **stable ids** (`#btn-open-tutorial`, `.hud-chip#hud-renown`, `[data-node-id]` patterns) — never off volatile class names or index paths; a build-time test (`tests/tutorialSelectors.test.ts`) resolves every `spotlightSelector` in `TUTORIAL_LESSONS` against the shipped `index.html`+JS bundles, failing CI on a dead path.
3. **No layout thrash**: coachmarks positioned via `position: fixed` + `getBoundingClientRect` on rAF, not scroll handlers; reduced-motion → static arrow (no pulse).
4. **Twenty-five start-path coverage**: 5 countries × 5 first-craft patrons (four artifact patrons + the hedge-witch) = **25** onboarding variants, asserted in unit tests at the curriculum logic layer (no DOM); tutorial completable in ≤12 actions; skipping is legal and never traps (open tutorial → skip forever; academy stays open from HUD button forever). (v7 said "20"; §6.22 defines five patrons — 25 is the consistent matrix.)
5. **The Academy survives everything**: Tutorial, windows, recaps and the Realm panel all obey one ESC ledger — two presses never eat the same handler; audit matrix enumerated in M2.

---

### 6.27 The Codex & the Exchange — recipes are property (user mandate 2026-11-05++++)
**"Recipes you build are stored, and can be sold to other alchemists — the same for you that can be used to ravage another territory, or strengthen your own."**

**The Codex (always on, zero UI drama):** every recipe you fabricate-craft is recorded permanently in save v3 (`codex: string[]`, migrating the existing `fabricatedRecipes` field wholesale). Codex entries show: discovery date (campaign day), the **founding batch photo** (a thumbnail of your first successful flask state — free flavor, zero tech), levers/moles you crossed, and **provenance status**: *Secret* → *Divulged* → *Patent* (teachable) → *Trade* (saleable).

**The Alchemist Exchange** — four foreign alchemists, met at your harbour or at age-transition fairs (one per country flavor):
| Broker (working title) | Smell | Buys | Sells |
|---|---|---|---|
| *Maester Rott Callaghan* | Ash & beeswax | Soap-craft curves, descaling lye variants | Sand-blasted glazes, "Honest Obsidian" cuts |
| *Madame Anise della Penna* | Perfume & myrrh | Tinctures, ferments, penicillium broth seed | Fragrance-grade rosemary terpenes, perfume lacquer |
| *The Ninth Sphere Monastery* | Candle & old stone | Ceramics flux, kilning, "Roman Cement" state secrets | Relic grinds (all pre-discovery!), glyph-grade pigments |
| *The Brass Verger* | Lamp oil & sulphur | Voltaic pile schemas, copper-gold refinements | Spirit of salt (muriatic), nitric ether for batteries |

- Mechanics: `TRADE_RECIPE { recipeId, buyer, payment, scope:'sell'|'buy'|'steal' }` — sell = permanent export at agreed sum (seeded per country mood: Vale pays 3× for penicillin ink in Age II); buy = stock − Trade, Codex gains immediately; steal = via missions (§6.30), risk of Encoder Exposure (+Public −/goal).
- **IP law, the honest way:** secrets cannot be un-sold. Your exclusive edge accrues from *new* chemistry only — the Exchange is a treadmill; standing still is falling behind.
- **"What you sell, others build":** a recipe divulged to the Exchange becomes available (cheap) to rivals from **next age on** — sell a weaponized technique and you may face your own formula on the pass, at Age II.
- **The invention-vs-inheritance dilemma** is the Exchange's whole drama: it is the only safe way to fund a campaign the market can eat.

### 6.28 Person-to-person windows & correspondence (user mandate 2026-11-05++++)
**Direct interaction windows** (`.p2p-window`): full-screen conversation cards built on the crisis-choice pattern — one named NPC, portrait sigil, one line of context, 2–4 responses each carrying explicit costs/effects. Three variants:
- **Negotiation** (patron/envoy/smuggler): counters, acceptance thresholds, walk-away exits (walk-away respected; nobody insulted unless you're crude).
- **Summons** (court/huelle/dock): formal audience, response actions are the Dispatches themselves with stylized prose.
- **Offer** (market/black): private transactions — sell a recipe (§6.27), buy spice, hush an eyewitness.

**Correspondence** — letters from **persons of interest**, delivered as `.letter` panes (aged-paper styling, wax seal, sender drawn from the §6.19.4 pool + authored cadre): *Madame Serafine's complaints*, *The Chamberlain's reminders*, *Sister Aurel's clinic report*, *The Thorn Guild's knowing regards*, *The Ninth Sphere's pilgrim letter*. Cadence: 1–3 turns per letter; 10 authored templates per correspondent with seeded fills; every letter is a playable artifact — reading is free, *acting on reading* surfaces as a mission (§6.30) or a dispatch. **Letters are the player's first party.**

### 6.29 The Influence Window — the Realm at a glance (user mandate 2026-11-05++++)
Launcher key **9**, full window, four tabs:
1. **Stance** — five attitudes with history sparklines: The **Court**, the **Watch**, the **Towns**, the **Guilds** (traders + Thorn underground), the **Frontier clans**. All derived (never typed): court=estates.crown plot, etc. Each shows its *demands* in one ready clause ("They want: fewer drunken patrols, more willow tinctures").
2. **Rebels** — "The Undertow", a seeded dissident movement vs the Crown (not vs you): choices set permanent stance — **Feed** (leak court secrets; Exchange fodder; Crown −2/turn while lying), **Join** (secret-command the mob; radical alt-route: a scripted Age III Crown-overthrow path — *grand* alternate ending: "The Republic of Compound"), **Suppress** (Army +6/turn while it lasts; Public −, it will boil back), **Ignore** (cheapest now; they wait for your worst day). No "right" answer; the Thorn guild knows which you chose — always.
3. **Threats (the scope ledger)** — every live threat with severity 0–3 and ETA in turns: The Wasting (Health decay), the Pale (raid ETA), rival march (§6.25), rebel simmer, TNT cave-ins (if deep-mining), Knife in the Dark; clicking any threat opens the crisis/dispatch that will answer it — an anti-map screen of dread.
4. **Built Works** — achievement-gated structural upgrades (construction becomes a second technology tree; each consumes cement/rope/glue/acids/wood/metals, all from the bench):

| Work | Recipe (chemistry honest) | Effect | Unlocks |
|---|---|---|---|
| **Lime-cement** | CaCO₃→CaO→Ca(OH)₂+pozzolana | Settlement **Sewer Outfall**: **Public Health +2/turn**, morale + | Walls, arches, aqueduct |
| **Leather rope** | leached hide + willow tannin | +10% haul, **Span** (cross Vale river), siege ladders | Bridge wonder |
| **Casein glue** | milk curd + vinegar (husbandry/aurochs line) | composite **laminated bows** (MA+1 ranged), tool bindings | Siege masts |
| **Acids** (existing H₂SO₄ line) | niter-chamber | etching/glyph letters (correspondence accelerates ×2), nitric-engraved mementos | Cipher poetry |
| **Wood composite** | rosewood + hide glue | weapons at **lower density, higher toughness** (your MA engine, honest) | Volleys, Kestrel staffs |
| **Military engines** (cement+rope+glue+wood) | all of the above | siege cannon/counterweight vs walls | The March endgame |

Human health subplot: these same reagents gate **clinic build-outs** (typhoid wards, willow wards) — infrastructure defeats the Wasting slower but *forever*, whereas medicine defeats it fast but turn-limited. Two philosophies of saving the country: the chemist's syringe vs the engineer's sewer. **Both are valid; both are celebrated in endings.** (§6.18.5 now tracks an "engineering canon" counter for the epilogue.)

### 6.30 Missions — tasks you recruit for (user mandate 2026-11-05++++)
Five **Operatives** you may recruit (via §6.19.1 hires, or offered for free in letters): 1 courier, 1 alchemist-spy, 1 brute, 1 whisper (Thorn), 1 paladin (post-Turning zealot). Each carries: wage/turn, loyalty 0–100, **skills** (subtle/bold/silken), and a **specialty gate** on missions.

Mission categories (seeded, 4–6 live at once, `MISSION_*` commands):
- **Scout** (whisper/courier): reveal fog ahead 2 turns; reveals ruin/wonder/power locations.
- **Steal the schema** (alchemist-spy): from a named rival — §6.27 counterfeit route; exposure risk scales inversely with subtlety.
- **Poison the hoard** (brute+whisper): sabotage a rival's stockpile or the Pale's siege cache (consume 1 dose of an authored agent; victory freight).
- **Raise the levy** (paladin/brute): +Guard for a named settlement immediately.
- **Dress the wound** (courier): expedite plague relief by 2 turns (public +5 there).
- **Silence the pamphletist** (whisper): Public −2, Estate-public tell; dark but effective for the Council's bravery.
- **Extract a witness** (any 2): rescue a named soul from a threat (connects bounty + named citizens pool).

Resolution: seeded outcome bands (clean/partial/compromised/disaster) shown **before dispatch** as a probability triad — the game never hides its dice; disasters are memorable but rare; an operative who fails twice is dismissed by the game (ran away / reassigned) after a "Cowardice of profession" letter. Outcome log feeds Estates (Crown/Army) and the Exchange threat ledger (rivals learn your trade craft).

---

## 7. The Map — hex rewrite (M3, the heavy lift)

### 7.1 Model
Axial `(q,r)` hexes; seeded procgen: value-noise elevation+moisture → biome classes mapped from existing `BIOME_DAG` categories (TREES, ROCKS_MINERALS, MUSHROOMS_FLORA, ANIMALS) + **WATER**, **SALT_FLAT**, **BRINE_POND**, **ANCIENT_RUIN** (wonder tiles), **RUINED_CAMP** (scavenging). Map extent by age (Decision Q2): Age I ≈ radius-10 playable disc; Age II adds outer ring + "Distant Shores" island chain (new gonfanon resources); Age III world reveal. Capital at seeded-prime hearth hex.

### 7.2 Renderer (`StrategyMapCanvas` rewrite, target ≤700 LOC + `hexMap.ts` pure math)
- Draw: cull to viewport; batched path fills; category-tinted terrain; **frontier/influence ring** per settlement (soft brass alpha, 1 stroke/hex overdraw ≤2); fog-of-war (Uint8 reveal grid, two-pass blit); capital star; colonist dots retained (movement along hex paths); desire-path wear **rendered as road arcs only above wear>96** (cosmetic only — grid no longer simulates).
- Input: same pan/zoom/keyboard contract (`mapMath.ts` reused; `ViewportState` is axial-agnostic) + hex hit-test (`screenToWorld` → round-to-hex).
- Hotspot spawner and timing ring: **removed from render loop**; timing ring returns as an optional "Expedition Contract" interaction on Ruin hexes (engine-driven timers, not frame-driven).
- `resizeCanvas` contract unchanged; `.strategy-*` CSS contract redefined in one file (D3).

### 7.3 Roads & convoys
Wear ≥ 96 cells from the existing grid get promoted at transition to **road segments** (Tourism +Trade Outpost synergy) — the one place the 1024-cell grid survives, purely as render data. Convoy abstraction: `FULFILL_REQUEST` fulfillment now optionally emits a `convoy` event; convoys take N turns to return (gdp accrual).

### 7.4 Colonists → units
Colonists keep axial positions; movement replaces boids separation for inter-settlement legs (within settlement: separation retained for labor fantasy); ranges: settlement influence radius = 6 hexes; haul routes auto-drawn when wear>96.

---

## 8. UI / UX Blueprint (the plastic-surgery half)

### 8.1 HUD contract (preserved 1:1, one ratified exception)
`#isolation #clock #p-glucose #p-temp #p-iclo #hud-adipose #hud-hydration #hud-ambient #hud-renown(role=progressbar) #ring-renown-fg #val-renown-title #reset #banners #quest #log #vessel-* #rs-* #btn-open-reactions #window-launcher #tab-{reactions,fabrication,paddocks,strategy,journal}-content #tool-inv-container` — all retained; `#hud-renown` retitled "L1 · Scrub Apprentice" behavior identical until Age Transition converts the chip into **two chips**: Renown ring (Culture) + **Age wheel** (new, additive, `role=progressbar`, id `#hud-age`, label `#val-age-progress`, "Age of Ash — 42%"). **Additive (§6.18.6/§6.18.8):** `#hud-health`, `#hud-safety`, `#hud-vigor` (the Wasting strip, M2) and `#hud-mandate` (lowest estate readout, M2; opens The Realm key 6). **Ratified exception (Q1-b):** `#pause`, `#sleep1`, `#sleep8` are **retired** and replaced by `#end-turn` (primary, `Space`/`Enter`) and `#skip-turns` (×1/×8 auto-break march). All other ids are never repurposed; new ids added, never overwritten.

### 8.2 Yield bar (ex-`CivBuildPanel`, now real)
`.civ-yield-bar` reborn: chips for Food, Production, Trade, Discovery, Renown, Morale, Influence — icon, `tabular-nums` value, per-turn delta pip (▲/▼). Appears under `.telemetry` (grid-row insert, `min-width:0`, no reflow of existing stats). Mobile ≤720 px: horizontal scroller with edge-fade mask (per skill nav rule), links/chips never clipped (measure, don't eyeball).

### 8.3 Settlement window (`WindowManager`, key 5, size `wide`)
Tabs: **Overview** (kind, focus, population, food net, yields), **Districts** (6-slot radial diagram — center, 6 adjacency-scored slots, Quarter lock states), **Buildings** (two-slot-per-district list w/ overbuild-50% badges), **Convoys** (active convoys gdp preview). All data from `SETTLEMENT_SYNC`; every button `.btn-surgical` (six states); loading states width-locked; reduced-motion collapses transitions.

### 8.4 The Turning overlay (full-screen, StoryMode-class)
Three-panel decision: **(1) Choose your Civ** — 3 lineage cards + Time-Tested checkbox (Syncretism/Affirmation sub-picks); **(2) Choose three Dedications** (5 defaults + earned); **(3) Spend Leader Attribute Points** (+1 per milestone completed, per ToT). ESC-inert; focus-trapped; no dismiss without choice; backdrop blur ≤10 px; canvas confetti-free (tasteful brass shimmer, reduced-motion → instant). Audio: new `ageShiftMotif()` (stacked fifths rise, 1.8 s) via `ui/score.ts`.

**New Game — Choose Your Country (§6.18.0) reuses this same overlay class:** five cards (portrait sigil, endowment ledger with icons, ruler, temperament, "the cost" line), one selection — then the mud-port opener and The First Commission (§6.22). Same z-order band, same input discipline, same `prefers-reduced-motion` behavior. End-of-run deposal overlays (§6.18.8) reuse it a third time — the frame's bookends are one component.

### 8.5 Triumphs rail
Left-edge collapsible rail (Civ VII-style pinned list): pinned triumphs with progress (`k/n`), attribute icon, reward hint. New CSS block `.triumphs-rail` in `components` layer; 390 px: bottom-sheet, not rail.

### 8.6 Tactile specification (new chrome, existing recipe)
`.btn-surgical` base in §skill-default form (resting flat, specular top inset, hover 140 ms lift, active 25 ms depress `.985`, focus-visible 2 px `#5aa5ff` offset 2, disabled `.45 opacity` + `not-allowed`, loading `[data-loading]` width-locked spinner). Yield chips are readouts, not buttons. Progress rings `stroke-dasharray` only. `.story-overlay` pattern reused for Turning overlay (fixed, inset 0, z 1000-class, blur 4 px).

### 8.7 Contrast & motion audit targets (new tokens)
| Token | Value | Use |
|---|---|---|
| `--age-ash` | `oklch(0.72 0.14 55)` | Age I accents |
| `--age-brass` | `oklch(0.78 0.13 85)` | Age II |
| `--age-volta` | `oklch(0.80 0.12 300)` | Age III (arc-violet) |
| `--influence` | `oklch(0.74 0.10 260)` | Influence pips |
Measure APCA against composited backgrounds; all ≥ LC 45 (labels) / LC 60 (telemetry). Convert to sRGB, verify, do not trust nominal oklch.

---

## 9. Milestones & Verification Gates

| # | Milestone | Scope (deliverable) | Gate (all must pass) |
|---|---|---|---|
| **M0** | **Hygiene & save integrity** | Fix D1–D6, D8, D14 checks; import `windows.css`; bump `how2soap-v1 → how2soap-v2`; autosave includes colony/paddock/timedRequests/rngSeed; vitest corpus v2→v3 dry-run | `vitest` green; `tsc --noEmit` 0; `npm run build` ≤200 KB; HIGH lint = 0; offline reload smoke |
| **M1** | **Campaign engine spine + chemistry clock** | `engine/campaign/*` pure modules incl. **`experiments.ts`** (workTicks→turns, §6.17) and **`realm.ts`** (§6.18); save v3 + SAT + migration; **storage budget (§4.1): headless 60-turn save soak ≤ 512 000 B**; 45–65 new unit tests | All gates; `npm test` ≥250 passing; v2 fixture loads; experiments determinism replay green; save soak under budget |
| **M2** | **Age I vertical slice (chemistry-first + jobless start)** | Turn loop live (§6.16): `#end-turn`, recap modal w/ **Bench Ledger**, skip-march auto-break, Dawn Report; **The First Commission** (§6.22): country select → mud-port opener → first-craft patron arc v0 (4 artifacts + hedge-witch) → commission/requisition loop with patron trust + stock payouts; **Fab window = Workbench + The Day Book** (§6.17); **The Dose v1** + **The Realm strip + Guard/Estates v0** (§6.18.6/§6.18.8); the appointment audience promoted to Age I→II; Age progress; The Turning (Age I→II); 3 Age-I civs; Triumphs/Dedications; 1 wonder; tech tree (Age I); FABRICATE gates live; **tutorial integrity contract** (§6.26) wired & green on all 25 start paths | All gates; **M2 kill-gate (pre-committed, all four rows must pass or the 4X lift halts here):** (a) heap→first-patron reveal ≤ 20 s on 2 of 3 recorded first-time runs; (b) ≥ 2 of 3 first-time players reach The Turning unprompted within a 45-minute session; (c) ≥ 2 of 3 players answer "what did your chemistry change about the country?" without prompting; (d) zero progression blockers found in playtest. Any row red → halt, diagnose, thin-skin M2 or shelve — never proceed to M3 on a fudged gate; turn-burst p95 ≤ 100 ms; 390 px + reduced-motion checks; tutorial-25-path suite green |
| **M3** | **Hex map & carts** | `hexMap.ts` procgen + renderer + fog; colonists relayed; existing map replaced; map-controls contract; D3/D11 closed | All gates; canvas 60 fps on 2019 mobile iGPU (Chrome DevTools 6× slowdown, 16 ms/frame <5% frames dropped); map pan/zoom asserts |
| **M4** | **Towns & Cities + The Wardrobe & the Forge** | Found/upgrade/convert; focuses; growth; settlement limit; capital bonus; `.civ-yield-bar` ships; **`DISTRIBUTE_CLOTHES`** (`LEATHER_TUNIC`, §6.18.2); **Blacksmith** v1 (batch crafting + tool wear, §6.20.2); **Estates wiring** — Dispatch/miss deltas reach Crown/Army/Public with 25/10 warnings (§6.18.8); hire **tier ladder v1** (Locals, Specialists, Mercenaries — §6.19.1) | All gates; economy soak (30 in-game turns headless via chained `END_TURN`) |
| **M5** | **Districts & Quarters + The Alembic Hall** | `districts.ts`, adjacency table, overbuild, Unique Quarter, `PLACE_DISTRICT` + settlement window UI; **Alembic Hall T2** (lab concurrency +2, +1 Discovery/turn in flight, §6.20.1) | All gates; adjacency unit matrix ≥99 coverage of table rows |
| **M6** | **Influence & Independent Powers + The Realm's Hands + The Board + Stance** | 4 powers × 2 age rosters; befriend/levy/incite/incorporate; timed requests as convoys (D15 closed); GDP accrual; **`DISTRIBUTE_WEAPONS`** (Guard) + **Dispatches** (D7, §6.18.4); **The Harbour** (buoyancy assay, Quarantine Gate — §6.20.3); **Warriors/Gangsters hire tiers** (§6.19.1); **Bounties** live (§6.19.3); **The Magister's Guard** (§6.19.5); **Petitioners' Board v1** (§6.23); **Incursion v1** — seeded raids, 1-turn telegraphs (§6.25); **The Influence Window v1** (Stance tab — 5 attitudes, §6.29); **Correspondence v1** (5 named correspondents, seeded letters, §6.28) | All gates; influence ledger balanced (no infinite source/sink)
| **M7** | **Ages II & III + Age Crises + Built Works + the Exchange** | Content: 6 civs, 2 tech/civic trees each with **maturity tiers** (invention→practice→doctrine, §6.11/§6.21), wonders, Transitions II→III & III-end, Golden/Dark outcomes; **SULFUR/GUNPOWDER/TNT_CHARGE** items, `DEEP_MINE` order, **CAVE_IN** crisis; **Grand Magnum T3** (batch penicillin, §6.20.1); **`TEACH_THE_REALM`** knowledge release (§6.21); **cohort trials polish** (§6.19.4) — Notable Ledger, dose-curve unlocks, +3 Innovation per completed trial; **Incursion v2** — rival marches can capture a frontier settlement; reclaim objective tier; **Patron arc payoffs** (four ending hooks); **The Codex + Alchemist Exchange v1** (recipe property, four brokers, sell/buy/heresy, §6.27); **Built Works** — Lime-cement → Sewer Outfall (Health +2/turn), Leather rope → Span, Casein glue → laminated bows, wooden-composite weapons, acids/engrave glyphs (§6.29); **Missions v1** — five operatives, 7 mission verbs, seeded resolution triads (§6.30); The Wasting tuning | All gates; three-age headless playthrough soak (chained `END_TURN`); crisis turn-sequencing tests; CAVE_IN escalation test; trial determinism (same seed → same Berto) |
| **M8** | **Victories & ship — The Realm stands** | Test of Time scoring; **victory reframe (§6.18.5): The Cure / The Grand Magister / The Salt Ledger / The War for the Nation's Breath** + **The Republic of Compound** alt-route (Rebels, §6.29); **three deposal endings** — *Recalled to the Court* / *The Sword Decides* / *The Crowd Decides* (§6.18.8, full `.crisis-overlay`-class sequences); **built-works epilogue counter** (engineering canon vs medical canon flavor); score HUD; The Realm panel polish; balance (the Exchange must not inflate GDP) | All gates; QA: victory reachable all 4 paths + all 3 deposals reproducible via scripted saves; `sw` v2; storefront-free release |
| **M9** | **Stretch / debt** | Rival AI utility agent; religion-lite; `D10` StrategyMap3D adopt-or-delete; `D16` type tightening; 20 Nights for campaign | Per surgicalimple judgment |

**Parallelism policy (this repo's skill regime):** M1+M2 engine and M3 renderer have clean seams and may run as two worktree tracks; UI (§8) interleaves with M2–M7. **No parallel edits to `sim.worker.ts` or `app/state.ts`** — both are merge-magnets. Sequential dispatches within a milestone.

**Effort estimate (honest):** M0 ≈ 2–4 days; M1 ≈ 1–2 wks; M2 ≈ 4–5 wks incl. playtest loop (jobless opener + patron arc v0 + Day Book + The Dose + Estates v0); M3 ≈ 2–4 wks; M4 ≈ 1–2 wks; M5 ≈ 2–3 wks; M6 ≈ 3–4 wks (Influence v1, correspondence, harbour, hands, board); M7 ≈ 3–4 wks (TNT, maturity, cohorts, Exchange, Built Works, missions); M8 ≈ 3 wks (five endings-set + epilogue); **total ≈ 23–34 person-weeks** to a shippable "Alchemist's Empire v1.0", assuming one pair of hands and no other paying work. The truth this number tells: you have specified a AAA-grade content pipeline — every content byte is authored once, data-driven everywhere, and M8's QA is the longest pole. If The Grand Ledger is to hold together, playtests ask one question: *"what did your chemistry change about the country?"* — if the answer is muddy, we ship less, deeper.

**Confidence & pre-committed cut ladder (v8):** treat the estimate as a P50 with single-person variance of ±40%. Calendar checkpoints with written continue/cut decisions at end of M2, M4 and M6. Pre-agreed cuts, in order: **if M6 slips > 25%** → Missions (§6.30) move to M9; **if M7 slips > 25%** → drop Built Works (§6.29 cement/rope/glue/acids/wood), then the Alchemist Exchange (§6.27), then incursion capture (§6.25) — these become M9 stretch by trigger, never silently descoped; **if two consecutive checkpoints slip > 30%** → ship "Alchemist's Empire" with victory paths limited to Cure/Dominion/Tourism (no Exchange, no Influence alt-endings). M2 failure is never a cut trigger — it is a halt (see §12 kill-gate). Every cut taken is logged in the milestone notes, with the reason, so M9 knows what to resurrect.

---

## 10. Decision Gates (status)

1. **Q1 — Time model — 🔒 LOCKED (user, 2026-11-05): full turn-based.** One turn = one game day (§6.16). `#pause/#sleep1/#sleep8 → #end-turn/#skip-turns` ratified HUD exception (§8.1). HUD/telemetry ergonomics rewritten accordingly.
2. **Q2 — Map per age.** (a) **Expanding persistent map** (defaulted — one world, fog rings revealed per age; keeps coordinates, SAB-adjacent colonial entities valid) vs (b) **New map per Age** (faithful Civ VII; orphans chemistry world mid-boil, resets colony positions, doubles serializer complexity). *Awaiting veto.*
3. **Q3 — Milestone economy — 🔒 LOCKED (user, 2026-11-05): Test of Time Triumphs + Dedications.** Major/Minor Triumphs across six attributes; three Dedications per transition; five defaults always available. Legacy Paths data model not built.
4. **Q4 — Victory race.** (a) **Solo threshold/score victories** (defaulted; no fake AI) vs (b) Rival Expedition promoted to Utility AI (Phase 9+). *Awaiting veto.*
5. **Q5 — Personal survival layer at scale.** (a) Keep as-is all ages (defaulted; Magister doctrine) vs (b) colony-abstraction toggle per difficulty. *Awaiting veto.*
6. **Q6 — Dead scaffolds.** (a) Fold `CivBuildPanel`, `windows.css`, `soapKettle.css` into the new system, **delete or retire** `StrategyMap3D` + `GLTFLoader` (defaulted) vs (b) finish 3D map view in M9. *Awaiting veto.*

Current package: **Q1-b 🔒 · Q2-a · Q3-a 🔒 · Q4-a · Q5-a · Q6-a** — content names: Ages *Ash/Brass/Volta*, civs as §6.3, victories as §6.10/§6.18.5. Veto any of Q2/Q4/Q5/Q6 by 2026-11-07 or they lock as written. **Scope grew five times on 2026-11-05** by user mandate — (i) chemistry-first turns + The Country frame (§6.17/§6.18), (ii) **The Five Countries + Lab→Release→Consequence loop + the Three Estates deposal endgames (§6.18.0/§6.18.7/§6.18.8)**, (iii) **The Realm's Hands + The Built Realm + The Grand Ledger (§6.19/§6.20/§6.21)**, (iv) **The First Commission (jobless start → patron by first craft) + Petitioners' Board + window transition law + tutorial integrity + territorial contest (§6.22–§6.26)**, (v) **The Codex & Alchemist Exchange + person-to-person windows + correspondence + The Influence Window (Stance/Rebels/Threats/Built Works) + Missions (§6.27–§6.30)**. No new decision gates were minted; M-milestones, verification and effort are updated accordingly. Honest total: **23–34 person-weeks** — content cost, not systems cost. The M2 gate exists to kill it early if it doesn't sing.

---

## 11. Verification Plan (per milestone, inherited from skill Phase 4)

**Enforcement surface:** `.github/workflows/ci.yml` already runs `tsc --noEmit` + `vitest run` + `npm run build` on every push/PR. At M2, add `preflight_visual_lint.py src --fail-on high` and the planned `tests/tutorialSelectors.test.ts` audit as CI steps. "All gates" in every milestone row means **CI green on the branch** — screenshots, focus traps, 390 px fit and vision review remain manual checklist items, not CI.

- [ ] `python3 …/preflight_visual_lint.py src --fail-on high` — 0 HIGH.
- [ ] `npx vitest run` · `npx tsc --noEmit` (0 errors) · `npm run build` (entrypoint ≤ 200 000 B; `three` isolated in lazy chunk).
- [ ] `tests/memoryLayout.test.ts` untouched & green (67648).
- [ ] **Turn integrity:** same-seed + same-action-log → byte-identical `SerializedCampaignSave` after 30 turns; `END_TURN` burst p95 ≤ 100 ms (desktop) and main-thread never blocked (worker-resident); double-press guard proven (two `END_TURN` posts → one burst); recap aggregation unit suite green; skip-march auto-breaks on crisis.
- [ ] **Experiment integrity (§6.17):** `workHours→turns` conversion pinned (48 h→2 turns; ≤3 h same-turn); 10-experiment × 10-turn queue replay byte-identical; concurrent cap = `4 + benchBuildings` (≤ `MAX_VESSELS`); completion fires `OBJECTIVE recipe` exactly once; input reservation consumes at ignition.
- [ ] **The Realm (§6.18):** `realm.ts` decay/gain formulas unit-covered; The Dose exposure clamps 0–100; crash rolls only at ≥60; Dispatch timers turn-aligned; `LEATHER_TUNIC`/`SULFUR`/`GUNPOWDER`/`TNT_CHARGE` registered & craftable in-save; CAVE_IN worst-choice fires after 3 unanswered turns; Public Health floor holds for first 3 campaign days.
- [ ] **The Hands (§6.19):** hire-tier wage ledger balances (no free crews); bounty scheduler fires deterministically; political bounties move Public −; notable-citizen trial seeds replay byte-identically; cohort dose curves unlock exactly once; Magister's Guard blocks a scripted Knife-in-the-Dark at max tier.
- [ ] **The Built Realm (§6.20):** Alembic Hall disables correctly at Lab-collapse; Blacksmith batch jobs consume correct inputs and tool-wear ticks every 40 turns ± 0; buoyancy assay returns computed density ±0.05 g/cm³ (88:12 bronze ⇒ 8.80); Quarantine gate option set is complete; convoy GDP accrues on arrival.
- [ ] **The First Commission (§6.22):** all 5 country × 5 patron paths reachable and completable in unit tests; first-craft artifact correctly assigns patron with zero UI class-pick; patron trust replays deterministically; commission requisition accept/decline/counter flow works without patron gold injection exploits; the Age I→II promotion beat fires exactly once per run.
- [ ] **Petitioners' Board (§6.23):** petition spawn cadence seeded; deadline expiry applies correct penalties; 3 unanswered → mob telegraph; 5 answered → People's Champion; scapegoat option costs Public −15 exactly; petition ids never collide across reloads (v3 id corpus).
- [ ] **Window transitions (§6.24):** every named window opens with the 160 ms spec (scrim/scale/FLIP) and closes at 120 ms; `.has-activity` halos clear on open; launcher badges match pending counts; coarse-pointer static-ring assertion passes; reduced-motion instant swap asserted; backdrop never traps ESC (overlayStack LIFO property test).
- [ ] **Territorial contest (§6.25):** incursions telegraph 1 turn ahead (banner + dawn report); capture resolution deterministic per guard composition; losing a settlement fires refugee/crown/building-loss deltas in recap; reclaim tier is winnable and re-lost identically on restart.
- [ ] **The Codex & Exchange (§6.27):** every fabricated recipe lands in `codex[]`; provenance transitions legal only forwards; a sold recipe injects into the rival market pool exactly one age later; theft missions expose-exposure rate matches spec; trade sums seeded & replayable.
- [ ] **Correspondence & P2P (§6.28):** every correspondent's letter cadence ≤3 turns deterministic; letters never render undefined templates (build-time template audit, all vars resolved); negotiation walk-away path never deadlocks a beat; correspondence log persists through save/load.
- [ ] **The Influence Window (§6.29):** Stance tab aggregates recompute per turn from sources (never typed); Rebels choice persists flag in save; Threats ETA values replay identical from seed; Built Works gating correct on achievement flags; Sewer Outfall grants +2 Health exactly once per completion.
- [ ] **Missions (§6.30):** all five operatives recruitable and dismissable at threshold loyalties; mission resolutions replay byte-identically from seed; probability triads displayed match spec; double-failure auto-dismisses exactly once; mission outcomes surface as estate deltas in recap.
- [ ] **The Grand Ledger (§6.21):** tech maturity advances 0→1→2 with correct user-count thresholds; `TEACH_THE_REALM` grants no Discovery/turn during spread and passive Health/Safety thereafter; every commodity in the shipped build traces to a vessel (audit script in tests).
- [ ] Save: v2 fixture → load → v3 round-trip (export/import) byte-stable on second serialize; 60-turn headless soak save ≤ 512 000 B; quota-exceeded write path shows the banner (no silent catch); serialized payload contains **no** codex thumbnails (procedural re-render only, §4.1).
- [ ] Desktop + **390 px** fit: `document.documentElement.scrollWidth === innerWidth`; every nav/chip/link `rect.right ≤ 390`; `.civ-yield-bar` scroller edge-mask verified (measure links).
- [ ] Coarse pointer: `getComputedStyle(.btn-surgical).minHeight ≥ 44px` under `any-pointer: coarse` emulation; keyboard-only complete Turning flow (Tab order, Enter/Space); `#end-turn` reachable and activatable by Enter/Space with visible focus.
- [ ] `prefers-reduced-motion: reduce`: Turning overlay and Turn Recap render instantly; no reveal-hiding content by default; `scroll-behavior: auto`.
- [ ] Screenshots (desktop + 390 px) vision-reviewed; JS-emitted classes have CSS rules (D3 regression guard `window.getComputedStyle` sweep).
- [ ] Score/motif: `ageShiftMotif` silenced under mute; no AudioContext before user gesture.
- [ ] Offline: SW v2 precache → airplane-mode reload → game boots → no chunks dropped.
- [ ] Numeric jitter: every new live readout carries `tabular-nums`.
- [ ] Blur budget: ≤2 stacked blur >8 px; none on repeated cards.
- [ ] E2E (if/when Playwright lands per AGENTS.md): `npx playwright test` green before cutting M8.

## 12. Risks & Honest Unknowns
- **Scope realism:** this is a new game's worth of content. The plan exists so M2 can be killed early if the loop doesn't sing — that is the cheapest possible failure. **The kill-gate is falsifiable and pre-committed (v8):** (a) heap→first-patron ≤ 20 s on 2/3 first-time runs; (b) ≥ 2/3 first-time players reach The Turning unprompted within 45 min; (c) ≥ 2/3 unprompted answer to "what did your chemistry change about the country?"; (d) zero progression blockers in playtest. Any row red → halt → diagnose → thin-skin M2 or shelve. The gate is this plan's honesty mechanism — do not self-grade it green.
- **Turn granularity feel:** 1 turn = 1 day may read as sluggish for minutes-of-chemistry players; fallback tuning lever is half-day turns (120 ticks) — a constant edit, never a re-architecture. Validate at M2 playtest before touching anything else.
- **The Wasting pacing:** the −1/turn Public Health decay may punish slow science → the soap economy must outpace it by ~Day 6 or the run dies on rails; mitigation = soap-per-turn yield tuning + a 75-point Public Health floor for the first 3 campaign days (tutorial teaches the caustic altar before the reaper knocks).
- **The Dose trivialisation:** nitrous every turn would break the economy → exposure gauge + crash cascade (§6.18.1) is the brake; playtest must show the Dose is net-positive only as a *managed* tool, never baseline policy.
- **Dispatch treadmill:** Crown requisitions may feel oppressive too early → gate Dispatches to post-Turning of Age I; first two orders are generously timed by design.
- **Three Estates read as arbitrary punishment** → meters must be *legible*: every delta echoes in the recap ledger ("−5 Sword — the garrison went unwatered"), warnings at 25/10 are mandatory, recovery paths (Dispatch emergency, soap trains, dose-stop proclamation) always exist; playtest asks *"did you see it coming?"* (Into-the-Breach standard), not *"was it fair?"*.
- **Country asymmetry blind spots** → playtesting must include a Vale run (convoy-trade metals) and a Fever Marches run (Health 40 start); endowments bias, never gate; Vale metals cap must not exceed what convoy GDP covers.
- **Batch-fear paralysis** → sour rolls may make players hoard; mitigation = clear odds on the release confirmation, generous sour refund of reagents? No — honesty: show the exact risk, refund nothing, but sour batches are *recoverable* (dump cost ~20% only).
- **Named-citizens scope creep** → 24 notables is hard-capped; all events drawn from a pooled, seeded template system (“the Dockward rat-catcher scenario” etc.), never procgen prose; zero new hand-authored face characters per release.
- **Bounties as the dominant verb** → political bounties stay expensive in Public (−4+ each) and attach Crown suspicion at >3 political bounties/age; bounty-spam cannot be a victory shortcut.
- **TEACH_THE_REALM trivialises the tree** → free spread is real but slow (3–5 turns), sacrifices the whole spread window of Discovery accrual, and the Crown prefers *secrets kept* for wonder-grade techs (doctrine-gated).
- **Blacksmith tool-wear irritation** → 40-turn wear cadence is a tuning constant; playtest checkpoint at M4 specifically on "does maintenance quietly forbid fun?"
- **Patron arc flatness** → five patrons × three ages is 15 payoff scenes to author; each character needs one scene + one letter per age per phase, data-driven from `patron_arcs.ts`; if any arc ships below 60% authored, cut that path to a thin skin instead of shipping a hollow king.
- **First-craft choice paralysis** → the heap offers everything; the game must react *within 20 seconds* with a named patron knocking — the player must never sit wondering "and then what." Playtest explicitly times heap-to-first-patron.
- **Incursion feels targeted** → raids weight nearest hostile tiles ±20% seed variance and never target the capital before Age II; capture is possible only with matching guard shortfall, always with a forecast on the Dawn Report; losing feels like *you lost a battle you saw coming*, never RNG-snipe.
- **Window count creep** → 9 windows + 1 map is the ceiling (§6.24's launcher inventory, keys 1–9 + the map); new content must fold into existing windows or die; audit every release for orphan CSS (D1's lesson).
- **Missions as the quiet win button** → missions per turn hard-capped at 1 without a special; sabotage consumes real stock; *steal the schema* always exposes you if the target had prior notice (your enemies, your country — nobody cheats knowledge).
- **Exchange inflation** → recipe prices tracked per country demand, never store-free; the market is selfish but honest; a country cannot buy the whole catalog in one age (per-country stock caps).
- **Cement trivialises the Wasting** → infrastructure beats plague only *slowly* (Sewer Outfall +2/turn); acute outbreaks still require the chemist's hand; engineering canon and medicine canon **cannot both be maxed in one age** — the epilogue counter rewards depth, not roll-ups.
- **Rebel arc must not be the "correct path"** → joining the Undertow is a strictly worse stability profile for 2 ages beforeAge III's payoff; normal play with the Crown's respect is the default-optimal route; the republic path is the counternarrative, not the solution.
- **Turn-burst jank:** 240 ticks is today's `ADVANCE(24)` path (well under 100 ms) but recap modal heavy lifting must not run pre-burst; chunk events if profiling says so (§6.16).
- **Chemistry × yields balance:** gates on recipes (M2) may strand players; mitigation = permissive gating in Age I, hard gates only from Age II; playtest x3 before M3.
- **COLONY_SYNC invalidation:** throttle or UI starves; SAB is immutable, so v1 mitigation is 2 Hz + dirty-compare.
- ** Hex rewrite regressions:** the old radial map's seamlessness leaks (coordinates) — M3 includes a full coordinate-migration test for saves started pre-M3 (they load into "legacy radial world" read-only? No—migrator snaps old colony onto nearest hex).
- **Solo "victory race" feel** without AI (Q4-a): mitigated by score-threshold pacing + Rival Expedition sabotage events (existing crisis wiring).
- **SW/chem-registry staleness** across frequent builds: bump cache per milestone; verify dist CSS hash referenced by SW.
- **Solo-dev calendar risk** → one pair of hands is assumed. Pre-commit calendar checkpoints at end of M2, M4, M6 with a written continue/cut decision each time (cut ladder, §9); if two consecutive checkpoints slip > 30% past estimate, drop a scope tier before continuing. Burnout is a project risk with a management lever, not a character flaw.
- **No formal balance model** → the headless economy soak (M4/M7 gates) must assert **target net-yield bands per Age** (e.g. Age I food surplus ≥ +3/turn baseline; the trade economy must clear camp wages by ~Day 10; Discovery accrual must outpace Age II tech pacing) with seeded variance slices — not merely "no crash". Author the bands into the M1 soak harness; tune against them.
- **Civ VII adjacency** → mechanics are not protectable and are deliberately re-expressed in the soapwright fiction; still: no Civ VII names, icons, audio, trade dress, or "Civilization" anywhere in the title/store copy/assets. All art and audio procedural or original. One line, zero excuses.
- **Save corruption in the wild** → v3 adds export/import; the museum-mode deposal endings assume the save survives the long run. Ship the read-only "museum mode" export and the v2-backup restore path (§4.1) **before M8**, not after bug reports.
- **Playtester recruitment** → M2's kill-gate needs humans, not aspirations. Recruit during M1: one cautious player, one optimizer/speedrunner, one chemistry-naïve player; ~20 minutes each, scored against the four §12 kill-gate rows; thank-you + first alpha dibs, never payment-in-wine. If three humans cannot be found, the gate cannot be declared — do not self-grade.
- **Storage quota at scale** → see §4.1 storage budget: codex thumbnails re-rendered procedurally (never serialized), the 512 KB ceiling enforced by the 60-turn soak, and the autosave quota catch made loud, not silent.
- **Alternative considered and rejected (recorded)** → "Turn-Based Chemistry Survival + Dispatches": the cheapest 4–8-week option capturing most of the chemistry-first value (turn clock, multi-turn experiments, Dispatches, estates) without hex maps, settlements, or the victory rework. Rejected because the user mandate (2026-11-05) locks the full Civ VII lift; recorded so that if the §12 kill-gate fails, the pivot destination is named, not improvised.

## 13. What this plan deliberately does not answer
- Exact biome noise parameters & wonder-tile placement tables (M3 spike); exact Triumph/Dedication rosters per age beyond the §6.18 seed list (authoring sprint inside M2/M7, data-driven + playtest).
- The Realm's named sickness, ruler and Realm proper nouns (naming pass; "The Wasting" is the bracket term throughout).
- Steam/itch packaging (contender plan governs distribution; unchanged).
- Whether **"Alchemist's Empire"** is the shipped title — placeholder pending your naming pass.
- **Localization** — English-only by design for v1; all player-facing strings live in `src/data/` so a future pass stays possible; no i18n infrastructure in v1.
- **Screen-reader parity for the canvas hex map** — v1 scope: keyboard pan/zoom/cursor + an `aria-describedby` linear summary of map state on the Settlement/Realm windows (HUD chips remain the accessible readout); full canvas-map narration is M9+ at best.
- **Mod support** — not a v1 goal; the content-pipeline layout (§4.3) keeps the door open without committing to it.
- **Telemetry/analytics** — none by design (private, $0); playtest feedback arrives as a structured form, never as in-game beacons.

---

*Prepared under the plastic-surgery protocol (Phase 0–2): alignment locked, defects cataloged, blueprint emitted before any code. Q1/Q3 locked; five separate user mandates (2026-11-05) all folded in: chemistry-first turns; the Five Countries; the Three Estates/deposal endgames; The Realm's Hands; the First Commission jobless start; The Codex & Exchange; The Influence Window; person-to-person windows; correspondence; missions; Built Works. **v8 (2026-11-05):** post-review hardening — factual corrections, CI enforcement, storage budget, content pipeline, falsifiable M2 kill-gate, cut ladder, scope-outs. Q2/Q4/Q5/Q6 remain defaulted, time-boxed to veto by 2026-11-07. Implementation (M0) starts on explicit sign-off.*
