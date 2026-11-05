# The Engagement Spine — Addendum to the Civ VII 4X Conversion Plan (v8)

**Date:** 2026-11-05 · **Status:** Addendum (companion to `docs/plans/2026-11-05-civ7-4x-conversion-plan.md` v8) · **Scope:** gameplay engagement, onboarding depth, retention cadence, systems interplay — nothing else · **License to act:** user approved Option B (companion addendum) 2026-11-05 · **Implementation gate:** explicit sign-off, same as v8. Nothing here authorizes code.

> **Precedence rule.** Where this addendum and v8 overlap, this addendum wins **only** on the elements it names (ES-1..ES-3, milestone timing of Dispatches/tutorial/colony-coupling, engagement gates, engagement-scoped cut ladder rows). On all other matters v8 remains the authority. v8 is intentionally **not edited** by this addendum — the two documents are kept in sync by editing both in the same commit whenever either changes. If they silently diverge, this addendum is the one marked as stale and corrected first.

---

## 1. Why this addendum exists (diagnosis, condensed)

v8 is the strongest *spec* in the repo — but as a *plan* it has four engagement defects, each verified against v8 text:

1. **The retention engine is scheduled too late.** The only daily-cadence mechanic that makes a player return tomorrow — Dispatches from the Crown (`mandates.ts` revival, D7) — is locked inside **M6** (§6.18.4). That is ~10+ person-weeks from the first playable minute. The daily loop will not be tuned or measured until the pacing is set in stone.
2. **Onboarding is remedial, not designed.** Tutorial integrity (§6.26) is scoped as "never glitch" — selector law, idempotency, coverage. Necessary, but it is *repair*, not a **first-session hook**. Nothing in v8 replaces the static lecture-tier tutorial (`TutorialController.ts` + `tutorialCurriculum.ts`, zero worker bindings) with played actions.
3. **The strongest systemic interplay is excluded by fiat.** §5 lists `colony.ts` as untouchable, so colony labor never touches vessels, batch quality, or the Soap Kettle mini-game — the two halves of the game the player actually *operates* are wired in the parallel-track configuration we already know bounces attention.
4. **No engagement acceptance criteria.** The M2 kill-gate (§9/§12) measures *completion* ("reach The Turning in 45 min") and *comprehension* ("what did your chemistry change?"), neither of which measures the two things a commercial-adjacent game lives or dies on: moment-to-moment pull (does the bench hold 60 s of hands-on focus?) and return pull ("would you boot it tomorrow?").

A fifth issue is structural: **the five user mandates of 2026-11-05 are ranked nowhere.** Excitement-per-mandate was never compared against engagement-per-week, so the plan can spend its scarcest resource (your attention) on spectacle before the spine is proven.

---

## 2. Design principles (engagement invariants)

- **ES-P1 — The chemistry web stays the whole web.** No engagement mechanism may introduce a currency, meter, or action that does not trace through a vessel or a colonist's hands. Engagement decorates the loop; it never competes with it.
- **ES-P2 — Every session has a reason to return.** Short, concrete, always-visible, never-punitive: something the player wants to check tomorrow. (This is what ES-2 buys.)
- **ES-P3 — Legible causality.** The player must always be able to say *why* something happened, in one sentence, using nouns the game taught them. (Recap ledger, estate deltas with named causes — already v8's standard for estates; ES-1/ES-3 extend it to the bench and the camp.)
- **ES-P4 — Onboarding is gameplay.** No tutorial text the player cannot act on; every beat auto-advances on a real game event via the existing objective-sensor pattern (`progression.ts` `hasSpecies` / `hasItem` / `hasFabricated`).
- **ES-P5 — Zero new constraints.** No new runtime deps; SAB stays 67,648 B; entrypoint ≤ 200,000 B; seeded determinism everywhere the sim consumes; all interactive targets ≥ 24 px; `prefers-reduced-motion` honored. ES-1/ES-2/ES-3 each satisfy this by construction (§5).
- **ES-P6 — Gates measure fun, not only completion.** Every engagement claim in this addendum ships with a measurement, run before the budget is spent (§7).

---

## 3. The player journey map (the artifact v8 never drew)

One page, every beat, with the observable marker and the gate that owns it. **Targets are playtest hypotheses, not entitlements** — they are calibrated at M2.

| Beat | What the player does | Observable marker (how we know) | Gate |
|---|---|---|---|
| **0. Boot** | Splash → New Chronicle → **Choose Your Country** (v8 §6.18.0) | Title-to-select in ≤ 60 s in rehearsed builds | M2 |
| **1. The Heap** | Mud-port cold open; the five-patron matrix is *implicit* — first artifact crafted picks the patron (v8 §6.22) | First artifact made ≤ 5 min median (new-M2 metric) | **M0.5 / M2** |
| **2. First Batch** | Gather wood → run Soap Kettle mini-game → salting-out | **Time-to-first-batch ≤ 5 min median** (ES-1) | **M0.5 / M2 kill-gate row e** |
| **3. First Hire** | Recruit one colonist; assign to node | First `HIRE` ≤ 10 min | M2 |
| **4. The Desk** | First **Crown's Ledger** dispatch lands (ES-2); one is completable now | First directive accepted/fulfilled ≤ 15 min | **M0.5 / M2** |
| **5. The Wasting stirs** | First crisis telegraph (Dawn Report) | Telegraph seen before first death | M2 (v8) |
| **6. The Turning** | Age I → II transition | v8 kill-gate row (b): 2/3 players reach unprompted ≤ 45 min | M2 (v8, amended §7) |
| **7. Return pull** | Day 1 ends; player re-boots for the Ledger's next cycle | **≥ 2/3 playtesters say yes to "would you play tomorrow?"** (row f) | **M2 kill-gate row f** |
| **8. Endgame** | Victory / deposal / abdication | v8 M8 QA (all endings reproducible) | M8 |

**Instrumentation honesty note:** §13 of v8 forbids telemetry/analytics. All markers above are captured by (a) deterministic replay in the soak harness for time-to-first-batch, (b) observer checklists in the structured playtest form (§12 of v8), never by in-game beacons.

---

## 4. The Engagement Spine — milestone **M0.5** (new; lands after M0, before M1)

Named M0.5 deliberately: it is *not* a campaign system; it is the two weeks of work that make every later milestone playtestable in a meaningful way.

### ES-1 — Guided First Batch (Rec 1, promoted from audit §1.3/§1.2 findings)

**Problem.** The tutorial is static lecture modal + images with zero bindings to worker state; the tick-0 screen shows ~85 buttons/~140 labels. Players face a wall, then a void.

**Design.** Replace `TutorialTier` lecture content with a **3-beat guided arc**, auto-advancing on real events:

1. **Stoke** — "Gather two softwood logs." Advances on harvest event with `speciesId` in the timber set (reuse `biomeNodes.ts` tags; no new data).
2. **Render** — "Run your first kettle." Advances on `SoapKettleMiniGame.onBatchComplete` (any quality).
3. **Deliver** — "Fulfill any Town Request." Advances on `timedRequests` fulfillment (existing engine).

**Mechanics.**
- Reuse the objective-sensor architecture (`progression.ts` sensors are already event-driven; add `progression.sensors` cases `tutorial_stoke` / `tutorial_render` / `tutorial_deliver`, or a thin `tutorialSensors.ts` mirror — implementer's choice at plan time, either is dependency-clean).
- **Progressive reveal:** each beat marks one panel `.tutorial-focus` (brass ring pulse) and dims the rest to 55 % opacity via one CSS class; panels outside the beat keep their bindings (nothing is disabled — nothing soft-locks).
- **Coachmark positioning:** `position: fixed` + `getBoundingClientRect` on rAF (per v8 §6.26 law 3 — no scroll handlers); coarse pointers and `prefers-reduced-motion` get a static ring.
- **Skip is legal and total** (v8 §6.26 preserved): the Academy button remains forever; skipping persists.
- **25-path matrix preserved:** country × first-craft variants remain content; ES-1 only changes *how* a step is presented, never *which* paths exist. `tests/tutorialSelectors.test.ts` (v8 §6.26 law 2) applies unchanged to ES-1 hooks.

**What is deleted.** The four lecture tiers' blocking modal flow. (The petrology/stoichiometry *images* survive as optional compendium entries — science you can seek, not a toll you must pay.)

**Effort:** 3–4 days including tests. **Risk:** low-medium (UI shell + event sensors; no engine changes). **Owns:** Journey beats 1–2; amended M2 kill-gate rows e.

### ES-2 — The Crown's Ledger v1 (Rec 3, pulled forward from v8 §6.18.4 / M6 → M0.5 skeleton + M2 turn-clocked completion)

**Problem.** Retention cadence (a reason to check in tomorrow) is absent until M6. v8 already authored the right system — `mandates.ts` (72 h timers, renown rewards, D7 "revive as Dispatches") — and scheduled it four milestones too far out.

**Design.** Two-stage landing:

- **M0.5 (v1, tick-clocked):** Revive `mandates.ts` as **Dispatches from the Crown — the Day's Ledger**, rendering three rotating short directives in the Journal's "Dispatcher's Desk" tab. v1 cadence aligns to the *existing* `timedRequests` tick scheduler (no turn clock yet). Content: 1 craft (deliver X by day N), 1 care (treat/feed/dose a named cohort), 1 civic (fulfill any urgent request) — exactly the three-family rotation. Rewards: small renown (+10..20), affinity-weighted (+1 soapwright/apothecary/forgewright), and on all-three completion a **"Day Well Spent"** event: +6 morale to all colonists and a named recap line. Failure expires silently with a telegraph-ticker note (never punitive, v8 §6.18.4 semantics preserved). Determinism via seeded RNG only; `mandates` state persisted in save v2 **with the v3 migration in M1** (D5 territory — do not half-migrate).
- **M2 (v2, turn-clocked):** Re-clocked to `DAY_TICKS` / turns per v8 §6.16 (2–3 concurrent, age-tiered flavor: Age I soap/clothing, II guards/tonics, III penicillin). The M0.5 tick cadence is the migration vehicle, not the destination. At this point ES-2 *is* v8 §6.18.4; M6's scope row **loses** the "Dispatches (D7)" item (single-source; recorded in §6.18.4 amendment note here rather than by editing v8 — see §8 amendment register).

**State shape (sketch, for plan-time expansion):** `ledger: { day: number; slots: LedgerSlot[3]; streak: number; bestStreak: number }` inside save v3 `campaign` namespace; slots carry `{ id, family, text, deadlineDay, rewardRenown, rewardAffinity, status }`.

**Effort:** 2–4 days (M0.5 v1) + ~1 day re-clock in M2. **Risk:** low (engine exists and is test-covered by `tests/telegraphAndMandates.test.ts`; the work is wiring + content table). **Owns:** Journey beat 4; M2 return-pull gate (row f).

### ES-3 — Colony ↔ Chemistry coupling (Rec 2, behind a flag; M2 default-on in playtest, M4 permanent)

**Problem v8 records but does not solve.** §5 keeps `colony.ts` untouched; colony outcomes never reach the bench. The player's *other* hands (morale, wages, stimulants, strikes) are narratively rich and mechanically inert where it matters — at the flask.

**Design.** Three couplings, implemented as **crisis-style effect-vocabulary read-points** (extend `crisis.ts` vocabulary patterns; never fork the colony sim):

1. **Labor → quality.** An `APPRENTICE_CHEMIST` assigned to a vessel raises mini-game stability: trace target strokes 12 → 9, and Phase-2 saponification band 80–95 °C → 78–96 °C. Unstaffed = baseline. (Surfaced as "⚗ Apprentice tending the kettle" on the vessel card — ES-P3.)
2. **Unrest → spoilage.** Mean camp morale < 40, or any colonist in `STRIKE`, adds a per-batch seed `roll` for one step of spoilage (pour gauge drift, bowl scald, trace stall) and +1 `roll` severity on vessel-rupture crises. Strikes are now *visibly* costly at the bench — the game explains itself.
3. **Crash → clumsiness.** A colonist in stimulant `CRASH` phase assigned to a vessel tightens Phase-1 pour-tolerance band by 4 % and Phase-2 band by 4 °C. Boost→crash is a staffing decision, not a status garnish.

**Guardrails (non-negotiable).**
- `colony.ts` is **extended, never rewritten** — v8 §5's invariant is amended to read: *"colony labor loop semantics preserved; effects reach it only through the crisis-style vocabulary and `COLONY_SYNC`, exactly as today."*
- Flag: `featureFlags.colonyChemistryLink` in the save's campaign namespace; **off by default in M0.5 builds, on in all M2 playtest builds, permanent from M4** once the economy soak asserts net-yield bands (v8 §12 balance-bands risk row) pass with it enabled.
- Every effect is a seeded `roll` (determinism invariant §2.3.9 of v8 holds); all three couplings are unit-testable headlessly; the three player-facing readout lines reuse the timed-requests card styling (no new CSS surface).

**Effort:** 3–5 days including a balance harness pass (`colony.test.ts`-adjacent). **Risk:** medium (balance, not architecture). **Owns:** Journey beats 2, 4–6 depth; the "systems interplay" pillar.

### M0.5 gate (all must pass)

```
vitest green · tsc --noEmit 0 · npm run build ≤ 200 000 B
ES-1: scripted first 3 beats advance headlessly · tutorial-selectors test green on ES-1 hooks
ES-2: ledger spawn cadence deterministic (seeded replay ×2, byte-identical) · 3-family rotation asserted · save round-trip clean in v2 with ledger (pre-M1 migration proof)
ES-3: couplings behind flag; determinism replay green · flag off ⇒ bit-identical behavior to M0
CI lint HIGH = 0 · offline reload smoke · SW unchanged (no shell assets change → no cache bump; verified, then recorded)
```

**M0.5 effort:** ~1–1.5 weeks (down from "two weeks" pessimism above; ES-1 3–4d + ES-2 2–4d + ES-3 behind flag 3–5d, overlapping).

---

## 5. Milestone integration — what changes WHERE (v8 untouched; deltas recorded here)

| v8 milestone | Addendum change |
|---|---|
| **M0** | Unchanged. (Addendum lands as docs-only after M0 sign-off, or alongside it.) |
| — | **NEW M0.5** — ES-1, ES-2 v1, ES-3 flag skeleton, save-v2 ledger proof. Gate per §4. |
| **M1** | Unchanged scope. **Addendum addition:** engine spine gains the `ledger` namespace in save v3 (folds into the v2→v3 migration; D5/D6 classes of bug must not recur for ledger). 60-turn soak records **time-to-first-batch** as a replayable metric, not a feel. |
| **M2** | Kill-gate **amended** — v8 rows (a)–(d) retained verbatim; **add (e) time-to-first-batch ≤ 5 min median · (f) ≥ 2/3 playtesters answer yes to "would you boot this tomorrow?" · (g) a 60-second hands-on bench observation (observer checklist: ≥ 2 of 3 playtesters engage with 2+ mini-game phases unprompted).** ES-2 re-clocked to turns. ES-3 default-ON in playtest builds. First-session funnel now instrumented end-to-end (Journey beats 1–7). |
| **M4** | ES-3 goes permanent (flag retired or hard-defaulted) **after** economy soak asserts age-band net yields with coupling on. |
| **M6** | **Remove** "Dispatches (D7, §6.18.4)" from M6 scope (single-sourced to M0.5/M2). M6 keeps Influence, Harbour, hands-ladder tiers, bounty/board systems. (If v8 is ever re-issued as v9, fold this row in and bump M6's estimate down by ~2 days.) |
| **M7 / M8** | No changes. M8 QA gains one row: deposal/victory endings × the Ledger streak present in save-as-museum export (flat check, no new systems). |

**Sequencing rationale.** ES-1/ES-2 are cheap and bound every later milestone's playtest value; ES-3 is deliberately the only risk item and is flag-fenced. Nothing in M0.5 exceeds v8's invariants.

---

## 6. The five 2026-11-05 mandates, ranked by engagement-per-week (not excitement-per-mandate)

Person-week costs are v8's own §9 numbers; engagement pull is judged against Journey beats 1–7.

| Tier | Mandate (v8 ref) | Engagement-per-week verdict | Disposition |
|---|---|---|---|
| **S** | (iv) The First Commission — jobless start, patron arc, 25-path matrix | The single strongest first-30-minutes hook; converts spectators to stewards | **Keep, protected.** ES-1 rides on its beat 1. |
| **S** | (ii) The Five Countries + Lab→Release→Consequence + the Three Estates | The stakes frame; converts mechanics into meaning; powers ES-2 content | **Keep.** Estate visibility is the "why turn the page" engine. |
| **A** | (i) Chemistry-first turns (§6.16/§6.17) + The Country frame | Turns the flask, not the calendar, into the session rhythm | **Keep.** ES-2 v2 depends on it in M2. |
| **A** | (iii) The Realm's Hands + Built Realm + Grand Ledger | Labor market + "everything touches everything"; ES-3 is its bench-level proof | **Keep, with one subtraction:** the Grand Ledger's *interlock* is usually the first place spectacle outruns play; M2 playtest answers it before M7 corpus spending. |
| **B** | (v) Codex/Exchange · P2P windows · Influence window · Missions · Built Works | High spectacle, low return-pull; Exchange is a treadmill with zero bench intimacy | **Demote strictly behind M2 kill-gate.** Cut order (v8 §9, extended): M6 slip >25 % ⇒ Missions → the Codex Exchange → P2P negotiation windows. Built Works holds only as Sewer Outfall + rope (health + haul, both ES-P2-adjacent); the rest folds to M9. |

**Rule minted here:** no mandate may preempt the Engagement Spine. M0.5 is not negotiable against any (i)–(v) item.

---

## 7. Amended gates (drop-in text for v8 §9/§12 — to be folded into any future v9)

**M2 kill-gate (amended):**
```
(a) heap→first-patron reveal ≤ 20 s on 2 of 3 recorded first-time runs          [v8, unchanged]
(b) ≥ 2 of 3 first-time players reach The Turning unprompted in 45 min         [v8, unchanged]
(c) ≥ 2 of 3 answer "what did your chemistry change about the country?"        [v8, unchanged]
(d) zero progression blockers found in playtest                                [v8, unchanged]
(e) time-to-first-batch ≤ 5 min median across 3 recorded runs                  [NEW — ES-1]
(f) ≥ 2 of 3 first-time players answer yes to "would you boot this tomorrow?"  [NEW — ES-2]
(g) ≥ 2 of 3 engage ≥ 2 Soap Kettle phases unprompted in a 60 s observation    [NEW — ES-1/ES-3]
Any of (e)/(f)/(g) red ⇒ halt, diagnose, thin-skin M2; the halt rule and no-self-grading
clause of v8 §12 apply identically. (e)–(g) are NOT waived by passing (a)–(d).
```

**Playtest form additions (v8 §12 playtester rows):** two Likert rows ("I understood why my last action mattered" · "I know what I'd do next session"), one free-text ("what almost made you quit?"). Chemistry-naïve tester is mandatory for rows (e)/(g).

**M4 gate addition:** economy soak runs **twice** — ES-3 coupling OFF (regression) and ON (bands). Bands from v8 §12 unchanged; ON-run must land inside them or ES-3 does not go permanent.

---

## 8. Amendment register (v8 sections superseded or annotated by this addendum)

| v8 ref | v8 text (essence) | Addendum action |
|---|---|---|
| §5 invariants — "colony labor loop unchanged" | Hard freeze on colony semantics | **Amended** to extension-via-vocabulary (§ ES-3). Semantics preserved; integration added behind flag. |
| §6.18.4 Dispatches — "revive D7", located M6 | Retention engine in M6 | **Relocated**: M0.5 v1 (tick) → M2 v2 (turn-clocked). M6 scope loses it (§5 table). |
| §6.26 Tutorial integrity | Repair of existing lessons | **Extended** by ES-1: the tutorial is rebuilt as played actions; integrity contract still applies verbatim. |
| §9 M2 kill-gate | rows (a)–(d) | **Rows (e)–(g) added** (§7). Halt semantics unchanged. |
| §9 parallelism policy | M1+M2 vs M3 tracks | **M0.5 added as a third, smallest track**; may overlap M0 docs work; never edits `sim.worker.ts`/`app/state.ts` (same merge-magnet rule). |
| §12 risks — scope realism | Halt on kill-gate red | **No change to (a)–(d)**; (e)–(g) join the same halt rule. New row: *Engagement-spine fatigue* — three Ledger directives maximum per day, forever; if playtest shows chore-feel, families collapse to two and streak display goes quiet (never removed — ES-P2 must hold silently). |
| §10 decision gates | Q1–Q6 status | **No new gates minted.** Q1/Q3 remain 🔒 LOCKED; Q2/Q4/Q5/Q6 remain time-boxed to 2026-11-07 veto as in v8. ES-3's flag is a build toggle, not a decision gate. |
| §13 scope-outs | (localization, mods, etc.) | **No change.** Ledger strings live in `src/data/` like everything else. |

---

## 9. Effort & calendar honesty

- **Net new effort:** ~1–1.5 weeks (M0.5), of which ES-3's balance pass is the only schedule risk.
- **Net saved effort:** ~2–3 person-weeks *of waste* expected, because ES-1/ES-2 convert the M2 kill-gate from a leap of faith into an instrumented checkpoint — the single most reliable way the plan finds its halt row early, which v8 itself calls "the cheapest possible failure."
- **Total estimate unchanged:** 23–34 person-weeks P50. What moves is *order* — engagement spends first, spectacle later. The cut ladder (v8 §9, with §6's extension) governs slips exactly as before; **M0.5 and ES-1/ES-2 are uncuttable** (they are, by definition, the kill-gate's instruments).

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Ledger becomes a chore list** (ES-P2 inverted) | Max 3 slots/day forever; families rotate, never repeat consecutively; zero expiry penalties beyond morale −4 (v8 semantics); streaks celebrate silently (one recap line) |
| **ES-1 breaks the 25-path matrix** | ES-1 contains no content; only presentation + sensors; 25-path suite (v8 §6.26 law 4) untouched and re-run |
| **ES-3 destabilizes the economy** | Flag OFF by default until M2 playtest; M4 permanence gated on ON-run bands; any negative morale-compounding observed ⇒ couplings 2 and 3 soften (−50 % severity) before any removal discussion |
| **Two-document drift** (v8 ↔ addendum) | Both edited in the same commit; addendum header carries the pointer; if they diverge, addendum is corrected first (see the precedence rule in the header) |
| **Scope smuggling** ("since we're here…") | Any addition to M0.5 requires an explicit user sign-off entry at the bottom of this file — the exit criteria for M0.5 are frozen |
| **Playtest humans never recruited** (v8 §12 row) | ES-2 exists *because* of this risk class: even self-playtesting across four sessions yields the (f) signal; recruit during M1 as v8 already mandates |

---

## 11. What this addendum deliberately does not do

- Does not implement anything (sign-off gates implementation, as in v8).
- Does not edit v8 (single source of audit truth; §8 register is the merge surface).
- Does not mint new decision gates, currencies, or save fields outside `campaign.ledger`.
- Does not touch the hex map, the worker spine, SAB, or the bundle budget.
- Does not answer naming ("Alchemist's Empire" stays placeholder), localization, mods, screen-reader map parity, telemetry — all remain v8 §13 verbatim.

---

## 12. Approval block

- [ ] User approves **M0.5** as a milestone (gate per §4) — implementation starts on this checkbox.
- [ ] User approves **M2 kill-gate amendment rows (e),(f),(g)** — effective immediately for M2 planning.
- [ ] User approves **M6 scope subtraction** (Dispatches single-sourced to M0.5/M2).
- [ ] User approves **ES-3 flag policy** (off in M0.5 → on in M2 playtests → permanent post-M4 bands).
- [ ] User approves **engagement-tier ranking** (§6) as the M6/M7 cut-ladder tiebreaker.

*Prepared 2026-11-05 under the plastic-surgery protocol as a companion to v8; no code, no spec files elsewhere, no v8 edits. This addendum becomes part of the plan set on user sign-off.*
