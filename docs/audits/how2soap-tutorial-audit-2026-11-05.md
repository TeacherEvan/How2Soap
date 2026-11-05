# Surgical Audit Report: How2Soap — Tutorial & Academy Subsystem

| Audit Metadata | Specification |
| :--- | :--- |
| **Audit Date** | 2026-11-05 |
| **Audited Scope** | `src/ui/TutorialController.ts` (434 LOC), `src/ui/tutorialCurriculum.ts` (382), `src/ui/tutorial.css` (294), `src/assets/tutorial/*` (4 PNG, 592 KB), integration in `src/main.ts`, `src/app/workerMessages.ts`, `src/engine/sim.worker.ts`, `src/app/autosave.ts`, `src/app/state.ts`; tests `tests/tutorialSelectors.test.ts` + `tests/surgicalAuditAndTutorial.test.ts` — **1,362 effective LOC** |
| **Tech Stack & Runtime** | TypeScript 5.4, Webpack 5, Vitest 3, DOM overlays, Canvas/Worker app, Web Audio |
| **Audited Tree** | Tracked HEAD `e321c65`; tutorial source is **unchanged in the working tree** (`git diff -- src/ui/TutorialController.ts src/ui/tutorialCurriculum.ts src/ui/tutorial.css` empty) |
| **Working-Tree State at Audit** | `M src/app/workerMessages.ts` (user's in-flight P1-10 fix), `?? tests/requestSyncNullSlot.test.ts` (user's in-flight test, currently red), `?? docs/plans/OPTIONAL implementation_plan.md` (pre-existing). **None were authored, edited, or reverted by this audit.** |
| **Runtime Probe** | Chromium 156 headless against the production `dist` (18:15) served with COOP/COEP; 1280×600 and 390×844; onboarding driven through splash → country → mud-port → prologue → world; measurements below |
| **Deterministic Health Score** | **`24 / 100`** (`D_raw = 75`, `D_scaled = 64.27`, `P_test = 12`, `M_kill = 20%`, `LOC_eff = 1,362`) — **scoped to the tutorial subsystem, not the repository** |
| **Vibe-Debt Risk Level** | **`CRITICAL`** (`S < 40`; no tutorial P0) |
| **Tutorial Gate Results** | `tests/tutorialSelectors.test.ts` + `tests/surgicalAuditAndTutorial.test.ts`: **12/12 pass** (of which only 5 tests assert tutorial behaviour). Repo-wide gates are red for the unrelated untracked test — see §7. |
| **Score Sensitivity** | Implementation-only LOC (1,110) → **17**; test+integration LOC (1,362) → **24**; `M_kill` 15–30% → **23–25**. Risk stays **CRITICAL** for the subsystem. |

> **Reading the score:** this is not a whole-repo verdict. The repository-wide audit (2026-11-05) scored **64/100 HIGH**. This report scores the 1,362-LOC onboarding surface, which is currently **non-functional as a curriculum**: it loses progress, skips its own lessons, guides the wrong tab, and dims its own modal. A 24 here means "rebuild the tutorial contract", not "the game is broken".

---

## 1. Executive Architecture & Vibe-Debt Triage

The tutorial is visually ambitious and structurally shallow. It is a 434-LOC DOM controller that owns lesson selection, completion state, modal rendering, spotlight geometry, practice grants, and a PhD telemetry calculator, but none of that state is persisted, validated, or exercised by a DOM test. The curriculum is a 15-entry array of inline closures whose completion predicates read whatever the practice-grant button happens to inject, so the "practice" affordance doubles as a skip button for 10 of 15 lessons. The guided spotlight is a second stringly-typed contract: five of its selectors target tab names that do not exist in the rendered tab bar, so an entire tier's guidance is a no-op. The visual layer is worse than the logic: the spotlight ring's 9,999px scrim is stacked above the Academy modal, so opening the tutorial on a fresh world dims the tutorial itself to 28% brightness. The only thing the current tests prove is that 15 lesson objects exist and that one pure function returns positive numbers.

| Severity Tier | Count | Deduction Weight | Primary Failure Domains |
| :--- | :--- | :--- | :--- |
| **P0 — Critical (Crash / Data Loss / Security / Leak)** | **0** | `-18 pts ea` | None tutorial-specific. (The unrelated P1-10 `REQUEST_SYNC` crash is visible in the probe console; see §7.) |
| **P1 — High (State Loss / Logic / Functional Blocking)** | **6** | `-8 pts ea` | Tutorial progress not saved; Intermediate spotlight no-op; practice grants self-complete; spotlight scrim over the modal; PhD telemetry unwired; coachmark never completes/dismisses |
| **P2 — Medium (Contract / A11y / Content / Reliability)** | **7** | `-3 pts ea` | Grant registry mismatch; phantom item IDs; proxy predicates; keyboard/focus gaps; 390px clipping; content/spec drift; missing predicate error boundary |
| **P3 — Low (DX / Payload / Copy / Lifecycle)** | **6** | `-1 pt ea` | False WCAG-AAA claim; 592 KB PNG plates; PhD math clamp/SID proxy; magic thresholds + stringly-typed contracts; raw item labels; lifecycle leaks (destroy/stack) |

**Scored set:** the 6 P1 + 7 P2 + 6 P3 findings below. Four additional hardening notes — no `.catch` on the tutorial import, no bounds validation in `GRANT_TUTORIAL_REAGENTS`, static `innerHTML` trust, and modal re-entry — are reported for completeness but **not** included in `D_raw`, so the score is conservative.

### High-Risk File Telemetry Hotspots

| File Path | Effective LOC | Est. Cyclomatic Complexity / Branch Density | Silent Catches | Primary Vibe-Debt Signature |
| :--- | :--- | :--- | :--- | :--- |
| `src/ui/TutorialController.ts` | **434** | **31 `if`, 3 loops, 1 `catch`** | 0 | God controller: DOM + tutorial state + spotlight geometry + PhD math; no persistence, no destroy |
| `src/ui/tutorialCurriculum.ts` | **382** | **15 `isComplete` closures, 7 `if`, 21 `return`** | 0 | Stringly-typed lesson contracts: selectors, tab targets, grants, and predicates can drift independently |
| `src/ui/tutorial.css` | **294** | 0 branches; **0 media queries** | 0 | 9,999px scrim at `z-index:9000`; fixed two-column modal; fixed coachmark |
| `tests/tutorialSelectors.test.ts` | **75** | 0 | 0 | Only checks `#id` substrings; 2 of 4 tests are campaign coverage, not tutorial |
| `tests/surgicalAuditAndTutorial.test.ts` | **125** | 0 | 0 | 3 tutorial tests: count, field truthiness, telemetry `> 0`; no DOM, persistence, grant, or predicate test |

---

## 2. The 10-Principal-Engineer Deep Audit

### Lens 1 — Systems Architect (Topology, Coupling & State Machines)

- **[P1-1] Tutorial progress is not part of the save state** — `src/ui/TutorialController.ts:30-37`, `src/app/autosave.ts:18-126`, `src/app/state.ts:127`
  - **Root Cause Mechanism:** `TutorialController` owns `activeTier`, `activeLessonId`, `completedLessonIds`, and `phdTelemetryEnabled` as private in-memory fields. `buildSaveSnapshot()` serializes players, vessels, inventory, colony, campaign, and even `timedRequests`, but has no tutorial field. `state.tutorial` is a nullable runtime singleton, not a serializable one.
  - **Deterministic Trigger & Failure Mode:** Complete Step 5, wait for autosave, reload, click "Continue Chronicle". The save JSON's key list contains no `tutorial`; the new controller starts at `beg_1_forage` with an empty `completedLessonIds`. On the first `PLAYER_SYNC`, `checkProgress` finds a satisfied predicate in the restored inventory and auto-advances. Probe: after reaching Step 5, reload returned to **Step 2** (the restored `PINE_DEADFALL_WOOD` re-completed Step 1). On a reload with a stocked inventory, the empty completed set is re-evaluated at 10 Hz; any restored predicate that is already satisfied re-completes, replaying `audio.chime()`/`audio.levelUp()` and skipping lessons the player never saw.
  - **Surgical Fix Specification:** Add `tutorial: { activeTier, activeLessonId, completedLessonIds: string[], phdTelemetryEnabled, coachmarkDismissed }` to the v4 save schema; restore it after controller construction; include tutorial progress in the autosave dirty signature or call `requestAutoSave()` on lesson completion. A save/restore round-trip test must fail on the pre-fix tree.

- **[P1-5] The PhD Telemetry Overlay is an authored-but-unwired feature** — `src/ui/TutorialController.ts:33,48-54,148-151,234-239,395-434`, `src/ui/tutorialCurriculum.ts:281,305`
  - **Root Cause Mechanism:** The checkbox only flips `this.phdTelemetryEnabled`; no renderer reads it. `computeVesselPhdTelemetry()` is exported and tested, but has **zero production callers** (`grep` finds only `tests/surgicalAuditAndTutorial.test.ts:116`). The "SID", "Arrhenius", and "Newton" values never reach the DOM.
  - **Deterministic Trigger & Failure Mode:** Open Tier III, tick "PhD Telemetry Overlay", select `phd_1_sid`. The lesson instructs the player to "Observe the live SID readout in PhD Telemetry Mode"; no readout exists anywhere on screen. The checkbox appears to do nothing. This is the exact "authored-but-unwired" failure mode the engagement lens exists to catch.
  - **Surgical Fix Specification:** Move the pure math to `src/engine/phdTelemetry.ts`; render a small telemetry panel from the current `WorldSnapshot` when enabled (temp, pH, SID, `k(T)`, Newton loss); add a DOM test that toggles the checkbox and asserts the readout text changes. Fix the math clamp in P3-3 before wiring.

- **[P1-6] The coachmark is permanent and never reaches a completion state** — `src/ui/TutorialController.ts:281-328,368-389`
  - **Root Cause Mechanism:** `updateCoachmark()` shows the fixed bottom bar whenever `activeLessonId` is non-null. `checkProgress()` only nulls the lesson if `TUTORIAL_LESSONS.find()` fails, which never happens; after the last lesson in a tier it plays `audio.levelUp()` and leaves `activeLessonId` pointing at the final lesson. There is no `complete`, `dismissed`, or `hidden` transition, and no close button in the coachmark markup.
  - **Deterministic Trigger & Failure Mode:** Complete Step 5 (`beg_5_salt_skim`); the coachmark still reads "Step 5/5: Salting-Out & Bar Soap" with a "Grant Reagents" button. Probe: two consecutive Step 5 grants leave the bar visible forever. On a 390×844 viewport the bar is 290.6×164 at the bottom — 19% of the screen — and there is no way to dismiss it.
  - **Surgical Fix Specification:** Add a coachmark state machine (`active | complete | dismissed`); on the final lesson render "Tier complete — open the Field Manual for the next tier" and a "Dismiss" button; persist `coachmarkDismissed` in the save; add a test that completes Step 5 and asserts the bar is hidden or shows the completion state.

### Lens 2 — Frame-Budget & Performance Engineer (Hot Loops & Latency)

- **[P2-7] `checkProgress` runs at 10 Hz with no error boundary and one avoidable allocation** — `src/app/workerMessages.ts:135-140`, `src/ui/TutorialController.ts:368-389`, `src/ui/tutorialCurriculum.ts:120-128`
  - **Root Cause Mechanism:** Every `PLAYER_SYNC` calls `checkProgress`, which does `TUTORIAL_LESSONS.find` over 15 entries. `beg_4_saponify` additionally does `Array.from(ctx.snapshot.moles.subarray(0, 64)).some(...)`, allocating a 64-element array 10×/s. The call is not wrapped in `try/catch`; predicates use `any` and `it.id.includes(...)`.
  - **Deterministic Trigger & Failure Mode:** A restored inventory slot with no `itemId` produces an `items` entry with `id: undefined`; `it.id.includes('DEADFALL')` throws `TypeError` inside the `PLAYER_SYNC` handler. The handler has no boundary (`main.ts:122` assigns `handleWorkerMessage` directly to `worker.onmessage`), so the throw aborts the rest of the handler — including the death-modal branch below `checkProgress` — and repeats at 10 Hz. The allocation is minor; the unguarded predicate is the real defect.
  - **Surgical Fix Specification:** Wrap `checkProgress` in `try/catch` and report a one-shot `SIM_ERROR`/toast; make every predicate a total function (`typeof it?.id === 'string'`); replace `Array.from` with a direct index loop over `snapshot.moles` and the known `K_STEARATE`/`NA_STEARATE` indices.

- **[P3-2] Four 1024×576 PNG plates, 592 KB total, no responsive variants** — `src/ui/TutorialController.ts:12-22`, `src/assets/tutorial/*.png`, `webpack.config.js:70-72`
  - **Root Cause Mechanism:** The four plates are imported as `asset/resource` PNGs (`assetModuleFilename: 'static/media/[name].[hash:8][ext]'`) and rendered as a single full-resolution `<img>` per modal render. There is no WebP/AVIF conversion, no `srcset`/`sizes`, and no per-tier preload policy. Each file is 124–164 KB; the first modal open fetches 124 KB, and visiting all tiers fetches 592 KB.
  - **Deterministic Trigger & Failure Mode:** At 390×844 the plate is displayed ~214px wide but the browser fetches the 1024px original; on a slow mobile connection the lesson body appears before the plate. On a desktop, switching across all three tiers loads all four originals even though only one is visible at a time.
  - **Surgical Fix Specification:** Convert to WebP/AVIF at 1024px and 512px, add `srcset`/`sizes`, `loading="lazy"` + `decoding="async"`, and preload only the active tier's plate. Target ≤60 KB per plate at 1024px and ≤20 KB at 512px.

### Lens 3 — Mathematical, Physics & Algorithmic Engineer (Precision & Edge Cases)

- **[P2-6] The curriculum teaches numbers the engine does not implement** — coordinates in the table below
  - **Root Cause Mechanism:** Lesson prose, formulas, action hints, and predicates were authored as independent strings; none is derived from the chemistry/fabrication constants. The result is a tutorial that teaches a different game than the one the worker runs.
  - **Deterministic Trigger & Failure Mode:** A player follows the Tier III Faraday lesson and applies 5.0 V expecting a 4.5 V decomposition threshold; the engine's `molten_naoh_electrolysis` rule starts at **2.25 V** (`src/data/reactionRules.ts:278`). The lesson also says a 12-cell pile delivers **9.6 V**, while the craftable `VOLTAIC_PILE_BATTERY` is **13.2 V DC** (`src/data/items.ts:62`). Tier II says Willow Tea/Mint Tonic give **+30%**; the actual multipliers are **1.25** and **1.35** (`src/data/items.ts:89,121`). The bronze lesson says 88:12 and 1,350 K; the fabrication recipes consume **1 copper ingot + 1 tin ingot** with no temperature gate (`src/engine/fabrication.ts:336-337`).
  - **Surgical Fix Specification:** Replace every hard-coded teaching value with an import or a derived display from the engine constants (`ELECTROLYSIS_RULES[...].minDecompositionVolts`, `ITEM_BY_ID['VOLTAIC_PILE_BATTERY']`, `StimulantSpec.speedMultiplier`, the actual recipe ratio). Add a `tutorialContent.test.ts` that asserts each lesson's numeric claim against the source of truth.

| Lesson claim | Curriculum coordinate | Engine/source value | Drift |
| :--- | :--- | :--- | :--- |
| Faraday decomposition 4.5 V / apply >5.0 V | `tutorialCurriculum.ts:367-373` | `2.25 V` (`reactionRules.ts:278`) | Wrong chemistry |
| 12-cell pile = 9.6 V | `tutorialCurriculum.ts:371` | `13.2 V DC` (`items.ts:62`) | Wrong hardware |
| Willow/Mint = +30% | `tutorialCurriculum.ts:252` | `1.25` / `1.35` (`items.ts:89,121`) | Wrong boost |
| Bronze = 88:12 at 1,350 K | `tutorialCurriculum.ts:205-211` | 1 copper + 1 tin, no temp (`fabrication.ts:336-337`) | Ratio/temperature not enforced |
| Leach pH > 10.5 (summary) / >11.0 (formula) / >=10.0 (predicate) | `tutorialCurriculum.ts:65-66,75` | One predicate, three numbers | Internal drift |
| Caustic pH > 12.5 (subtitle) / >=12.0 (predicate) | `tutorialCurriculum.ts:83,97` | Two numbers | Internal drift |
| Saponify at 355 K (subtitle) / >350 K (formula) / 358.15 K grant | `tutorialCurriculum.ts:105,109,118` | Predicate checks no temperature at all | Claim unverified |
| Arrhenius window 350–368 K / predicate 350–370 K | `tutorialCurriculum.ts:305,313` | Two windows | Internal drift |
| Condensation efficiency >95% | `tutorialCurriculum.ts:349` | `stepBoiling` transfers all vapor moles, no efficiency factor (`chemistry.ts:337-340`) | Wrong model |
| \(K_{sp}\) = 0.08 mol²/L² | `tutorialCurriculum.ts:325` | Salting-out is a reaction rule, not a Ksp calculation (`reactionRules.ts:84-99`) | Wrong model |

- **[P2-3] Completion predicates test proxies or inputs, not the taught output** — `src/ui/tutorialCurriculum.ts:120-128,172-175,218-221,334-337,355-360,377-380`
  - **Root Cause Mechanism:** Even without the practice grant, the predicates accept states that do not contain the lesson's product: `beg_4` accepts **any** vessel-0 species > 0.05 mol (including unreacted KOH), `int_1` accepts any equipped tool (including a wooden one), `int_3` accepts copper or tin ingots (the inputs, not bronze), `phd_3` accepts a bar of soap (not a Ksp precipitation), `phd_4` accepts acid or distilled water (not a condenser transfer), and `phd_5` accepts sodium metal from any source (not electrolysis).
  - **Deterministic Trigger & Failure Mode:** A player who has completed Step 3 (KOH in vessel 0) opens Step 4 and it is already "complete"; a player who owns a copper ingot sees the bronze lesson complete without smelting; a player who bought a bar of soap completes the Ksp lesson without salting out. The tutorial reports success for actions the player did not perform.
  - **Surgical Fix Specification:** Check the product species/item and, where relevant, a provenance flag: `K_STEARATE`/`NA_STEARATE` moles for saponification; a `BRONZE_*` item for bronze; `condenserTargetVesselId >= 0` plus distillate moles for distillation; a `sodiumFromElectrolysis` flag or `SODIUM_METAL` produced in the vessel (not the inventory) for Faraday. Add negative cases to `tests/tutorialPredicates.test.ts`.

- **[P3-3] `computeVesselPhdTelemetry` has a low-temperature clamp and a SID proxy** — `src/ui/TutorialController.ts:405-425`
  - **Root Cause Mechanism:** `Math.max(200, tempK)` evaluates the Arrhenius rate at 200 K for any vessel at 0–200 K, so a frozen/empty vessel reports a large positive `k(T)` instead of approaching zero. `sidMolL = ohConc - hConc` is just \([OH^-]-[H^+]\), not the strong-ion difference the lesson defines; it ignores carbonate/bicarbonate buffering, which is the whole point of ash leaching. `Math.max(0, ph)` propagates `NaN` (Math.max with NaN is NaN), so a bad telemetry read produces `NaN` in every field.
  - **Deterministic Trigger & Failure Mode:** Wire the overlay, select an empty vessel at ambient 288 K (temp is fine) or a corrupted 0 K slot: `arrheniusRateK` is computed at 200 K, not 0 K; `sidMolL` reports 0 for a neutral solution but a misleading value for a buffered carbonate bath. The current unwired status hides this, but the fix must not ship the math as-is.
  - **Surgical Fix Specification:** Use `tempK <= 0 ? 0 : A * exp(-Ea/(R*tempK))`; compute SID from the same charged-species sum as `computePH` (or move the shared helper to `chemistry.ts`); clamp `ph` with `Number.isFinite` before the power; add boundary tests for 0 K, `NaN`, pH 0, and pH 14.

### Lens 4 — Concurrency, Async & Determinism Engineer (Race Conditions)

- **[P1-3] Practice grants satisfy completion predicates; one grant can cascade across lessons** — `src/ui/TutorialController.ts:241-254,308-320,368-389`, `src/ui/tutorialCurriculum.ts:48-148,166-264,282-376`
  - **Root Cause Mechanism:** `isComplete(ctx)` is evaluated against the same live inventory/vessel state that `practiceGrant` mutates. Ten of fifteen grants inject the exact item, species, or temperature the predicate reads. `checkProgress` advances at most one lesson per `PLAYER_SYNC`, so a grant that satisfies several consecutive predicates cascades across ticks.
  - **Deterministic Trigger & Failure Mode:** Runtime probe (1280×600, production dist): click "Grant Reagents" on Step 1 → immediately advances to Step 2. Click "Grant Reagents" on Step 3 → jumps directly to **Step 5**, skipping Step 4 "Thermal Saponification" entirely (the injected 2.0 mol KOH satisfies `beg_4`'s "any mole > 0.05" predicate). The static count is **10/15** self-completing; see the table below. The tutorial can be "completed" in a handful of clicks without performing the taught chemistry.
  - **Surgical Fix Specification:** Separate `practiceGrant` from `isComplete`; never let a grant satisfy its own predicate by construction. Predicates must check the *output* of the taught action (`K_STEARATE`/`NA_STEARATE` moles for saponification, `BRONZE_*` inventory for bronze, condenser transfer for distillation, electrolysis-produced sodium flag for Faraday). Add a table-driven test that applies each `practiceGrant` to a synthetic state and asserts `isComplete` is false unless the lesson is explicitly a "demo" lesson.

| Lesson | Grant injects | Predicate reads | Self-completes? |
| :--- | :--- | :--- | :--- |
| `beg_1_forage` | `PINE_DEADFALL_WOOD` | any item id containing `DEADFALL`/`BERRIES` | **Yes** |
| `beg_2_leach` | `K2CO3 0.8` + bark (no water/ash) | vessel 0 pH ≥ 10 | No — pH stays **7.00**; needs `ADD_ASH` + water |
| `beg_3_caustic` | `KOH 1.5` + limestone | vessel 0 pH ≥ 12 | **Yes** — 13.47 |
| `beg_4_saponify` | `KOH 2.0` + `K_STEARATE` (unmatched) + fat | any vessel-0 mole > 0.05 | **Yes** — KOH alone |
| `beg_5_salt_skim` | `BAR_SOAP 1` | `BAR_SOAP` in inventory | **Yes** |
| `int_1_mohs` | flint adze + flake | any equipped tool | No — grant goes to cache, not a tool slot |
| `int_2_geology` | malachite + cassiterite ore | ore id in inventory | **Yes** |
| `int_3_bronze` | copper + tin ingots | copper/tin ingot id | **Yes** — inputs, not bronze |
| `int_4_colony` | `BAR_SOAP 2` | any colonist | No |
| `int_5_payroll` | willow tea + soap | colony ledger length > 0 | No |
| `phd_1_sid` | `K2CO3 1.0` + `KOH 0.5` | vessel 0 pH 12.5–14 | **Yes** — 12.99 |
| `phd_2_arrhenius` | `KOH 1.2` + temp 356.15 K | vessel 0 temp 350–370 K | **Yes** |
| `phd_3_ksp` | `NACL` + `NA_STEARATE` (both unmatched) | `BAR_SOAP` in inventory | No — grant is a no-op |
| `phd_4_distill` | `SULFURIC_ACID_BOTTLE` + `DISTILLED_WATER` (phantom) | id containing `ACID`/`DISTILLED`/`ETHANOL` | **Yes** — on phantom items |
| `phd_5_faraday` | `SODIUM_METAL 1` | `SODIUM_METAL` in inventory | **Yes** |

- **Async import has no failure path** — `src/main.ts:209-220`
  - **Root Cause Mechanism:** `import('./ui/TutorialController').then(...)` has no `.catch`. If the chunk fails to load (offline, stale hash, CSP), the promise rejection is unhandled, `state.tutorial` stays `null`, and the HUD/coachmark never appear. There is no user-visible fallback.
  - **Trigger & Failure Mode:** Block the `TutorialController` chunk in DevTools and reload; the "How to Play" button is absent, the coachmark is absent, and the console shows an unhandled rejection.
  - **Fix:** Add `.catch(() => showToast('Tutorial unavailable — reload to retry', 'failure'))`; keep a static "How to Play" button in `index.html` that opens a minimal text fallback.

### Lens 5 — Memory & Resource Lifecycle Engineer (Leaks & Cleanup)

- **[P3-6] Lifecycle leaks: no `destroy()`, a stale spotlight target, and an overlay-stack entry on reopen** — `src/ui/TutorialController.ts:83-111,330-366`
  - **Root Cause Mechanism:** The controller has no teardown; `spotlightRingEl` is appended to `document.body` and only hidden, never removed. `currentSpotlightEl` can point to a node that a tab re-render replaced; `clearSpotlight()` then removes the class from the detached node and leaves the live replacement unmarked. `openAcademyModal()` removes `this.modalEl` but not `this.currentOverlayEntry` from `globalOverlayStack`, then pushes a new entry and overwrites `currentOverlayEntry`; reopening without closing leaks a stack entry. The HUD button and coachmark are re-created on every `startWorld()` (including import-save), while the old controller's modal/listeners are not explicitly torn down.
  - **Trigger & Failure Mode:** Open the Academy, import a save (`startWorld({load})`), then close the old modal: the old controller's overlay entry may outlive its DOM; the new controller has a new coachmark but the old `spotlightRingEl` remains until GC. Calling `openAcademyModal()` twice without closing grows `globalOverlayStack.size()`; Escape's `closeTop()` can close a stale entry whose DOM is already gone and leave the visible modal open.
  - **Fix:** Add `destroy()` that removes the HUD button, coachmark, ring, modal, and overlay entry; call it before re-instantiating in `startWorld`; re-query the spotlight target on each `updateCoachmark`; at the top of `openAcademyModal()`, call `closeAcademyModal()` rather than removing only `modalEl`, and assert the stack size in `tests/tutorialDom.test.ts`.

### Lens 6 — Security & Trust-Boundary Engineer (AppSec & Sandboxing)

- **`GRANT_TUTORIAL_REAGENTS` is an unvalidated cheat command** — `src/engine/sim.worker.ts:134,1084-1121`
  - **Root Cause Mechanism:** The command accepts arbitrary `items` (itemId/count/massKg), `vesselSpecies` (speciesId/moles), and `vesselTempK`. It does not check `ITEM_BY_ID`, species registry membership, count/mass/mole sign or upper bounds, or temperature range. `count: -5` adds a negative slot; `moles: 1e12` or `vesselTempK: -1` mutates the vessel without validation. Unknown item IDs are added with `label: it.itemId`.
  - **Trigger & Failure Mode:** A buggy/malicious UI message can create negative inventory, unknown items, or non-physical vessel state. In a local single-player game this is a cheat surface, not a remote exploit, but it violates the same consume/validate contract the worker applies to normal commands.
  - **Fix:** Validate every item against `ITEM_BY_ID`, every species against `SPECIES_BY_INDEX`, clamp counts to `1..999`, masses to `0.001..50`, moles to `0..100`, temp to `0..2000 K`; reject unknown IDs with an `EVENTS`/`SIM_ERROR` message instead of silently adding them.

- **Static `innerHTML` is trusted today, but the pattern is unsafe** — `src/ui/TutorialController.ts:120-198,291-306`
  - **Root Cause Mechanism:** `summaryHtml`, `formulaHtml`, `actionHint`, and `title` are interpolated into `innerHTML`. They are static literals in `tutorialCurriculum.ts`, so there is no current XSS path. But the curriculum is a data-shaped array that a future mod/translation layer could populate from user content; the controller would inject it unsanitized. CSP blocks script but not DOM/style injection.
  - **Fix:** Keep the static literals, but escape interpolated fields (`escapeHtml`) or build the lesson body with `textContent`; add a comment that `summaryHtml`/`formulaHtml` are trusted-only.

### Lens 7 — Reliability, Fault Tolerance & Chaos Engineer (Crash Vectors)

- **P1-1 and P2-7 are the reliability story** — no persistence + unguarded predicate evaluation. See Lens 1 and Lens 2.
- **Modal re-entry is not idempotent** — `src/ui/TutorialController.ts:83-111`
  - **Root Cause Mechanism:** `openAcademyModal()` removes only the DOM node; `closeAcademyModal()` removes the stack entry only when `modalEl` exists. There is no explicit `isOpen` state; the method relies on DOM presence.
  - **Trigger & Failure Mode:** A double invocation (e.g., a future keyboard shortcut plus the HUD button) creates two stack entries; Escape closes the top one and the bottom modal remains. The current full-screen overlay mostly prevents the second click, so this is a latent reliability defect.
  - **Fix:** Add an `isOpen` boolean; make `openAcademyModal()` return early if open; make `closeAcademyModal()` always remove the entry if present.

### Lens 8 — Type Systems, Schema & Contract Engineer (Boundary Integrity)

- **[P1-2] All five Intermediate-tier spotlight selectors are invalid; `explorer` has no handler** — `src/ui/tutorialCurriculum.ts:162,185,208,231,251`, `src/ui/WorkbenchCanvas.ts:27-33`, `src/main.ts:213-217`
  - **Root Cause Mechanism:** The five Intermediate lessons use `[data-tab="explorer"]`, `[data-tab="workbench"]`, and `[data-tab="strategy"]`. `renderWorkbenchTabs` renders the keys `REACTIONS`, `FABRICATION`, `PADDOCKS`, `STRATEGY`, `JOURNAL` (uppercase); there is no `explorer` tab at all. `onSwitchTab` implements `workbench → REACTIONS`, `strategy → STRATEGY`, `council → JOURNAL`, but has no `explorer` branch, so `int_1`/`int_2` stay on the current tab and then query a selector that cannot match.
  - **Deterministic Trigger & Failure Mode:** Open Tier II, select `int_1`, click "Guided Spotlight": the modal closes, the coachmark changes to the Mohs lesson, and the ring is `display:none` (runtime probe). `int_3` and `int_4` behave the same; `int_4` switches to Strategy but still has no ring because the selector is lowercase. The entire tier's guidance is a no-op while the test suite passes.
  - **Surgical Fix Specification:** Replace the selectors with stable, rendered targets (`#biome-panel-container`, `[data-tab="REACTIONS"]`, `[data-tab="STRATEGY"]`); make `onSwitchTab` an exhaustive `Record<TutorialLesson['tabTarget'], () => void>` including `explorer` (scroll/reveal the biome panel); re-apply the spotlight after the tab render and on resize. Add a runtime selector test that must fail on the current strings.

- **[P2-1] Grant species IDs do not match the species registry** — `src/ui/tutorialCurriculum.ts:70,92,114-117,283-285,329-332`, `src/engine/sim.worker.ts:1099-1105`, `src/data/speciesRegistry.ts:26-64,85-196`
  - **Root Cause Mechanism:** The grant handler matches `spec.code === sp.speciesId || (spec as any).id === sp.speciesId`. The registry codes are `K2CO3`, `KOH`, `NaCl`, `C18H35KO2`, `C18H35NaO2`; the curriculum uses `K_STEARATE`, `NACL`, `NA_STEARATE`. `ChemicalSpecies` has no `id` field, so the fallback never matches.
  - **Deterministic Trigger & Failure Mode:** `beg_4`'s `K_STEARATE 1.2` and `phd_3`'s `NACL 2.5` + `NA_STEARATE 0.8` are silently skipped. `phd_3` has no item grant, so its "Spawn Lesson Reagents" button adds **nothing** while claiming success. `beg_2`'s grant adds `K2CO3` (neutral in the pH model) and bark, not the ash/water/CaO the lesson asks for; probe: pH stays **7.00**, and the coachmark remains on Step 2.
  - **Surgical Fix Specification:** Use the enum indices (`SPECIES.K_STEARATE`, `SPECIES.NACL`, `SPECIES.NA_STEARATE`) in `practiceGrant`, or add a registry-code alias table. Add a test that maps every `speciesId` in every grant to `SPECIES_BY_INDEX` and every `itemId` to `ITEM_BY_ID` (or an explicit vessel-only allowlist).

- **[P2-2] `phd_4_distill` grants two item IDs that do not exist** — `src/ui/tutorialCurriculum.ts:348-355`, `src/data/items.ts:226`
  - **Root Cause Mechanism:** `SULFURIC_ACID_BOTTLE` and `DISTILLED_WATER` are not in `ITEM_BY_ID`. The worker adds them anyway with `label: it.itemId`, so the inventory panel finds no `ItemDef`, renders no icon, and offers no actions. The completion predicate matches `.includes('ACID')` / `.includes('DISTILLED')`, so the lesson completes on the phantom items without any distillation.
  - **Trigger & Failure Mode:** Click "Spawn Lesson Reagents" on `phd_4_distill`; two raw-ID slots appear, the coachmark advances, and no condenser was configured. The item catalog test (`tests/items.test.ts`) does not cover tutorial grants, so it passes.
  - **Fix:** Use real IDs (`SULFURIC_ACID` is a vessel-only input, not an inventory item; `WATER_VESSEL` exists) or remove the item grant and grant the vessel species (`H2SO4`, `H2O`); add the grant IDs to the item-integrity test.

### Lens 9 — Platform, Viewport & Portability Engineer (Cross-Device Parity)

- **[P1-4] The spotlight scrim is stacked above the Academy modal and is active at boot** — `src/ui/tutorial.css:281-288`, `src/styles.css:925-933`, `src/ui/TutorialController.ts:327,83-100`
  - **Root Cause Mechanism:** `#tutorial-spotlight-ring` is `z-index:9000` with `box-shadow: 0 0 0 9999px rgba(10,8,6,0.72)`; `.modal-overlay` is `z-index:999`. `updateCoachmark()` at boot applies the ring to the first lesson's target, and `openAcademyModal()` does not clear it. The shadow is painted above the modal, so the entire modal sits under a 72% black scrim.
  - **Deterministic Trigger & Failure Mode:** Boot a fresh world (the coachmark is shown immediately) and click "How to Play". Runtime probe at 1280×600: ring `display:block`, `z-index:9000`, rect `(37.6,189.5,263.6×459.3)` around the TREES category; modal `z-index:999`, card `960×540` at `(160,30)`. The screenshot shows the Academy dimmed to ~28% brightness. At 390×844 the same scrim covers the clipped mobile modal.
  - **Surgical Fix Specification:** Hide/clear the spotlight in `openAcademyModal()` and re-apply it on close; put the ring below `.modal-overlay` (`z-index:998`) or render the scrim inside the modal's own backdrop; add a DOM test that opens the modal with an active spotlight and asserts the ring is hidden or lower than the modal, and that the card's computed brightness is unaffected.

- **[P2-4] The tutorial is mouse-only and not a dialog for assistive technology** — `src/ui/TutorialController.ts:120-198,220-231,290-306`, `src/main.ts:263-268`
  - **Root Cause Mechanism:** Lesson cards are `<div class="lesson-item-card" onclick=...>` with no `role="button"`, `tabindex`, or key handler. The modal has no `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, or focus restore; the tier bar has no `role="tablist"`/`aria-selected`; the coachmark has no `aria-live`. The global Space handler excludes `button`/`[role="button"]` but the lesson cards match neither, so Space ends the turn behind the open modal when focus is on `BODY`.
  - **Deterministic Trigger & Failure Mode:** Open the Academy with the keyboard: `document.activeElement` stays `BODY` (runtime probe). Tab moves focus behind the overlay; Space triggers `ADVANCE 24` underneath; a screen reader announces neither the dialog nor the changed coachmark. `tutorial.css:1`'s "WCAG 2.1 AAA Compliant" comment is false at Level A (2.1.1 keyboard).
  - **Surgical Fix Specification:** Render lesson cards as `<button>` (or `role="button" tabindex="0"` with Enter/Space); add `role="dialog" aria-modal="true" aria-labelledby="tutorial-title"`; reuse `WindowManager`'s `trapFocus` helper and restore focus to `#btn-open-tutorial`; add `role="tablist"`/`role="tab"`/`aria-selected` to the tier bar; set `aria-live="polite"` on the coachmark badge; stop Space propagation while the modal is open.

- **[P2-5] No responsive rules; the 390px modal clips its right column and the coachmark eats 164px** — `src/ui/tutorial.css:69-91,232-247` (zero `@media`), `src/styles.css:947`
  - **Root Cause Mechanism:** `.tutorial-modal-body` is a fixed two-column flex row with `flex:1.3`/`flex:1`; `.tutorial-right-col` adds `padding-left:16px` and a border. `.modal-card` has `overflow:hidden`. The coachmark is a fixed flex row with `gap:20px`, no `max-width`, no `flex-wrap`, and no safe-area inset.
  - **Deterministic Trigger & Failure Mode:** Runtime probe at 390×844: card 370.5×759.6 at x=9.75; left column 214.1 wide, right column **143.3 wide with its right edge at 400.1**, 10.1px beyond the 390px viewport and clipped by `overflow:hidden`. The screenshot shows "Curriculum Steps (5)" and lesson names cut off at the right edge. The coachmark is **290.6×164** at the bottom — 19% of the viewport height — with its text wrapped into a narrow column.
  - **Surgical Fix Specification:** `@media (max-width: 720px) { .tutorial-modal-body { flex-direction: column; } .tutorial-right-col { border-left: 0; padding-left: 0; } .tutorial-coachmark { left: 8px; right: 8px; transform: none; flex-wrap: wrap; max-height: 40vh; overflow-y: auto; } }`; add `env(safe-area-inset-bottom)`.

- **[P3-1] The stylesheet claims "WCAG 2.1 AAA Compliant"; the tier badge is 5.55:1** — `src/ui/tutorial.css:1-12`, `src/styles.css:1-10`
  - **Root Cause Mechanism:** The header comment asserts blanket AAA compliance, but the `.badge-tier` text uses `--accent` (#e0a458) on a 25%-alpha accent background over `--bg` (#0b0f12), which computes to **5.55:1** — below the **7:1** AAA threshold for normal text. The badge is `0.75rem` / 600 weight, not large text. Separately, the lesson cards fail WCAG 2.1.1 (keyboard) as described in P2-4, which is a Level A failure.
  - **Deterministic Trigger & Failure Mode:** A low-vision user reads the HUD tier badge or the coachmark step number; the 12px accent text is below AAA contrast. A keyboard-only user cannot activate a lesson card at all, so the "AAA" claim is false at the lowest level.
  - **Surgical Fix Specification:** Change the badge to `color:#f5eccb` on `rgba(224,164,88,0.35)` or add a solid dark background and verify ≥7:1; remove the blanket "AAA" comment and state the tested pairs, or replace it with "AA contrast; keyboard support pending".

- **Touch/pointer input:** the tutorial uses ordinary buttons and click handlers; no canvas hit-testing or pointer-coordinate desync. `N/A` beyond the keyboard/focus gaps above.

### Lens 10 — Cognitive Load & AI-Context Maintainability Engineer (DX)

- **[P3-4] Magic thresholds, duplicated step counts, and a 434-LOC God controller** — `src/ui/TutorialController.ts:294` (`Step ${lesson.stepNumber}/5`), `src/ui/tutorialCurriculum.ts` (three pH thresholds, four temperature numbers, two Faraday voltages), `src/ui/TutorialController.ts` (all concerns)
  - **Root Cause Mechanism:** The same concept is encoded in prose, formula, action hint, grant, and predicate with no shared constant. `Step X/5` hard-codes the tier length; adding a sixth lesson breaks the coachmark silently. `TutorialEvalContext.state` is `any`, and `onSwitchTab` accepts `string` while implementing only three of the four `tabTarget` values, so schema/tab drift is invisible to `tsc`. The controller mixes DOM rendering, lesson progression, persistence-adjacent state, spotlight geometry, and thermodynamics; `computeVesselPhdTelemetry` lives in the DOM module, so the pure math cannot be imported without pulling CSS/assets.
  - **Trigger & Failure Mode:** A designer changes the leach pH from 10.0 to 10.5 in the predicate; the summary still says 10.5, the formula says 11.0, and the test suite still passes. A sixth lesson is added; the coachmark says `6/5`.
  - **Fix:** Export a `TUTORIAL_THRESHOLDS` object and derive prose/formula/predicate from it; use `tierLessons.length` in the coachmark; type `state` as a narrow `TutorialStateView`; make `onSwitchTab` take `TutorialLesson['tabTarget']` with an exhaustive `Record<TutorialLesson['tabTarget'], () => void>`; move `computeVesselPhdTelemetry` to `src/engine/phdTelemetry.ts`; split the controller into `TutorialState`, `TutorialModal`, `TutorialSpotlight`, and `TutorialCoachmark` (or at least extract the modal renderer).

- **[P3-5] Raw item IDs and misleading grant copy** — `src/engine/sim.worker.ts:1089,1119`, `src/ui/tutorialCurriculum.ts:136,143,168-169,191-192,249,257-258,353-354,375`
  - **Root Cause Mechanism:** The grant handler sets `label: it.itemId` instead of `ITEM_BY_ID[it.itemId]?.name`; the success event always says "Granted tutorial lesson reagents to camp cache" even when the grant added only vessel species/temperature. The plate key is a four-image enum reused across unrelated lessons (e.g., `phd_4_distill` uses `MINES`, `beg_5_salt_skim` uses `TIERS`), so the "3D Survey Plate" often does not illustrate the lesson.
  - **Fix:** Use the item definition's display name; tailor the event message to the grant contents; add a `plateKey`/lesson mapping or captions that explain the plate's relevance.

---

## 3. Existing Test Suite Comparison & Mutation Truth Table

- **Test-to-code file ratio:** `2 / 3` implementation files (`0.67`); **200 test LOC / 1,110 implementation LOC** (`0.18`).
- **Tutorial-specific tests:** **5** (2 in `tutorialSelectors.test.ts`, 3 in `surgicalAuditAndTutorial.test.ts`). The other 7 tests in those files cover campaign, memory-layout, and colony code.
- **Estimated Mutation Kill Score (\(M_{\text{kill}}\)):** **`20%`**.
  - **Basis:** 5 tutorial tests, ~10 assertions; 0 DOM tests, 0 save/restore tests, 0 grant-handler tests, 0 negative predicate tests, 0 `vi.mock` use. The tests kill the lesson-count, field-presence, and grant-presence mutants (4 of 20 sampled mutants); the 15 predicates, 15 dynamic selector targets, grant behaviour, modal lifecycle, focus, and persistence all survive.

| Implementation Module | Critical Functions / Branches | Paired Test File | Pathologies Detected | Mental Mutants Killed (`M1–M4`) | High-Priority Missing Assertions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TutorialController.ts` | `openAcademyModal`, `updateCoachmark`, `applySpotlight`, `checkProgress`, `computeVesselPhdTelemetry` | `surgicalAuditAndTutorial.test.ts` (telemetry only) | Existence-only (`> 0`); no DOM | **1/4** | Modal/focus/stack; coachmark lifecycle; persistence; resize; null snapshot |
| `tutorialCurriculum.ts` | 15 `isComplete` closures; 15 selectors; 15 grants | `tutorialSelectors.test.ts` (truthy + `#id`) | Happy-path only; stringly-typed | **2/4** | Predicate negatives; grant-vs-predicate; species/item registry; tab-target existence |
| `GRANT_TUTORIAL_REAGENTS` | item/species/temp grant handler | **NONE** (only `practiceGrant` presence is checked) | No behaviour tests | **1/4** (presence only) | Unknown item/species; full cache; negative count/mass/moles; temp clamp; success message accuracy |
| Tutorial persistence | save/restore of progress | **NONE** | No tests | **0/4** | Round-trip completed set/active lesson; no cascade/chime on load |
| Tutorial DOM/CSS | modal, spotlight, coachmark, 390px layout | **NONE** | No tests | **0/4** | `role=dialog`, focus trap, Escape, stack size, ring z-order, responsive clipping |

### Why Existing Tests Missed the P1/P2 Defects

- **P1-2:** `tutorialSelectors.test.ts:19-36` extracts only `#id` tokens from each selector and checks they appear in `public/index.html`. The five broken Intermediate selectors are `[data-tab="..."]` attribute selectors with no `#id`, so the test never inspects them. `surgicalAuditAndTutorial.test.ts:99-107` only asserts `lesson.spotlightSelector` is truthy.
- **P1-3:** No test ever applies a `practiceGrant` to a state and evaluates `isComplete`. The suite checks that grants are defined (`:105`) but not what they do.
- **P1-1:** `buildSaveSnapshot()` has no tutorial field, so no save/restore test could pass; no test asserts the absence either.
- **P1-4:** The only "tutorial" tests run in Node without a DOM/CSS; `tutorial.css` is imported but never laid out. z-index and box-shadow cannot be observed in Vitest.
- **P1-5:** The one telemetry test calls `computeVesselPhdTelemetry` directly and asserts `> 0`; it never toggles the checkbox or looks for a rendered readout.
- **P1-6:** No test drives `checkProgress` to the last lesson or inspects the coachmark DOM; the suite only counts 15 lesson objects and checks their fields are truthy.
- **P2-1/P2-2:** The item catalog test (`tests/items.test.ts`) covers recipe/biome IDs and a vessel-only allowlist, but not `TUTORIAL_LESSONS[*].practiceGrant`. The species registry has no test that maps curriculum species IDs.
- **P2-4/P2-5:** No jsdom/browser test exists for the tutorial; the 390px clipping and focus escape are invisible to the current suite.

### Minimal Viable Test Harness (MVTH) Specifications

1. **`tests/tutorialPersistence.test.ts`:** Complete all five Beginner lessons, call `buildSaveSnapshot()`, restore into a new controller, assert `completedLessonIds`, `activeTier`, and `activeLessonId` survive. Reload with a stocked inventory and assert the controller does **not** auto-complete/chime more than the saved progress.
2. **`tests/tutorialSelectors.runtime.test.ts`:** Render the real tab bar and biome panel (or a faithful fixture), and for every lesson call the `onSwitchTab` handler followed by `updateCoachmark`; assert `document.querySelector(lesson.spotlightSelector)` is non-null **and** the ring rect is inside the viewport. This test must fail on the five `[data-tab="explorer"|"workbench"|"strategy"]` selectors.
3. **`tests/tutorialGrants.test.ts`:** For every `practiceGrant`, assert every `itemId` is in `ITEM_BY_ID` (or an explicit `VESSEL_ONLY_IDS` allowlist) and every `speciesId` maps to a registry code. Apply the grant to a synthetic state and assert `isComplete` is false for "practice then perform the action"; allow-list the intentionally instant demo lessons explicitly.
4. **`tests/tutorialPredicates.test.ts`:** Table-driven positives/negatives: `beg_4` with KOH only → false, with `K_STEARATE` → true; `int_3` with copper ingot only → false, with `BRONZE_AXE` → true; `phd_4` with acid/water → false, with a condenser transfer → true; `phd_5` with a sodium item → false, with an electrolysis-produced sodium flag → true; `beg_2` with K2CO3 only → false, with ash + water → true.
5. **`tests/tutorialDom.test.ts`:** Open the modal → assert `role="dialog"`, `aria-modal="true"`, focus inside, Tab trap, Escape closes, focus returns to the HUD button; open the modal with an active spotlight → assert the ring is `display:none` or `z-index < modal`; at 390×844 → assert the right column's `right` ≤ card's `right`; click "Dismiss" → coachmark hidden and persisted.
6. **`tests/phdTelemetry.test.ts`:** 0 K and `NaN` pH produce finite/zero outputs; SID matches the `computePH` strong-ion sum for a known KOH solution; toggling `#chk-phd-telemetry` renders a readout whose text changes with the snapshot.
7. **`tests/tutorialGrantWorker.test.ts`:** Dispatch `GRANT_TUTORIAL_REAGENTS` with an unknown item, an unknown species, a negative count, and a 1e12 mole value; assert the worker rejects (or clamps) and posts an error/success message that matches the actual mutation.

---

## 4. Surgical Refactoring Blueprints (Zero-Mutation Drafts)

### Refactor R1: Persist the tutorial as a first-class save field (P1-1)

**Target:** `src/app/autosave.ts:18-126`, `src/engine/persistence.ts` (schema), `src/ui/TutorialController.ts:30-42`

**Current Pattern:**
```ts
private activeTier: TutorialTierId = 'BEGINNER';
private activeLessonId: string | null = 'beg_1_forage';
private completedLessonIds = new Set<string>();
// buildSaveSnapshot(): no tutorial field
```

**Target Pattern:**
```ts
export interface TutorialSaveState {
  activeTier: TutorialTierId;
  activeLessonId: string | null;
  completedLessonIds: string[];
  phdTelemetryEnabled: boolean;
  coachmarkDismissed: boolean;
}

// TutorialController
snapshot(): TutorialSaveState { ... }
restore(s: TutorialSaveState | undefined): void {
  if (!s) return;
  this.activeTier = s.activeTier;
  this.activeLessonId = s.activeLessonId;
  this.completedLessonIds = new Set(s.completedLessonIds);
  this.phdTelemetryEnabled = s.phdTelemetryEnabled;
  this.coachmarkDismissed = s.coachmarkDismissed;
  this.updateCoachmark();
}

// buildSaveSnapshot()
tutorial: state.tutorial?.snapshot(),
```

### Refactor R2: Make the spotlight contract runtime-validated (P1-2)

**Target:** `src/ui/tutorialCurriculum.ts:162,185,208,231,251`, `src/main.ts:213-217`

**Current Pattern:**
```ts
spotlightSelector: '[data-tab="strategy"]', // actual key is "STRATEGY"
tabTarget: 'explorer',                      // no handler branch
```

**Target Pattern:**
```ts
type TutorialTab = 'explorer' | 'workbench' | 'strategy' | 'council';

const TAB_HANDLERS: Record<TutorialTab, () => void> = {
  explorer: () => { switchTab('REACTIONS'); document.getElementById('biome-panel-container')?.scrollIntoView({ block: 'center' }); },
  workbench: () => switchTab('REACTIONS'),
  strategy: () => switchTab('STRATEGY'),
  council: () => switchTab('JOURNAL'),
};

// Use stable, rendered targets:
spotlightSelector: '#biome-panel-container',
spotlightSelector: '[data-tab="REACTIONS"]',
spotlightSelector: '[data-tab="STRATEGY"]',
```

Also re-run `applySpotlight()` after the tab's render and on `resize`; use `ResizeObserver` on the target.

### Refactor R3: Separate "practice" from "completion" (P1-3 / P2-3)

**Target:** `src/ui/tutorialCurriculum.ts:48-376`

**Current Pattern:**
```ts
practiceGrant: { items: [{ itemId: 'BAR_SOAP', count: 1 }] },
isComplete: (ctx) => ctx.state.inventory.items.some(it => it.id === 'BAR_SOAP'),
```

**Target Pattern:**
```ts
practiceGrant: { items: [{ itemId: 'NACL', count: 2 }, { itemId: 'TALLOW', count: 1 }] },
isComplete: (ctx) => hasSpecies(ctx, 0, SPECIES.NA_STEARATE, 0.05), // the output, not the input
```

Add a `tutorialGrants.test.ts` invariant: `applyGrant(lesson.practiceGrant)` must not satisfy `lesson.isComplete` unless `lesson.demo === true`.

### Refactor R4: Put the scrim below the modal (P1-4)

**Target:** `src/ui/tutorial.css:281-288`, `src/styles.css:925-933`

**Current Pattern:**
```css
.modal-overlay { z-index: 999; }
#tutorial-spotlight-ring {
  z-index: 9000;
  box-shadow: 0 0 0 9999px rgba(10, 8, 6, 0.72);
}
```

**Target Pattern:**
```css
#tutorial-spotlight-ring { z-index: 998; } /* below .modal-overlay */
/* or, when the Academy opens: */
.tutorial-modal-open #tutorial-spotlight-ring { display: none; }
```

`openAcademyModal()` should call `clearSpotlight()`; `closeAcademyModal()` should re-apply the active lesson's spotlight if the coachmark is still visible.

### Refactor R5: Wire the PhD telemetry readout (P1-5)

**Target:** `src/ui/TutorialController.ts:395-434`, `src/ui/tutorialCurriculum.ts:281`

**Target Pattern:**
```ts
// src/engine/phdTelemetry.ts
export function computeVesselPhdTelemetry(vesselIndex: number, snapshot: WorldSnapshot) { ... }

// TutorialController
private renderPhdTelemetry(): void {
  if (!this.phdTelemetryEnabled || !this.phdTelemetryPanelEl) return;
  const t = computeVesselPhdTelemetry(0, state.snapshot);
  this.phdTelemetryPanelEl.textContent =
    `T ${t.tempK.toFixed(1)} K · pH ${t.ph.toFixed(2)} · SID ${t.sidMolL.toFixed(3)} M · k ${t.arrheniusRateK.toExponential(2)} · Q̇ ${t.newtonCoolingWatts.toFixed(0)} W`;
}
```

Call `renderPhdTelemetry()` from the frame loop or `checkProgress` when enabled.

### Refactor R6: Give the coachmark a lifecycle (P1-6)

**Target:** `src/ui/TutorialController.ts:281-328,368-389`

**Target Pattern:**
```ts
type CoachmarkState = 'hidden' | 'active' | 'complete' | 'dismissed';

private setCoachmarkState(s: CoachmarkState): void {
  this.coachmarkEl?.classList.toggle('hidden', s === 'hidden' || s === 'dismissed');
  if (s === 'complete') this.coachmarkEl!.innerHTML = '<div class="coachmark-complete">🎓 Tier complete — open the Field Manual for the next tier.</div>';
}
```

On the last lesson, set `complete`; persist `coachmarkDismissed`; add a "Skip" button that sets `dismissed`.

---

## 5. Phased Execution Roadmap & Scoped Agent Prompts

1. **Phase 1 — Make the tutorial truthful (P1-1, P1-2, P1-3, P1-4, P1-5, P1-6).** Persist progress; fix the five selectors and the `explorer` handler; separate grants from predicates; hide the spotlight under the modal; wire the PhD readout; add a coachmark complete/dismiss state.
2. **Phase 2 — Harden the contracts (P2-1…P2-7).** Validate grants and species IDs; remove phantom item IDs; rewrite proxy predicates; add dialog semantics/focus trap; add the 720px breakpoint; derive teaching numbers from engine constants; wrap `checkProgress`.
3. **Phase 3 — Polish (P3-1…P3-6).** Fix the WCAG claim/badge contrast; optimize the four plates; correct the PhD math; centralize thresholds; fix item labels/messages; add `destroy()` and stack cleanup.

### Copy-Paste Surgical Prompts for Coding Agents

> **Prompt [P1-1] (`src/app/autosave.ts` + `src/ui/TutorialController.ts` + `src/engine/persistence.ts`):**
> "Strictly scope edits to those three files and a new `tests/tutorialPersistence.test.ts`. Add a `tutorial` field to the save schema with `activeTier`, `activeLessonId`, `completedLessonIds`, `phdTelemetryEnabled`, and `coachmarkDismissed`. Serialize it in `buildSaveSnapshot()`, restore it after the controller is constructed, and do not auto-advance restored lessons. Add a round-trip test that completes all five Beginner lessons, saves, restores, and asserts the same active lesson and completed set; require the test to fail on the pre-fix tree."

> **Prompt [P1-2] (`src/ui/tutorialCurriculum.ts` + `src/main.ts` + `src/ui/TutorialController.ts`):**
> "Strictly scope edits to those three files and a new `tests/tutorialSelectors.runtime.test.ts`. Replace the five Intermediate selectors with targets that exist in the rendered DOM (`#biome-panel-container`, `[data-tab="REACTIONS"]`, `[data-tab="STRATEGY"]`), add an exhaustive `TAB_HANDLERS` map including `explorer`, and call `applySpotlight()` after the tab render and on resize. For every lesson, assert `document.querySelector(lesson.spotlightSelector)` is non-null after the handler runs; the test must fail on the current `[data-tab="..."]` selectors."

> **Prompt [P1-3] (`src/ui/tutorialCurriculum.ts` + `src/ui/TutorialController.ts`):**
> "Strictly scope edits to those two files and a new `tests/tutorialGrants.test.ts`. Separate `practiceGrant` from `isComplete`. Rewrite `beg_4` to check `K_STEARATE`/`NA_STEARATE` moles (not any mole), `int_3` to check a bronze item (not copper/tin ingots), `phd_4` to check a condenser transfer (not acid/water possession), and `phd_5` to check electrolysis-produced sodium (not a granted item). Add a table-driven test that applies each grant to a synthetic state and asserts the lesson does not complete unless `demo === true`."

> **Prompt [P1-4] (`src/ui/tutorial.css` + `src/styles.css` + `src/ui/TutorialController.ts`):**
> "Strictly scope edits to those three files and a new `tests/tutorialDom.test.ts`. Put `#tutorial-spotlight-ring` below `.modal-overlay` (z-index 998) or hide it while the Academy is open; call `clearSpotlight()` in `openAcademyModal()` and re-apply it on close. Add a test that opens the modal with an active spotlight and asserts the ring is hidden or has a lower z-index; assert the modal card is not covered by the 9999px shadow."

> **Prompt [P1-5] (`src/ui/TutorialController.ts` + new `src/engine/phdTelemetry.ts`):**
> "Strictly scope edits to those two files and `tests/surgicalAuditAndTutorial.test.ts`. Move `computeVesselPhdTelemetry` into `src/engine/phdTelemetry.ts`, fix the 0 K clamp and `NaN` pH, and render a telemetry panel when `#chk-phd-telemetry` is checked. Add a DOM test that toggles the checkbox and asserts the rendered text includes the current temp/pH/SID."

> **Prompt [P1-6] (`src/ui/TutorialController.ts`):**
> "Strictly scope edits to that file and `tests/tutorialDom.test.ts`. Add a coachmark lifecycle (`active`/`complete`/`dismissed`). On the last lesson of a tier, replace the step hint with a 'Tier complete' state and a 'Next tier' / 'Dismiss' action; persist `coachmarkDismissed`. Add a test that completes Step 5 and asserts the coachmark is either hidden or shows a completion state, not the old Step 5 grant button."

---

## 6. Verification Commands & Zero-Mutation Proof

### Commands run

```bash
git rev-parse HEAD                                  # e321c65
git diff -- src/ui/TutorialController.ts \
           src/ui/tutorialCurriculum.ts \
           src/ui/tutorial.css \
           src/main.ts src/app/autosave.ts          # empty — tutorial source unchanged
npx tsc --noEmit                                    # RED: 4 errors in the unrelated untracked test
npx vitest run tests/tutorialSelectors.test.ts \
               tests/surgicalAuditAndTutorial.test.ts  # 12/12 pass (5 tutorial-specific)
npx vitest run                                      # 1 failed / 320 (unrelated untracked test)
npm run build                                       # 4 errors from the unrelated untracked test
```

### Live runtime probe (production `dist`, Chromium 156 headless)

The dev server cannot boot the app because its development bundle uses `eval` and the page's CSP forbids `unsafe-eval` (a pre-existing dev-mode issue, noted only to explain the probe method); the probe therefore served the production `dist` (built 18:15) with COOP/COEP headers and drove the onboarding with CDP.

| Probe | Setup | Measured result |
| :--- | :--- | :--- |
| Boot spotlight | 1280×600, after onboarding | Coachmark `display:flex`; ring `display:block`, `z-index:9000`, `box-shadow: rgba(10,8,6,0.72) 0 0 0 9999px`; ring rect `(37.6, 189.5, 263.6×459.3)` around the TREES category |
| Academy open | click `#btn-open-tutorial` | Modal `z-index:999`, card `960×540` at `(160,30)`; ring still `display:block` at `z-index:9000`; `document.activeElement` = `BODY`; screenshot shows the modal dimmed to ~28% brightness |
| Intermediate guide | `int_1`, `int_3`, `int_4` → Guided Spotlight | Ring `display:none` for all three; `int_4` switches to "Strategy & Labor" but still no ring |
| Grant cascade | Beginner coachmark | `beg_1` grant → Step 2; `beg_2` grant → stays Step 2 (pH 7.00); `beg_3` grant → **Step 5** (skips Step 4); `beg_5` grant → stays Step 5, coachmark never hides |
| Persistence | reach Step 5, wait for save, reload, Continue | Save keys contain **no `tutorial` field**; coachmark returns to **Step 2** (restored inventory re-completes Step 1) |
| Mobile layout | 390×844, Academy open | Card `370.5×759.6`; right column `143.3` wide, right edge `400.1` > viewport `390`, clipped by `.modal-card { overflow:hidden }`; coachmark `290.6×164` at the bottom |

The runtime console also shows the **unrelated P1-10** `REQUEST_SYNC` null-slot `TypeError` (`Cannot read properties of null (reading 'active'/'slot')`) because the probe used the 18:15 `dist`, which predates the working tree's in-flight fix. It is not counted in this tutorial score.

### Zero-mutation proof

- **Pre-audit working tree:** `M src/app/workerMessages.ts` (user's P1-10 fix), `?? tests/requestSyncNullSlot.test.ts` (user's test), `?? docs/plans/OPTIONAL implementation_plan.md` (pre-existing).
- **Post-audit working tree:** the same three paths; this report was added as a docs-only commit. No source, config, or test file was created, edited, formatted, or deleted by this audit. The tutorial files have `git diff` empty.
- **Report commit:** this file only.

### Why the repo-wide gates are red (not a tutorial finding)

`tests/requestSyncNullSlot.test.ts` calls `handleWorkerMessage({ data: ... } as MessageEvent, ...)`, but the function signature is `handleWorkerMessage(data: WorkerMessage, options?)`. The test passes a `MessageEvent` wrapper, so the handler reads `data.type === undefined` and the test's `expect(state.completedRequestsCount).toBe(1)` fails. The same four `MessageEvent` arguments fail `tsc` and the webpack typecheck. This is an in-flight user test, outside the tutorial scope; it is recorded here so the tutorial's green result is not mistaken for a repo-wide green gate.

---

## 7. Reviewer's Bottom Line

The tutorial is not a small polish gap; it is a broken onboarding contract. The five highest-value fixes, in order:

1. **Persist tutorial progress** so reloads stop resetting and re-firing the curriculum.
2. **Fix the five Intermediate spotlight selectors** and the missing `explorer` tab handler; the entire tier's guidance currently does nothing.
3. **Separate practice grants from completion predicates**; today 10/15 lessons complete themselves, and Step 3's grant skips Step 4 entirely.
4. **Put the spotlight scrim below the Academy modal**; the 9,999px shadow currently dims the tutorial's own UI to 28% brightness.
5. **Wire or remove the PhD Telemetry Overlay**; Tier III explicitly instructs the player to read a panel that does not exist.

After those, fix the grant/species registry mismatches and phantom item IDs, then the a11y/responsive gaps and the content drift. Re-run this audit after the fixes; the tutorial should not ship with a 24/100 scoped score.
