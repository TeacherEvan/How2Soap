# Crisis Turns — Design & Engineering Spec (v1.0)

**Status:** for review → implementation · **Owner:** Phase 2 · **Date:** 2026-11-04
**One line:** telegraphed calamities, resolved in 3–4 quantified choices, integrated with existing systems — no parallel stats, no new currencies.

---

## 1. Design intent

Into the Breach taught that **visible consequences + bounded choices** make turns tense. Sea of Stars taught that a crisis lands hardest inside story context. The Grand Crucible's turn-based rhythm is the *watch* (Rest 1 h / Sleep 8 h) — already telegraphed via `simulateWatchForecast`. Crisis turns extend the same language to danger: **you always see it coming two watches out, and every choice is a chemical, metabolic, or logistical trade.**

**Non-goals (v1.0):** no real-time QTE; no fail-state auto-wipe (a bad choice costs resources, not the run — Apprentice/Alchemist tiers exist for lethality); no RNG-feel-bad (every roll is seeded and shown as odds in the choice detail).

## 2. System architecture

### 2.1 Deterministic schedule — no crisis persistence required
Crisis timing derives from `hash(seed, cycleIndex)` only. On save/load, the director re-derives all telegraphs from `(rngSeed, tick)`; the player must re-answer nothing. Save format unchanged (`migrateSave` untouched).

- **Cycle:** first crisis at tick 480 (Day 2, 00:00); subsequent crises every `rng() ∈ [240, 380]` ticks (1–1.6 days) — sparser than a RimWorld barrage, dense enough to matter.
- **Telegraph lead time:** 2 watches (tick−20) before activation; HUD shows ⚠ + title + watches remaining; Sleep buttons update their tooltip.
- **Activation check** runs inside `stepSingleTick` (post-step), never while paused (`paused === true` defers activation by up to 1 watch, documented).
- **Seeded RNG:** the worker's `rng` (from `createSeededRng(rngSeed)`) drives all rolls → reproducible; crisis tests assert identical outcomes across two fresh directors constructed with the same seed.

### 2.2 Effect vocabulary (pure, unit-testable, composable)
```ts
export type CrisisEffect =
  | { kind: 'glucose'; delta: number }        // kcal, +/-
  | { kind: 'adipose'; delta: number }        // kcal reserves
  | { kind: 'hydration'; delta: number }      // percentage points, 0–100 clamp
  | { kind: 'morale'; delta: number }         // colony morale 0–100 clamp
  | { kind: 'tempShift'; vesselIndex: number; deltaK: number }
  | { kind: 'vesselRuptureHottest'; }          // hottest vessel ruptures (boil-over class)
  | { kind: 'itemLoss'; itemId: string; count?: number; all?: boolean }
  | { kind: 'itemGain'; itemId: string; count: number }
  | { kind: 'wound'; }                         // woundContamination = true
  | { kind: 'fever'; }                         // fever condition = true (fever-wave class)
```
`applyCrisisEffects(world, player, inventory, colony, effects, rng)` — **pure**; the worker calls it, tests call it directly. Crisis defs carry data-only effect arrays → fully data-driven in `src/engine/crisis.ts` (registry-style, same pattern as `reactionRules.ts`).

### 2.3 The eight calamities (v1.0)
| ID | Telegraph title | Flavor | Severity | Signature choice axis |
|---|---|---|---|---|
| `ASH_BLIGHT` | Southern Blight Front | Wind-borne spore kills ash-harvest grounds for 1 watch | 2 | Abandon harvest (−morale) vs. burn through it (+wound) vs. shelter (−kcal) |
| `WOLF_PACK` | Wolf Pack on the Ridge | Adapted ridge wolves press the livestock | 2 | Rally colonists (−morale, save herd) vs. cull one (+gain raw fat) vs. barricades (−cordage-equivalent: −hydration/−kcal) |
| `WELL_TAINT` | Well Runs Sour | Brackish seep into the fresh water line | 2 | Serve stale (−hydration, risk fever) vs. boil everything (−fuel-time: +tempShift on hottest vessel) vs. trek for clean water (−kcal, +hydration) |
| `FEVER_WAVE` | Sweating Sickness | Seasonal flux; everyone sweats at night | 2 | Wet cloth regime (−kcal, no fever) vs. carry on (2-in-3 fever) vs. isolate the weak (−colony morale) |
| `BOIL_OVER` | Vessel Crescendo | Pressure vessel climbing toward burst | 3 | Dump heat (lose open vessel's headspace pressure) vs. pray (rupture chance) vs. decant fast (needs target vessel — choice disabled without one) |
| `PALE_RAID` | The Pale Expedition | A rival camp scavenges your cache at night | 3 | Fight them off (−wound, −morale) vs. let them take the scraps (itemLoss 1× random) vs. poison the water they drank from (+nothing, +infamy flag, +wound risk 1-in-3) |
| `BLIGHT_RAIN` | Black Rain | Acid-lean rain water fouls fermentation | 1 | Keep vats covered (works, −morale) vs. let it rain (ferment ruined: lose ethanol precursors for 1 watch) vs. collect it (gain acid-lean water: enables next Tier-4 path faster) |
| `RIVAL_EXPEDITION` | Rival Kilns Lit | Fires seen on the northern bluff; they race you | 1 | Race harder (−kcal, +renown) vs. ignore (nothing lost, renown neutral) vs. spy (see their next crisis telegraph — reveals next calamity) |

### 2.4 UI contract
- **Banner** (existing `bannersRow`, `aria-live=polite`): `⚠ Crisis brewing — <title> (<n> watches)` while telegraphing; turns severe-tinted inside 1 watch.
- **Modal** (existing overlay stack + focus trap): title, 2-sentence description, three choice buttons with **quantified detail** (`"Shelter: −150 kcal, −5 hydration"`). Buttons are ≥24×24 CSS px (WCAG 2.5.8), keyboard tab order, ESC does nothing (a crisis is not dismissible), Enter confirms focused choice.
- Worker keeps running; a crisis older than 8 watches unresolved auto-resolves to the worst-listed (deterministic) outcome — documented, never silent.

### 2.5 Worker integration
- New union member: `{ type: 'CRISIS_CHOICE'; crisisId: CrisisId; choiceId: string }`.
- New message: `{ type: 'CRISIS_SYNC', telegraph: { crisisId, severity, watchesUntil } | null, active: { crisisId, title, description, severity, choices: CrisisChoice[] } | null }`, posted only on state change (dirty-compare against last sent).
- `stepSingleTick` order preserved: `stepWorld → metabolism → conditions → colony → paddock → crisis tick → species milestones`.

### 2.6 Accessibility & feel
- Reduced-motion: no letterbox animation; banner appears statically.
- Screen readers: modal announces title + choices via `aria-live` entry text inside overlay.
- Colorblind: severity carried by **text label + icon shape**, never color alone.
- Juice (Phase 2 companion): crisis activation plays dissonant strike bell + 300 ms desaturate dip; resolution plays chime/stamp.

## 3. Test plan (all green before UI merge)
- `tests/crisis.test.ts`: schedule determinism (two directors, same seed → identical telegraph at tick 460/480/...), telegraph lead time, pause-deferral, 8 calamities × 3 choices apply their effects (table-driven), RNG replay equality, stale-choice after crisis passes → rejected with EVENTS message, auto-resolve after 8 watches.
- `tests/workerDispatch.test.ts` (extend): CRISIS_CHOICE unknown crisis → EVENTS error; known → modal-independent resolution lands; CRISIS_SYNC posts only on change.
- Soak: crisis does not deadlock the 30-night simulated season; save/load mid-telegraph → telegraph intact via re-derivation.
- Save-compat corpus: crisis state absent from saves ⇒ all legacy saves load.

## 4. Delivery order
1. `src/engine/crisis.ts` + tests (red → green).
2. Worker wiring + `CRISIS_SYNC` + `CRISIS_CHOICE` + dispatch tests.
3. Banner + modal UI (`src/ui/CrisisModal.ts`), strings in registry (i18n-ready).
4. Playtest protocol entry: forced-crisis dev flag (`?crisis=ASH_BLIGHT`) for verification.

## 5. Honest scope note
This is one of the biggest single features in the game's history. Delivery is sliced so each merge is shippable: engine+tests → worker → UI. The 8 calamities ship sequentially if time-boxed: `BOIL_OVER`, `WOLF_PACK`, `FEVER_WAVE` are mechanically distinct; `WELL_TAINT`, `ASH_BLIGHT`, `BLIGHT_RAIN`, `PALE_RAID`, `RIVAL_EXPEDITION` are authored variations.
