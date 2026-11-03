# Surgical Audit Report: How2Soap — Emergent Chemistry & Survival Engine

| Audit Metadata | Specification |
| :--- | :--- |
| **Audit Date** | 2026-11-03 |
| **Audited Scope** | `src/`, `tests/`, `scripts/`, `public/`, `webpack.config.js`, `vercel.json`, `docs/plans/*` (25 src files + 16 test files + 1 tool script; **5,975 effective LOC** scanned) |
| **Tech Stack & Runtime** | TypeScript 5.4 (strict), Webpack 5, Vitest 3, Zero-copy `SharedArrayBuffer` + `SeqLock`, 10 Hz Web Worker sim, 60 FPS render, COOP/COEP cross-origin isolation, Vercel static host |
| **In-Flight Agent Baseline** | HEAD `6aecf5c` at audit start (Grand Crucible Tasks 1–3 landed). Working tree carried uncommitted **Task 4 WIP**; the agent committed it mid-audit as `1db8af8` (+ plan back-port `839151a`), both touching only harvest engine/tests/plan docs — zero overlap with audited or splash files. Task 4 review in §6. |
| **Pre/Post Audit state** | `tree_integrity_sha256` pre `07dcd493d3bdf703…` (patched preflight, see Appendix). **Zero tracked source/config/test files modified.** The only new file is this report. |
| **Deterministic Health Score** | **`78 / 100`** (`D_raw = 40`, `P_test = 6.0`, `M_kill ≈ 60%`, `LOC_eff = 5975`, `sqrt(1000/max(500, LOC)) = 0.409`) |
| **Vibe-Debt Risk Level** | **`MODERATE`** (65 ≤ S < 85, N_P0 = 0) |

---

## The Three Recommendations (headline)

> The user asked for three recommendations from a full-codebase review. Everything else in this report is the evidence behind them.

**R1 — Fix the two P1s before the Grand Crucible stack lands on top of them (≈ 1 focused day).**
`readSnapshot()` throwing kills the entire `requestAnimationFrame` chain permanently — the game freezes with no error surfaced (P1-1). And the save **Import** button reports success while restoring *nothing* — fake-success UI on a machine that saves real data (P1-2). Every task in the in-flight plan (Tasks 5–15) will add load-bearing UI on top of this exact loop; a freeze or a lying restore is inherited by all of it.

**R2 — Test the spine the suite skips: `world.ts` and `sim.worker.ts`, plus one escaping helper.**
16 suites cover chemistry, fabrication, metabolism, persistence — but **zero** test imports `src/engine/world.ts` (the vessel-stepping orchestrator) or `sim.worker.ts` (the command bridge). That is the gap through which silent command drops (`EQUIP_TOOL`, `HARVEST_PART` have union members and *no handlers*) and the P1-1 freeze both live undetected. A `stepWorld`/`syncWorldToShared` round-trip test and a worker command-dispatch test close the gap; add `escapeHtml` (or switch log/quest rendering to `textContent`) to retire the XSS pattern class while the tree is small.

**R3 — Ship one honesty pass over the visible UI before any new feature scope.**
Today the UI advertises controls that do nothing: three volume sliders and a "WebAudio API" block with no `AudioContext` in the codebase, a "Reduced Motion" toggle with no CSS rule behind it (the only reduced-motion rule in the repo is my splash hint), an Import button that lies, a paddock system that renders but never steps (`stepPaddockDay` is called nowhere), and worker commands that fail silently to `default: break`. Wiring or deleting each visible control is worth more to the "is this game real or a demo" verdict than any new system. The Grand Crucible plan (Tasks 10–13) fixes *most* of this — R3 is: land those tasks, or strip the placebo controls, and do it before Task 15 scope creeps.

---

## 1. Executive Architecture & Vibe-Debt Triage

The architecture is genuinely good where it counts: a zero-copy `SharedArrayBuffer` with a correct `SeqLock` (odd/even counter, pre/post copies), a 10 Hz deterministic worker isolated from the 60 FPS UI, seeded `mulberry32` RNG for worker determinism, an append-only species index contract, a real thermodynamics engine (calorimetry, phase-clamp boiling, electroneutrality pH, Faraday electrolysis) that is well-tested at unit level, and CI (`tsc --noEmit` + Vitest + production build) on every push. The dominant failure mode is **not math — it is wiring honesty**: engines are complete and tested, but the seams between engine, worker, persistence and UI are either silent no-ops, placebo controls, or doc-vs-code claims ("SHA-256 integrity", "IndexedDB") that don't exist. Second failure mode: **all error paths funnel into one `requestAnimationFrame` chain with no guard**, so any throw is a permanent freeze. Third: the story/progression layer (Grand Crucible) is planned with unusual rigor but only 3 of 15 tasks are implemented; the game is currently a chemistry sandbox with no narrative onboarding.

| Severity Tier | Count | Deduction Weight | Primary Failure Domains |
| :--- | :--- | :--- | :--- |
| **P0 — Critical** | **0** | `-18 ea` | — |
| **P1 — High** | **2** | `-8 ea` | Frame-loop liveness (`src/main.ts:494`), Save Import fake success (`src/main.ts:575-577`) |
| **P2 — Medium** | **6** | `-3 ea` | XSS pattern class (`src/main.ts:303,381,410,423`), doc-vs-code integrity gap (`src/engine/persistence.ts:5-10`), untested orchestration spine (`world.ts`, `sim.worker.ts`), placebo settings UI (`src/ui/MenuController.ts:51-65,198-201`), God file + unbounded log (`src/main.ts`), silent worker command drops (`src/engine/sim.worker.ts:40-62,245-247`) |
| **P3 — Low** | **6** | `-1 ea` | Naming drift (How2Soap/Chemistry Survival/Grand Crucible), deprecated `escape/unescape` (`persistence.ts:57,73`), modal a11y (`MenuController.ts` — no `role=dialog`/`aria-modal`, no ESC, no focus trap), `PLAYER_SYNC`/`EQUIP_TOOL` `any` escapes, `state.log` unbounded retention, paddock dead simulation (`husbandry.ts:98` uncalled) |

### High-Risk File Telemetry Hotspots
| File Path | Eff. LOC | CC / BranchDensity | Silent Catches | Primary Vibe-Debt Signature |
| :--- | :--- | :--- | :--- | :--- |
| `src/main.ts` | 614 | 0.031 (flat but wide) | 0 | God file: state + render + worker wiring + quest + paddock + settings |
| `src/data/speciesRegistry.ts` | 538 | 0.000 | 0 | Declarative data table (fine; low risk) |
| `src/engine/fabrication.ts` | 509 | 0.000 | 0 | Recipe/rules engine, big but uniform; branchless tables |
| `src/data/biomeNodes.ts` | 487 | 0.000 | 0 | Declarative DAG (fine) |
| `src/engine/chemistry.ts` | 349–412 | 0.089 | 0 | The physics core; best-tested engine module |
| `src/engine/sim.worker.ts` | 234 | 0.145 | 0 | Command bridge; handlers missing for 2 declared commands |
| `scripts/make-splash/make_splash.py` | 576 | 0.071 | 0 | My own tool script (non-shipping); `paste`-mask bug already caught in review |

---

## 2. The 10-Principal-Engineer Deep Audit

### Lens 1 — Systems Architect (Topology, Coupling & State Machines)
- **[P2-5] God file** — `src/main.ts:86-624`. One module owns DOM template, worker lifecycle, vessel/quest/paddock rendering, tab routing, settings wiring and the rAF loop. Every in-flight plan task (5–14) will extend this file; it has no seams. *Fix:* extract `src/app/` modules (`renderQuest.ts`, `vesselsView.ts`, `paddockView.ts`) as pure-ish renderers; main.ts keeps wiring only. Blueprint in §4.
- **[P2-6] Implicit command FSM** — `src/engine/sim.worker.ts:40-62,245-247`. The `Command` union is a hand-rolled state machine with no table; `EQUIP_TOOL` and `HARVEST_PART` have no `case`, falling into `default: break` — silent no-op. *Fix:* exhaustive `Record<Command['type'], handler>` map so unhandled commands are compile errors.
- **[P3-6] Paddock is a dead subsystem** — `src/engine/husbandry.ts:98 stepPaddockDay` is never imported by `sim.worker.ts` (verified by grep); the Paddocks tab mutates UI-local `state.paddock` counters that mean nothing. *Fix:* wire `stepPaddockDay` into `advance()`/`tick()` or remove the tab until it does.

### Lens 2 — Frame-Budget & Performance Engineer
- **[P1-1] Unguarded throw terminates the render loop** — `src/main.ts:492-505`. `state.view.readSnapshot()` (`src/engine/memoryLayout.ts:105-123`) throws after `maxAttempts = 8` torn reads. An exception here propagates out of `frame()` **before** `requestAnimationFrame(frame)` (line 504) re-registers — the rAF chain is permanently dead, the game freezes, and the user sees a live-but-frozen UI. Worker-vs-UI write races are rare by design (~100 µs write window vs 10 Hz), but a permanent freeze is an unacceptable failure mode for a solvable contention case. *Fix:* try/catch the snapshot read, skip the frame on failure (or return null from `readSnapshot`). Blueprint in §4.
- **Per-frame work is otherwise cheap:** `renderQuest` rescans all vessels × 256 species/frame (trivial vs 16.67 ms budget); `state.log` grows without bound (last 8 rendered, array retained) — P3 memory drift over long sessions.
- **Shipped media weight:** `src/media/` = 2.2 MB (splash mp4/webm/png) — hashed, `/static/media/`, `assetFilter` excludes them from the 200 KB JS budget; correct. Plan Task 15 budget check remains valid.

### Lens 3 — Mathematical, Physics & Algorithmic Engineer
- No NaN-prone paths found in the physics core (pH solver handles `SID` symmetrically; phase-clamp boiling tested by suite). `formatClock` (`src/main.ts:283`) is correct modulo sign; `selectedIndex()` clamps against `Math.max(0, len-1)` — safe.
- **[P3-5]** `world.ts:93` `FLAG_BOILING` threshold `373.14` is a magic number duplicating the physics constant; `TEMP_K >= 373.14` drifts from any future altitude/ambient pressure model. Name it `BOILING_FLAG_K` and derive from the registry or a named constant.

### Lens 4 — Concurrency, Async & Determinism Engineer
- **SeqLock** (`memoryLayout.ts:105-123`) is correct; the only defect is the caller-side liveness (P1-1). `readSnapshot` slicing is allocation-per-frame (~67 KB copies ×2) — acceptable at 10–60 Hz, not a leak.
- `sim.worker.ts:78` `labels` map grows unboundedly with created vessels — bounded by 32 `MAX_VESSELS` in practice (and unused indices) — benign.
- Worker `setInterval(tick, 100)` continues while hidden tabs throttle — by design (survival sim), documented behavior.
- **ADVANCE duplicates the tick path** (`sim.worker.ts:118-130` vs `132-142`) — a drift hazard: the in-flight plan explicitly requires wound→sepsis escalation to exist in *both* paths (see the gap-closure commit `d72ced0` "sepsis fast-forward parity"). Today both are manually duplicated; plan Task 5/7 must update both or advance() will silently skip escalation. Flag as **plan-relevant defect**, not runtime bug.

### Lens 5 — Memory & Resource Lifecycle Engineer
- No `addEventListener` leaks in the splash path (removal re-registered correctly, `dismissed` guard) — clean (my code, audited).
- `main.ts:423-427` `renderLog` re-renders last 8 but `state.log` never truncates — crosses into leak territory only over many hours; P3.
- `initMenuAndSettings` attaches listeners to `modalContainer` children — never removed, but the modal lives for app lifetime — fine.

### Lens 6 — Security & Trust-Boundary Engineer
- **[P2-1] innerHTML XSS pattern class** — `src/main.ts:303` (vessel label), `:381` (species code/name), `:410` (quest text), `:423` (log entries: `<li>${entry}</li>`), plus `WorkbenchCanvas.ts:33,55,106`, `ToolAndInventoryPanel.ts:30`, `BiomeTreePanel.ts:14`, `MenuController.ts:35` (compendium rows). All *current* interpolations are static registry/biome data — **not exploitable today** — but the pattern has no escaping anywhere in the codebase, so one future free-text field (vessel rename, save-import vessel labels, custom recipe) is a stored-XSS in a game that imports base64 save files from the world. Zero existing `innerHTML` assignments contain any escape helper at all. *Fix:* textContent-only rendering or a single `escapeHtml`/`createEl` helper; §4.
- **[P2-2] Save import trust boundary** — `persistence.ts:32-43` (`deserializeSave`) checks only `version: number` and `player` presence; vessel array, moles arrays, `glucoseKcal` type are never validated. `MenuController.ts:11` and `persistence.ts:7` **claim SHA-256/integrity validation that does not exist**; `index.html` ships no CSP (COOP/COEP present, CSP absent). A crafted base64 save imports cleanly with `NaN`/wrong-typed fields → poisoned worker state (e.g., `moles` as strings → `moles * molarMass` → `NaN g` renders as `NaN`). *Fix:* schema-validate at the boundary (lightweight hand-written validator, zero new deps) + implement the advertised SHA-256 prefix check, or strip the claim.
- **Passthrough audit of the "verdict-never-consumed" shape:** no money/auth paths in this client — the nearest analog is the fake-restore (P1-2), which **is** the "server computed it, client ignored it" pattern.

### Lens 7 — Reliability, Fault Tolerance & Chaos Engineer
- **[P1-2] Import reports success, restores nothing** — `src/main.ts:575-577` and `MenuController.ts:179-190`. The user pastes a save, the log says `Imported game save from Day 1, Tick 4`, the world is unchanged, `state.ever` resets never happen, and the modal closes as if it worked. Until LOAD_WORLD lands (plan Task 7), this is a **fabricated success signal on the only persistence path the user can see**. *Fix:* hide/disable the Import button with a note, or wire `LOAD_WORLD` now; never ship a lying confirmation.
- No `worker.onerror`/`onunhandledrejection` in `startWorld()` — a throw inside `sim.worker.ts` surfaces nowhere; the UI just freezes at whatever the last frame showed, with no "simulation crashed" affordance. Plan does not add one either. *Fix:* `state.worker.onerror = () => { isoBadge…; log… }`.
- `deserializeSave` throws on corrupt base64 → `catch (err)` → `alert('Invalid or corrupted save string!')` — honest enough (P3 that `err` is unused).

### Lens 8 — Type Systems, Schema & Contract Engineer
- **[P2-7] `any` at the worker boundary** — `src/main.ts:522` (`PLAYER_SYNC` payload typed `any` ×2: `player`, `inventory`); `sim.worker.ts:62` (`EQUIP_TOOL … toolItem: any`). The one rigid contract (`Command` union) is undermined by `any` exactly where the worker meets the UI. *Fix:* `PlayerSyncPayload` / `InventorySyncPayload` interfaces shared between worker and main; `toolItem: ToolItem | null`.
- `persistence.ts:20-22` (`inventory: any; vessels: any[]`) — same boundary, save format. Contract-first plan does not tighten this.

### Lens 9 — Platform, Viewport & Portability Engineer
- Desktop-first CSS: `layout-4panel`, fixed topbar, no touch handlers (`pointerdown` absent; sliders/buttons are standard, fine), no `devicePixelRatio` concerns (DOM rendering, not canvas). Mobile is degraded-but-usable (single column? check `styles.css` — not enforced). The new splash overlay is `object-fit: cover` responsive — fine.
- `.splash-overlay` keyboard dismissal works for *any* key including Escape — good; `prefers-reduced-motion` bypass present — good.

### Lens 10 — Cognitive Load & AI-Context Maintainability Engineer
- `main.ts` 614 lines mixing six concerns; `renderQuest`'s per-frame closure allocations; `SIM_STEP_SECONDS = 360` duplicated inline in worker (`:30`) with no `time.ts` (plan Task 6 fixes); magic numbers in quest thresholds. Detour: the in-flight plan addresses this comprehensively (Tasks 6, 12) — maintainability roadmap is sound.

### Lens 11 (Engagement & Game Feel, 11th lens for a game)
**N/A as a shipped claim — the game currently has no engagement arc at all; the Grand Crucible plan is that arc.** Audit basis: `docs/plans/2026-11-03-story-and-progression-design.md` + `-implementation-plan.md` (15 tasks). Verdict: well-designed (frame-accurate chapters, letters board, renown economy, three endings, boot splash with Continue/New World, autosave), **but only Tasks 1–3 are built**. Until Tasks 5–15 land: no audio (any kind), no toasts, no difficulty arc, no narrative onboarding — a survival chemistry *calculator*, not a game. The plan's sequencing (engine → data → worker wiring → UI juice → persistence → audio → gates) is correct; the risk is the audit's own R3: landing "juice" tasks while placebo controls still exist on screen.

---

## 3. Existing Test Suite Comparison & Mutation Truth Table

**Test-to-Code file ratio:** 16 / 25 (`0.64`) · **~265 assertions** total · **zero `vi.mock`** anywhere (no mock-mirror tautologies) · negative/boundary signals present in 11/16 files but concentrated in chemistry/walkthrough suites; **metallurgy (2/32), solubility-happy-path suites** are example of weak-signal integration coverage.

**Estimated Mutation Kill Score ($M_{kill}$): ≈ `60%`** — on the basis above: core chemistry/walkthrough would kill most M1 (boundary) mutants; `world.ts` orchestration (`stepWorld`, `syncWorldToShared`) and the worker command bridge kill **zero** mutants (untested); UI layer kills zero.

| Implementation Module | Critical Paths | Paired Test | Pathologies Detected | M1–M4 Killed | Gap |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `engine/chemistry.ts` | pH solver, phase-clamp boiling, saponification | `chemistry.test.ts` (19) | none | 3.5/4 | Solubility overflow edge |
| `engine/metabolism.ts` | Glucose/adipose, fever, treatments | `metabolism.test.ts`, `pharmaceuticals.test.ts` | Happy-path tilt | 2/4 | Dose boundaries, sepsis math |
| `engine/fabrication.ts` | Recipes, bronze fork math | `metallurgy.test.ts`, `fabricationAndInventory.test.ts`, `items.test.ts` | Weak-signal volume | 2.5/4 | MOQ furnace failure modes |
| `engine/persistence.ts` | Save round-trip | `persistence.test.ts` (7) | Existence-only | 2/4 | Tampered/corrupt payloads |
| `engine/world.ts` | `stepWorld`, `syncWorldToShared` | **NONE** | — | 0/4 | **Everything** |
| `engine/sim.worker.ts` | Command dispatch, INIT, ADVANCE | **NONE** | — | 0/4 | Command drops (see P2-6) |
| `engine/harvest.ts` *(Task 4 WIP)* | applyHarvest, wound roll | `harvest.test.ts` (4) | None; deterministic seed assertions | 3/4 | Container-overflow branch |
| `engine/rng.ts` *(Task 1)* | mulberry32, hashSeed | `rng.test.ts` (8) | none | 4/4 | — |
| `engine/husbandry.ts` | Paddock step | `husbandry.test.ts` (11) **test-exists-but-unwired** | Tests pass but the shipped UI never calls it | 2/4 | Production call-site |
| `engine/memoryLayout.ts` | SeqLock | `memoryLayout.test.ts` (14) | none | 4/4 | — |
| `data/*` (registry, biome, items) | Integrity contracts | `biomeNodes.test.ts`, `items.test.ts`, `icons.test.ts` | none | — | Append-only contract holds |
| `ui/*` | — | **NONE** (DOM) | — | 0 | Visual claims unverifiable in CI |

### Why Existing Tests Missed the P0/P1 Defects
- **P1-1:** No test can see `frame()` — DOM/`requestAnimationFrame` untested (every parser test would "pass"; the freeze is an integration liveness failure). `readSnapshot`'s own unit test (`memoryLayout.test.ts:14`) asserts the happy path and the throw, but nothing asserts the caller's behavior on throw — the contract "caller must tolerate throw" was never stated, let alone enforced.
- **P1-2:** `persistence.test.ts` tests the *codec* (round-trip integrity), not the *wiring* (what the Import button does with the result). The lie is in `main.ts`, which no suite imports.

### Minimal Viable Test Harness (MVTH) — specified for §3
1. **`stepWorld.roundtrip`:** create world → `createWorldVessel` → `ADD_ASH`-equivalent → `stepWorld(dt=3600)` ×N → assert tick increments, events emit, and `syncWorldToShared` buffer matches vessel state exactly (moles, pH, volume).
2. **`sim.worker dispatch`:** instantiate worker logic against a fake `postMessage` ctx (the code already exports `FullSimState` shape); drive `INIT` → `CREATE_VESSEL` → `ADD_ASH` → `ADVANCE {hours:1}`; assert `VESSELS`, `READY`, `PLAYER_SYNC`, `EVENTS` payloads; assert `EQUIP_TOOL` produces nothing (silent drop today — the test is the spec for the exhaustive-dispatch fix).
3. **`readSnapshot liveness`:** with a writer continuously flipping the SeqLock odd/even, assert `frame()`-equivalent loop survives ≥ 1,000 attempts without an uncaught throw (after the try/catch fix).

---

## 4. Surgical Refactoring Blueprints (Zero-Mutation Drafts)

### Refactor R-P1-1: Make the frame loop liveness-proof
- **Target:** `src/main.ts:492-505` · **ROI:** converts permanent-freeze failure class into a skipped frame (≤ 16 ms glitch)

**Current:**
```ts
function frame(): void {
  if (state.view) {
    const snapshot = state.view.readSnapshot();   // throws after 8 torn reads
    if (snapshot) { /* … */ }
  }
  requestAnimationFrame(frame);
}
```
**Target (drop-in, 6 lines):**
```ts
function frame(): void {
  try {
    if (state.view) {
      const snapshot = state.view.readSnapshot();
      if (snapshot) { /* unchanged */ }
    }
  } catch {
    /* SeqLock contention: skip this frame; never kill the loop */
  }
  requestAnimationFrame(frame);
}
```

### Refactor R-P1-2: Stop faking save imports (until LOAD_WORLD lands)
- **Target:** `src/main.ts:575-577`, `src/ui/MenuController.ts:179-190` · **ROI:** removes the only fabricated success signal in the UI

**Target (honest disabled state, pre-Task-7):**
```ts
// MenuController: render Import button disabled with title, OR:
onImportSave: (save) => {
  state.log.push('Save restore is not wired yet — see Grand Crucible Task 7.');
  renderLog();
},
```
**Full fix:** implement `LOAD_WORLD` (plan Task 7) and assert `world.tick === restored.tick` post-restore.

### Refactor R-P2-1: Kill the innerHTML pattern class
- **Target:** `src/main.ts:303,381,410,423` etc. · **ROI:** removes an entire stored-XSS class; no runtime cost

```ts
const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!) as string);
// … or build nodes via document.createElement + textContent (preferred for log/quest).
```

### Refactor R-P2-6: Exhaustive command dispatch (compile-time completeness)
- **Target:** `src/engine/sim.worker.ts:40-62,144-247`
```ts
const handlers: { [K in Command['type']]: (c: Extract<Command, { type: K }>) => void } = {
  INIT(c) { /* … */ }, CREATE_VESSEL(c) { /* … */ }, /* … */
  EQUIP_TOOL(c) { /* wire or throw new Error('not implemented') */ },
};
ctx.onmessage = e => { handlers[e.data.type]?.(e.data as never); };
```
An unimplemented arm becomes a compile error, not a silent void.

---

## 5. Phased Execution Roadmap (post-audit, user-gated)

1. **Phase 1 — Containment (P1s):** R-P1-1 + R-P1-2 (+ one try/catch around `syncWorldToShared` for symmetry). Land before anything else; verify via `npm run dev` → splash → hard reload → observe no freeze with worker throttled.
2. **Phase 2 — Spine coverage:** MVTH-1/2/3 (§3); then re-audit `world.ts`/`sim.worker.ts` hotspots. Also fold in R-P2-6 exhaustive dispatch + `worker.onerror` handler.
3. **Phase 3 — Honesty pass (R3):** wire-or-delete: three volume sliders (Task 13 does this), "Reduced Motion" (Task 12), paddock step call, Import button (Task 7), placebo labels; then re-run this audit to re-score.

> All phase gates: `npm test && npx tsc --noEmit && npm run build` per task, per the in-flight plan.

---

## 6. In-Flight Agent Review (Grand Crucible — not done building; review based on plan + WIP)

**Plan verdict: strong.** Contract-first, TDD gates per task, seeded determinism, append-only species registry contract, file map with single-purpose modules, explicit "54 existing tests stay green" discipline (now 72 with Tasks 1–4), zero-runtime-dependency rule, and the `SAB_BYTE_LENGTH` freeze respected. The plan correctly identifies the two seams most likely to rot (worker ADVANCE vs tick parity; PLAYER_SYNC v2) and pays for them with explicit tasks.

**Issues found in the plan itself:**
1. **No tests planned for `world.ts` or `sim.worker.ts`** — the File Map adds `tests/…` for every new module but never one for the orchestration spine. Retrofit MVTH-1/2 as an added task before Task 10 (UI wiring) — UI complexity lands on these seams next.
2. **Persistence v2 + SHA-256 (Task 7) is where P1-2 gets fixed**; the plan should state the honest interim UI behavior explicitly (R-P1-2) so `main` never ships the lying button on the way there.
3. **Counter drift:** plan text says "existing 54 tests" — reality is 72 at Task 4 boundary; cosmetic, update at next doc sync.
4. **`public/favicon.svg` vs "Zero assets" constraint** — the constraint means no raster/audio/fonts; SVG favicon whitelisted in the File Map — consistent, not a defect.
5. **Task 4 WIP (uncommitted, read-only reviewed):** implements the plan spec exactly (kcal gate, container chain bare-hands→backpack→camp-cache, seeded `_HUNT`-suffix wound roll, `woundContamination` flag) — **green (4/4)**, deterministic, documented carry-weight `0` closed-form. No deviations from spec. One note: `applyHarvest` silently ignores `equippedToolSlot`/`requiredSlot` by design (commented) — legitimate, matches plan's "slot match is a UI affordance".

**What the plan will still leave broken (audit findings it does not address):** P1-1 (frame-loop freeze — no task touches `frame()`), P2-1 (innerHTML escaping — Task 12 covers ESC registry, not escaping), P2-6 partly (worker command voids persist until their tasks wire them; `EQUIP_TOOL` gets a handler only in Task 11), `worker.onerror` (nowhere), paddock unwired (untouched).

---

## 7. Audit Verification Appendix

Commands run (read-only vs the repository; outputs quoted in the body):
- `python3 preflight_telemetry.py` (patched prune: `node_modules`, `dist`, `out`, `.superpowers`) → `files_scanned=40`, `effective_loc=5975`, `tree_integrity_sha256=07dcd493…`
- `python3 dead_export_sweep.py . --src src` → 41 dead value exports + 30 dead type exports, **all but 2 confirmed "not yet wired" by the Task 5/11 plan** (spot-verified by grep: `consumeFood`, `serializeSave`, `mulberry32`, `applyHarvest`, `getEatingUtensilBonus`, `captureAnimal`); zero barrel/subtree dead trees found
- `npm test` → **72 passed / 16 files** (68 at audit start + 4 Task-4 WIP)
- `npm run build` → green (`Entrypoint main` well under the 200 KB budget for JS; `assetFilter` excludes splash media)
- `npx tsc --noEmit` → clean at HEAD; fails **only** on absent-in-flight files during the agent's mid-task window (not a repo defect)
- `git status --porcelain` pre vs post audit: source files untouched; this report is the only addition
- CI: `.github/workflows/ci.yml` = typecheck → vitest → production build (good); note it runs only on committed state — the agent's uncommitted WIP is invisible to CI until commit
