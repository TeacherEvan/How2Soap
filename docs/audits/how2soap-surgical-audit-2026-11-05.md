# Surgical Audit Report: How2Soap — Emergent Chemistry & Survival Engine

| Audit Metadata | Specification |
| :--- | :--- |
| **Audit Date** | 2026-11-05 |
| **Audited Scope** | `src/` (102 TS modules, 20,838 LOC), `tests/` (62 suites), `public/`, `webpack.config.js`, `vercel.json`, CI (scanner: **170 code files, 23,931 effective LOC**) |
| **Tech Stack & Runtime** | TypeScript 5.4, Webpack 5, Vitest 3, 10 Hz Web Worker + `SharedArrayBuffer`/SeqLock, Canvas 2D, Web Audio, PWA, COOP/COEP, Vercel static |
| **HEAD / Tracked Mutation** | `1fee8ba338c181a9e262b327e71c52681410b729` / **`git diff HEAD` empty (VERIFIED)** |
| **Scanner Digest** | pre `cf42911e4f464697…`, post `a1472ce80a24ac09…` — **differs only because a user-authored untracked plan appeared mid-audit** (`docs/plans/OPTIONAL implementation_plan.md`, mtime 17:28:25, not created by this audit, excluded from scope) |
| **Deterministic Health Score** | **`66 / 100`** (`D_raw = 131`, `D_scaled = 26.78`, `P_test = 7.2`, `M_kill = 52%`, `LOC_eff = 23,931`) |
| **Vibe-Debt Risk Level** | **`HIGH`** (`S = 66`, but `N_P0 = 1`) |
| **Gate Results** | `npx tsc --noEmit` **0 errors**; `npx vitest run` **62 files / 312 tests pass**; `npm run build` **green** — entrypoint **197,202 / 200,000 bytes (98.6%)** |

---

## 1. Executive Architecture & Vibe-Debt Triage

The engine core is genuinely strong: a correct SeqLock over a frozen 67,648-byte SAB, a deterministic seeded worker, a real calorimetry/Arrhenius/Faraday model, and a well-factored `src/app/` orchestration layer that fixes the previous audit's God-file finding. The dominant failure mode is no longer math — it is **state ownership at the seams**. The save path drops every vessel's thermal/electrical state, the autosave timer is starved by its own 10 Hz input, and the entire Civ VII campaign layer (Ages, influence, missions, built works, victories) is either imported only by tests or rendered from hardcoded mock objects inside the windows. A second failure mode is **per-tick UI amplification**: 10 Hz `PLAYER_SYNC`/`COLONY_SYNC` drive four full `innerHTML` rebuilds per 100 ms, and `ADVANCE` during "March ×8" emits 1,920 sync messages that each trigger another full rebuild. Third: **no worker error boundary exists** — a malformed save or a 33rd vessel turns the simulation into a silent, permanent error loop with no user-visible recovery. The suite is broad (312 tests) but tests the codecs and pure engines far more than the schedulers, command side effects, and UI lifecycles where these defects live.

| Severity Tier | Count | Deduction Weight | Primary Failure Domains |
| :--- | :--- | :--- | :--- |
| **P0 — Critical (Data Loss)** | **1** | `-18` ea | Autosave never fires during active play (`src/app/autosave.ts:76-99`) |
| **P1 — High (State Loss / Frame Budget / Crash)** | **9** | `-8` ea | Vessel state not persisted; 1,920-message ADVANCE flood; 10 Hz DOM churn; no worker error boundary; consume-before-validate; fictional SAB fallback; unwired campaign layer; 32-vessel ceiling; gzip bomb |
| **P2 — Medium (Split-Brain / Debt / A11y)** | **12** | `-3` ea | Map CSS mismatch, touch/DPR, keyboard conflict, dual `ever` maps, phantom idle jobs, `any` save schema, per-tick payload churn, dead UI modules, O(N²) boids, payload/budget, listener leak, `aria-live` spam |
| **P3 — Low (DX / Spec Drift)** | **5** | `-1` ea | Magic-number chemistry, semantic ARIA misuse, timer drift, 6 kg hand-slot rule unenforced, dead no-op block |

### High-Risk File Telemetry Hotspots

| File Path | Effective LOC | Est. CC / Branch Density | Silent Catches | Primary Vibe-Debt Signature |
| :--- | :--- | :--- | :--- | :--- |
| `src/engine/sim.worker.ts` | 1,142 | 33 / 0.028 | 0 | God command switch; 36-command union; all mutation ordering lives here |
| `src/engine/fabrication.ts` | 726 | 1 / 0.000 | 0 | Large but uniform recipe table (low risk) |
| `src/engine/crisis.ts` | 599 | 33 / 0.054 | 0 | Deterministic scheduler; best-designed state machine in repo |
| `src/ui/StrategyMapCanvas.ts` | 610 | 1 / 0.000 | 0 | 60 FPS canvas + 10 Hz roster rebuild + leaked listeners |
| `src/data/speciesRegistry.ts` | 538 | 1 / 0.000 | 0 | Declarative data (fine) |
| `src/data/biomeNodes.ts` | 534 | 1 / 0.000 | 0 | Declarative DAG (fine) |
| `src/engine/colony.ts` | 423 | 31 / 0.071 | 0 | O(N²) boids; payroll/stimulant state machine |
| `src/ui/windows/InfluenceWindow.ts` | 398 | 13 / 0.030 | 0 | Entirely mock state; zero worker commands |

> CC is a regex floor for TS (ternaries/`&&` are invisible), per the scanner pitfall. `scripts/make-splash/make_splash.py` (576 LOC, CC 42) is a non-shipping tool script and is excluded from severity scoring.

---

## 2. The 10-Principal-Engineer Deep Audit

### Lens 1 — Systems Architect (Topology, Coupling & State Machines)

- **[P1-7] The Civ VII campaign layer is unwired or mocked** — `src/app/launcher.ts:15-23`, `src/ui/windows/InfluenceWindow.ts:21-95,237-238`, `src/ui/windows/RealmWindow.ts:22-32`, `src/engine/campaign/*`
  - **Root Cause Mechanism:** 11 engine modules (1,721 LOC: `ageTransitions`, `bounties`, `codexExchange`, `deepMine`, `dispatches`, `harbour`, `hires`, `incursions`, `notables`, `petitioners`, `mandates`) have **zero production importers** and are imported only by tests. `InfluenceWindow` keeps `mockInfluence`, `mockCorrespondence`, `mockBuiltWorks`, `mockMissions` in module scope and sends **zero** worker commands. `RealmWindow` computes victory eligibility from a hardcoded `localVictoryState` (`dominion: 35, tourism: 28, gdp: 42, innovation: 50, dispatchesMastered: 4`) that `updateVictoryScores()` never touches. `state.ageProgress` is never assigned, so `TheTurningOverlay` (dead) and Ages II–III can never occur.
  - **Deterministic Trigger & Failure Mode:** Open Influence or Realm → interact → progress survives only in module variables, is absent from saves, and has no effect on the simulation. Reload → all mock progress resets. Found Settlement / Place District / Start Blacksmith Batch are unreachable because no UI ever posts those commands.
  - **Surgical Fix Specification:** One source of truth in the worker: add `INFLUENCE_SYNC`, `MISSIONS_SYNC`, `BUILT_WORKS_SYNC`, `VICTORY_SYNC` (or extend `REALM_SYNC`), persist them in `SerializedWorldSave`, and replace every `mock*`/`local*` in the two windows with `state.*`. Wire `FOUND_SETTLEMENT`, `PLACE_DISTRICT`, `START_BLACKSMITH_BATCH`, `openTheTurningOverlay` to real buttons. Delete any engine module that cannot be reached by the end of the pass.

- **[P2-4] Two independent `ever` maps (split-brain)** — `src/app/state.ts:64-74`, `src/app/views.ts:116-131`, `src/app/autosave.ts:50`, `src/app/workerMessages.ts:266`
  - **Root Cause Mechanism:** `state.ever` (quest checklist, computed from species moles each tick) and `state.progression.ever` (objective sensor, persisted) are separate objects with different writers. Only `progression.ever` is saved.
  - **Failure Mode:** Quest flags reset on reload while objective flags survive; `hasFlag` objectives cannot see the quest-computed flags.
  - **Fix:** Delete `state.ever`; derive quest rows from `state.progression.ever` plus live sensor reads, or make `renderQuest` write through `applyProgressEventsWithSensor`.

- **[P2-5] Idle sentinel creates a phantom job loop** — `src/ui/StrategyMapCanvas.ts:683-690`, `src/engine/sim.worker.ts:998-1005`, `src/engine/colony.ts:176-189`
  - **Root Cause Mechanism:** "Idle at Camp" calls `onAssignJob(id, '', '')`; the worker always calls `assignColonistJob`, which sets `status='TRAVELING'` with empty ids. `getSpeciesWorldPosition('')` returns `{0,0}`, so the colonist arrives instantly, "gathers" for 10 minutes, returns, and repeats forever.
  - **Failure Mode:** Colonists never reach `IDLE`, show `TRAVELING` in the roster, and burn state-machine work every tick.
  - **Fix:** In the worker, `if (!command.speciesId) { c.assignedJob = null; c.status = 'IDLE'; }` before calling `assignColonistJob`; test the empty sentinel.

### Lens 2 — Frame-Budget & Performance Engineer

- **[P1-2] `ADVANCE` floods the UI with 1,920 sync messages** — `src/engine/sim.worker.ts:381-385,389-397`, `src/app/workerMessages.ts:238-249`, `src/app/panels.ts:173-276`
  - **Root Cause Mechanism:** `stepSingleTick()` unconditionally calls `postRequestSync()` and `postCrisisSync()`; `advance(hours)` loops `hours × WORKER_HZ` times. "March ×8" = 192 h × 10 = **1,920 steps → 1,920 `REQUEST_SYNC` messages**, each handled by a **full `updatePlayerUI()` rebuild**.
  - **Trigger:** Press "March ×8" (`main.ts:236-238`). The worker computes for ~1–3 s, then the main thread processes 1,920 DOM rebuilds. End Turn (24 h) is 240 rebuilds.
  - **Fix:** Add a `batchDepth` flag in the worker: suppress request/crisis posts inside `advance`, emit one sync at the end; coalesce in `handleWorkerMessage` with a scheduled microtask/rAF flush.
  - **Measured:** 192 h × 10 Hz = 1,920 (see Appendix).

- **[P1-3] 10 Hz full-`innerHTML` rebuild of four UI surfaces** — `src/app/workerMessages.ts:116-128,140-147`, `src/app/panels.ts:173-276`, `src/ui/ToolAndInventoryPanel.ts:106`, `src/ui/StrategyMapCanvas.ts:151-155,571-712`
  - **Root Cause Mechanism:** `PLAYER_SYNC` is posted on **every** worker tick (`sim.worker.ts:459-467`) and calls `updatePlayerUI()`, which rewrites `bannersRow`, the whole tool/inventory panel, and the timed-requests widget; `COLONY_SYNC` calls `strategyMap.update()` → `renderDock()` → full roster `innerHTML` **even while the Strategy tab is hidden**.
  - **Trigger:** Idle gameplay at 10 Hz. Every 100 ms the "Deliver" button, inventory slots, and roster controls are destroyed and recreated (the roster only defers when a `<select>` is focused, which instead skips all other roster updates). A pointerdown that spans a rebuild can lose its click target; roster scroll resets; battery/CPU burn is continuous.
  - **Fix:** Render-on-change view models: hash the sync payload, skip identical renders; patch text nodes instead of `innerHTML`; keep DOM nodes stable and update `textContent`/classes; skip `renderDock` when `container.offsetParent === null`.

- **[P2-7] Per-tick structured-clone and CPU churn** — `src/engine/sim.worker.ts:253-265,286-293,304-328`
  - **Root Cause:** `postColonySync` serializes the 1,024-byte desire grid as a `number[]` plus the full colonist/ledger arrays every tick; `postCrisisSync` runs `JSON.stringify` every tick; `checkAndEmitSpeciesObjectives` scans 32 × 256 species every tick and calls `Object.keys(SPECIES).find()` per hit.
  - **Failure Mode:** ~4 KB structured clone × 10 Hz forever, plus 81,920 species reads/s and per-hit key enumeration — pure waste in a turn-based game.
  - **Fix:** Send the desire grid only when a wear byte changes (dirty bit), send colony diffs, replace per-tick crisis JSON with a version counter, and precompute a `SPECIES_INDEX_TO_KEY` table.

- **[P2-9] O(N²) boids + roster option scaling** — `src/engine/colony.ts:515-547`, `src/ui/StrategyMapCanvas.ts:586-596`
  - **Root Cause:** All-pairs separation every tick, and `jobOptions` (one per species part) rebuilt for every colonist on every render.
  - **Failure Mode:** 200 colonists = 19,900 pairs × 10 Hz; roster rebuild emits `colonists × 19` `<option>` nodes at 10 Hz.
  - **Fix:** Spatial hash grid for boids; hoist `jobOptions` to a module constant; reuse option nodes.

- **[P2-10] Shipped payload and bundle headroom** — `src/app/splash.ts:7-13,36-45,139-146`, `webpack.config.js:121-130`, repo root
  - **Root Cause:** The boot splash imports two MP4s, two WebMs, and two posters; `preload='auto'` forces ~3.2 MB (`how2soap-splash-new.mp4` + poster) before gameplay, with the loader transition adding ~1.4 MB later. `dist/static/media` is **6.89 MiB**. The repo also tracks `gemini_generated_video_7b5cc200.mp4` (6.5 MB) with zero references. Entrypoint is **197,202 / 200,000 bytes (98.6%)**.
  - **Failure Mode:** Slow first paint on mobile; no budget left for the next feature (any added module fails `hints: 'error'`).
  - **Fix:** `preload='metadata'`, drop the duplicate WebM if the MP4 is the compatibility path, lazy-load the loader video on first tab transition, delete the unused root video, and recover ≥15 KB of JS headroom by moving one lazy window out of the eager graph.

### Lens 3 — Mathematical, Physics & Algorithmic Engineer

- **N/A — no new math defect found.** `computePH` implements the correct root; `applyHeat` cannot divide by zero (`baseHeatCapacityJPerK > 0`); `stepBoiling` clamps to the lowest boiling species; `worldToScreen`/`screenToWorld` round-trip exactly. The only NaN ingress is unvalidated save data (`temperatureK: null` → `NaN` propagates through `Math.exp`/`Math.max`), which is scored under **P1-4/P2-6** rather than double-counted here. Fixed-step `dt = 360 s` avoids the classic frame-rate-dependent damping family.

### Lens 4 — Concurrency, Async & Determinism Engineer

- **SAB read/write protocol is correct** — `src/engine/memoryLayout.ts:104-140`: odd/even SeqLock, retry cap, cached last snapshot. No torn-read defect found.
- **[P0-1] Autosave timer is starved by 10 Hz re-arming** — `src/app/autosave.ts:76-99`, call sites `src/app/workerMessages.ts:112,125`
  - **Root Cause Mechanism:** Every `requestAutoSave()` call executes `clearTimeout(autoSaveTimer)` and re-arms a 2,000 ms timeout. `PLAYER_SYNC` arrives every 100 ms, so the timer is cleared **20 times** before it can fire. `lastSaveSignature` is only assigned inside the callback, so the "unchanged" early-return never triggers.
  - **Deterministic Trigger & Failure Mode:** Normal unpaused play → autosave never writes. Crash, force-quit, or power loss loses the entire session; only `visibilitychange` (tab hide) saves. Pausing or dying stops the ticks, which is the only reason a save ever lands.
  - **Measured:** 10 s of simulated 10 Hz play → **0 writes**; pause + 2.5 s → **1 write** (Appendix).
  - **Fix:** Throttle-with-max-wait: if a timer is already pending, return; write at most once per N seconds and always when the signature changes. Include inventory/colony/vessel digests in the signature (seed is hardcoded to `0` today).

### Lens 5 — Memory & Resource Lifecycle Engineer

- **[P2-11] `StrategyMapCanvas.destroy()` does not detach window listeners** — `src/ui/StrategyMapCanvas.ts:168-173,186-194`, `src/main.ts:147-196`
  - **Root Cause:** `mousemove`/`mouseup` are bound to `window` with anonymous arrow functions that close over the instance; `destroy()` only cancels the RAF. Every New World / Import Save constructs a new canvas and retains the old one through the live window listeners.
  - **Failure Mode:** Each restart leaks one canvas backing store, one 122 KB relief image, and three listeners; old handlers still mutate detached viewports.
  - **Fix:** Store bound handlers and `removeEventListener` in `destroy()`; add an `AbortController` and pass `{ signal }` to every listener.
- **[P1-9] Gzip import materializes the whole payload before the 5 MB check** — `src/engine/persistence.ts:208-222`
  - **Root Cause:** `await new Response(ds.readable).arrayBuffer()` allocates the full decompressed output; `MAX_DECOMPRESSED_BYTES` is compared **after** allocation.
  - **Trigger:** Paste a small gzip bomb into "Import Save" → multi-GB allocation → tab OOM.
  - **Fix:** Read the stream chunk-by-chunk, abort as soon as the running total exceeds the cap, then decode.

### Lens 6 — Security & Trust-Boundary Engineer

- **No server boundary; the trust boundary is imported save text + `localStorage`.** CSP (`script-src 'self'`, `object-src 'none'`) correctly blocks inline handlers, and COOP/COEP are set in both `vercel.json` and the dev server.
- **[P2-6] Save payloads are `any`-typed and only shallowly validated** — `src/engine/persistence.ts:18-55,61-110,113-148`, `src/engine/worldRestore.ts:11-30`
  - **Root Cause:** `deserializeSave` checks only `typeof version === 'number'` and truthy `player`. `vessels`, `inventory`, `colony.colonists`, `paddock` pass through unchecked. `restoreWorldFromSave` dereferences `raw.id` (null vessel → throw), `MATERIALS[raw.material]` (unknown material → `undefined.failureTempK` in the tick), and `new Float64Array(raw.moles)` (non-numeric → silent zeros).
  - **Failure Mode:** Any hand-edited/corrupt save crashes the worker on the first tick; combined with **P1-4**, the session is bricked with no message.
  - **Fix:** Runtime schema validator at the boundary (`zod`-free hand-written guards to preserve zero deps): array/shape/finite-number checks, clamp `tick`/`temperatureK`, reject unknown materials, cap array lengths, return a typed error message.

### Lens 7 — Reliability, Fault Tolerance & Chaos Engineer

- **[P1-4] No worker error boundary and no `worker.onerror`** — `src/main.ts:106-108`, `src/engine/sim.worker.ts:469-1201`
  - **Root Cause:** The worker's `onmessage` has no `try/catch`; `main.ts` never subscribes to `onerror`/`onmessageerror`. An exception (bad save, unknown material, 33rd vessel) is reported to an unobserved error channel; the worker keeps its interval and keeps failing. `tick()` returns early only when `world` is null, so the UI stays on "checking…" forever.
  - **Trigger:** Import `{"version":3,"player":{},"vessels":[null]}` → `restoreWorldFromSave` throws → no READY, no PLAYER_SYNC, no visible error.
  - **Fix:** Wrap the command switch and `tick()` in a boundary that posts `{type:'SIM_ERROR', message, command}`; subscribe to `worker.onerror` and replace the world with a recoverable error card + "Start new world"; validate at `LOAD_WORLD` before mutating globals.
  - **Recurrence:** flagged in the 2026-11-03 audit (`worker.onerror` "nowhere") and still absent.

- **[P1-5] Consume-before-validate destroys player items** — `src/engine/sim.worker.ts:622-661,789-792,840-849,1007-1038`
  - **Root Cause:** `ADMINISTER_STIMULANT` removes the item, then calls `administerStimulant()`, whose `false` path only prints a failure message; `CHARGE_ITEM` removes any unknown item and (for non-mapped ids) adds no moles, then prints "Charged" **twice**; `FABRICATE` ignores `addItemToContainer` for the camp-cache fallback; `EQUIP_TOOL` ignores the failure to store the previous tool.
  - **Trigger:** Dose a colonist already on a stimulant; charge `WOOD_BRANCH`; fabricate with all containers full; equip a second tool with no free slot.
  - **Fix:** Compute a validated plan first (does the effect apply? will every output fit?), then commit mutations atomically; return `{ok, reason}` before any `count--`.

- **[P1-6] The SAB fallback is fictional** — `src/main.ts:98-104`
  - **Root Cause:** The UI writes "Fallback (simulated SAB)" when `!window.crossOriginIsolated`, but the next line unconditionally calls `new SharedArrayBuffer(...)`. On Chrome without COOP/COEP the constructor is not exposed; the boot throws.
  - **Trigger:** Any host that serves the app without the isolation headers (GitHub Pages, a plain static server, a misconfigured proxy, `file://`).
  - **Fix:** Either remove the fallback badge and hard-fail with a clear isolation message, or implement the fallback (plain `ArrayBuffer` + postMessage snapshots) behind a capability check.

- **[P1-8] Unbounded vessel creation against a fixed 32-vessel SAB** — `src/app/views.ts:40-49`, `src/engine/sim.worker.ts:566-578`, `src/engine/world.ts:78-101`, `src/app/views.ts:83-106`
  - **Root Cause:** The "+ Wooden bucket" button is unlimited; `CREATE_VESSEL` never checks `MAX_VESSELS`. Index ≥ 32 writes are silently dropped by the typed arrays, while `renderReactionsSummary` reads `snapshot.telemetry[32*8+…]` → `undefined` → `.toFixed()` throws inside `frame()`.
  - **Trigger:** Create 33 vessels, select the 33rd. The frame loop catches the throw silently and stops updating for that tick; every subsequent tick repeats it.
  - **Fix:** Reject creation at `world.vessels.length >= MAX_VESSELS` with an EVENTS message; disable the button; guard `renderReactionsSummary` with a finite check.

### Lens 8 — Type Systems, Schema & Contract Engineer

- **The save contract is `any` at every nested level** (see P2-6). `SerializedWorldSave.inventory: any`, `vessels: any[]`, `paddock: any`, and `sim.worker` accepts `save: any`. `migrateSave` re-stringifies and re-parses an already-parsed object for v2+ (wasteful, and loses `undefined` keys).
- **[P3-5] Per-slot hand mass rule is not enforced** — `src/engine/inventory.ts:71-79`
  - **Root Cause:** `getContainerTotalMassKg` enforces only the 12 kg container total; the documented 6 kg per slot is not modeled, so a 10 kg log fits in one hand.
  - **Fix:** Add `maxMassKg` per slot, check `total + item.massKg <= slot.maxMassKg` before stacking, and test the boundary.

### Lens 9 — Platform, Viewport & Portability Engineer

- **[P2-1] Strategy-map CSS/class contract is broken** — `src/ui/StrategyMapCanvas.ts:113-121` vs `src/styles.css:1445-1490`
  - **Root Cause:** The TS emits `.strategy-canvas-wrapper`, `.map-controls`, `.map-ctrl-btn`; the CSS defines `.map-viewport-wrapper`, `.map-controls-overlay`, `.map-btn`. Nothing styles the wrapper or the control cluster; the intended absolute overlay never applies and the buttons fall back to the generic button rule.
  - **Trigger:** Open the Strategy tab on any viewport → no authored rule positions the control cluster; it inherits normal flow inside an unstyled wrapper instead of the intended absolute overlay, and the 28×28 `.map-btn` styling is dead code. This is proven statically by the class-name mismatch; the exact box position depends on the wrapper's auto height and should be re-measured in a browser probe after the rename.
  - **Fix:** Rename one side (prefer the CSS names), add the missing `.strategy-canvas-wrapper` positioning, and add a regression assertion on the class names in `strategyMapCanvas.test.ts`.
- **[P2-2] No touch/pointer support and no `devicePixelRatio` scaling on the strategy map** — `src/ui/StrategyMapCanvas.ts:157-166,175-216`, `src/styles.css:1466-1470`
  - **Root Cause:** Only `mousedown`/`mousemove`/`mouseup`/`wheel`/`click` are bound; pan/pinch are impossible on touch. `resizeCanvas` sets the backing store to CSS pixels, so it is blurry on 2×/3× displays; the canvas is CSS-stretched (`width/height: 100%`) between resizes.
  - **Fix:** Use Pointer Events with `setPointerCapture`, a two-pointer pinch gesture, `canvas.width = rect.width * dpr`, `ctx.scale(dpr, dpr)`, and a `ResizeObserver`.
- **Keyboard conflict on the Mandate chip** — see P2-3 below.

### Lens 10 — Cognitive Load & AI-Context Maintainability Engineer

- **[P2-3] `role="button"` Mandate chip has no keyboard activation and steals Space** — `public/index.html:53`, `src/main.ts:252-265`
  - **Root Cause:** Only `click` is bound. The global keydown handler treats Space as End Turn for any target that is not `input/select/textarea/contenteditable` — a focused `div[role=button]` is not excluded.
  - **Failure Mode:** Keyboard user tabs to "Mandate", presses Enter/Space: nothing opens, and Space **ends the turn** (an irreversible action).
  - **Fix:** Bind `keydown` for Enter/Space on the chip and `stopPropagation`; add `[role="button"]` to the global handler's exclusion list.

- **[P3-1] Magic conversion constants and four duplicated container scans** — `src/engine/sim.worker.ts:635-654,772-786,823-835,861-872,908-919,1012-1023`
  - **Root Cause:** `50/12.011`, `200/100.086`, `150/891.5` etc. are inline; "find item in hands→backpack→cache" is copy-pasted five times with subtly different success semantics.
  - **Fix:** `const REAGENT_GRAMS: Record<string, {species, grams, molarMass}>` and a single `takeItem(inventory, itemId, count): Taken | null` helper returning what was actually removed.

- **[P2-8] Dead UI subtree + unused runtime dependency** — `src/ui/StrategyMap3D.ts` (150), `src/ui/GLTFLoader.ts` (56), `src/ui/CivBuildPanel.ts` (124), `src/ui/TheTurningOverlay.ts` (126), `src/ui/kinetics.ts` (48)
  - **Root Cause:** No production or test import references these files. `three` is therefore **never bundled** (no `WebGLRenderer` in `dist`), contradicting AGENTS' claim that it is the single lazy-loaded runtime dependency.
  - **Fix:** Delete the dead files and drop `three`/`@types/three` from `package.json`, or wire one of them (the in-flight plan proposes revitalizing `StrategyMap3D`) and add an import-graph test.

---

## 3. Existing Test Suite Comparison & Mutation Truth Table

- **Test-to-code ratio:** 62 suites / 102 src modules (`0.61`), 312 tests, **1,149 `expect()` assertions**.
- **Estimated Mutation Kill Score:** **`52%`**.
- **Basis (not a guess):**
  - 21 / 62 suites carry a negative/boundary signal (`toThrow`, `rejects`, `toBeNull`, `NaN`, `not.toBe`) = **34%**.
  - **0** `vi.mock` module mocks (good), but 40 `vi.fn`/`spyOn` and 39 `as any` fixtures.
  - 59 / 102 modules have no same-named test file; the worker command layer, autosave scheduler, `workerMessages`, `panels`, and both campaign windows are effectively unprotected.
  - **11 engine modules (1,721 LOC) are imported only by tests** — their green suites protect code no player can reach (counted as zero shipped coverage per the rubric).
  - 5 tests in `workerCommandsBugfix.test.ts` re-implement the worker loop inline and assert on the copy, not the production code.

| Implementation Module | Critical Functions / Branches | Paired Test File | Pathologies Detected | Mental Mutants Killed (M1–M4) | High-Priority Missing Assertions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `src/engine/sim.worker.ts` | `onmessage`, `tick`, `advance`, `CHARGE/EQUIP/FABRICATE/ADMINISTER` | `workerDispatch.test.ts` | Existence-only `ADVANCE`; no side-effect ordering | 2/4 (50%) | Item conservation, message budget, malformed `LOAD_WORLD`, 33rd vessel |
| `src/app/autosave.ts` | `requestAutoSave`, `buildSaveSnapshot` | `autosaveSignature.test.ts` only (signature helper) | Happy-path proxy; scheduler never imported | 0/4 (0%) | Timer starvation, dirty fields, quota failure, hide flush |
| `src/engine/persistence.ts` | `deserializeSave`, `decompressBase64ToSave` | `persistence.test.ts`, `saveV3Integrity.test.ts` | Happy-path tunnel vision | 2/4 (50%) | Gzip bomb, null vessel, non-finite numbers, version drift |
| `src/engine/worldRestore.ts` | `restoreWorldFromSave` | `saveV3Integrity.test.ts` | Round-trip omits most fields | 2/4 (50%) | Thermal/electrical fields, `closed` vs `headspaceClosed`, null raw |
| `src/engine/colony.ts` | payroll, boids, stimulant, `assignColonistJob` | `colony.test.ts` | Weak boundary (`dist > 1.0` vs 3.5 m), no empty sentinel | 3/4 (75%) | Empty job, strike+stimulant freeze, morale clamp |
| `src/ui/StrategyMapCanvas.ts` | `update`, `renderDock`, `destroy` | `strategyMapCanvas.test.ts` | Bespoke DOM mock; canvas ctx stubbed; no lifecycle | 2/4 (50%) | Listener teardown, hidden-tab rebuild, >32 vessels, touch |
| `src/engine/crisis.ts` | `tick`, `resolve`, `applyCrisisEffects` | `crisis.test.ts` | Deterministic happy path; paused path untested | 3/4 (75%) | Auto-resolve while paused, duplicate resolve, morale→STRIKE |
| `src/engine/chemistry.ts` | `stepVessel`, `computePH` | `chemistry.test.ts` | Good; NaN ingress absent | 3/4 (75%) | Non-finite temperature, condenser overflow |
| `src/app/workerMessages.ts` | dispatch table | **NONE** | Untested seam | 0/4 (0%) | Sync coalescing, unknown-message fallthrough |
| `src/ui/windows/InfluenceWindow.ts` | mock powers/missions | `civ-ui.test.ts` (string-level) | Mock-mirror: asserts mock data, not simulation | 0/4 (0%) | Real worker state, persistence, command dispatch |
| `src/ui/windows/RealmWindow.ts` | `localVictoryState` | **NONE** | Fake state never asserted against engine | 0/4 (0%) | `updateVictoryScores` integration |
| `src/engine/campaign/notables.ts` et al. | 11 modules, 1,721 LOC | campaign suites (green) | Tests pass, **nothing ships** | 3/4 (75%) | Production import + UI command |

### Why the Existing Tests Missed the Discovered P0/P1 Defects

- **P0-1:** No test imports `src/app/autosave.ts`; only the pure `snapshotSignature` helper is tested. The timer contract ("a save must eventually land under continuous input") was never stated.
- **P1-1:** `saveV3Integrity.test.ts` builds a vessel with only `id/material/capacityL/moles` and asserts only `world.vessels.length === 1`. No deep-equal, so every omitted thermal field passes.
- **P1-2:** `workerDispatch.test.ts:71-78` asserts `ADVANCE` "does not throw"; it never counts `REQUEST_SYNC` messages or measures UI work.
- **P1-3:** `strategyMapCanvas.test.ts` stubs `getContext('2d')` and uses a hand-rolled DOM; there is no timer or render-count assertion, so 10 Hz rebuilds are invisible.
- **P1-4:** The suite tests a corrupt SAB (`INIT` throws) but not a corrupt save; nothing asserts that the worker survives and reports an error.
- **P1-5:** `workerCommandsBugfix.test.ts` re-implements the equip/eat/treatment loops inline (lines 123-136, 182-195, 209-220) and asserts on the copy. The real worker's consume-before-validate order is never exercised.
- **P1-7:** Campaign suites import engine modules directly; no test asserts that a window imports the engine or posts a command. Green coverage of unreachable code inflates the score.
- **P1-8:** No test creates more than 3 vessels, so the 32-vessel boundary is never crossed.

### Minimal Viable Test Harness (MVTH) Specifications

1. **Autosave scheduler (`tests/autosaveScheduler.test.ts`):** fake timers; dispatch `PLAYER_SYNC` every 100 ms for 10 s → assert `localStorage.setItem` called **≥1** within 2.5 s and **≤1 per 2 s**; mutate inventory while paused → assert a write is requested; throw on `setItem` → assert no unhandled rejection.
2. **Save fidelity (`tests/saveFidelity.test.ts`):** table-driven `VesselState` fixtures → `buildSaveSnapshot` → `restoreWorldFromSave` → deep-equal on `temperatureK`, `heaterWatts`, `condenserTargetVesselId`, `appliedVolts`, `cellResistanceOhm`, `pressureKPa`, `ruptured`, `headspaceClosed`. Include `closed` vs `headspaceClosed` explicitly.
3. **Command conservation (`tests/workerConservation.test.ts`):** for every item-consuming command, assert `countBefore − countAfter === consumed` **and** the effect exists, or no mutation at all. Cases: unknown reagent, already-stimmed colonist, full containers, tool swap with no free slot.
4. **Error containment (`tests/workerResilience.test.ts`):** `LOAD_WORLD` with `vessels:[null]`, `material:'PLASTIC'`, `temperatureK:NaN` → assert a `SIM_ERROR` message and that a following `INIT` still reaches `READY`.
5. **Advance budget (`tests/advanceBudget.test.ts`):** `ADVANCE {hours:192}` → assert `REQUEST_SYNC` count ≤ 2 (not 1,920) and `TURN_RECAP` once.
6. **Vessel ceiling (`tests/vesselCap.test.ts`):** create 33 vessels → 33rd returns an EVENTS rejection; `renderReactionsSummary` with index 32 does not throw (finite guard).
7. **Campaign wiring (`tests/campaignWiring.test.ts`):** static import-graph assertion — every `WINDOWS` entry's module must import its engine module and contain no `mock`/`local` state object; `FOUND_SETTLEMENT`, `PLACE_DISTRICT`, `START_BLACKSMITH_BATCH` must appear in a UI module.
8. **Gzip cap (`tests/importBomb.test.ts`):** compress 6 MB of zeros → `decompressBase64ToSave` rejects with the 5 MB error **before** materializing the full output (instrument a stream chunk counter).
9. **Map lifecycle (`tests/strategyMapLifecycle.test.ts`):** construct → destroy → assert `removeEventListener` called for `mousemove`/`mouseup`; assert `update()` on a hidden container performs no `innerHTML` writes.

---

## 4. Surgical Refactoring Blueprints (Zero-Mutation Drafts)

### Refactor R1: Throttle-with-max-wait autosave (P0-1)

**Target:** `src/app/autosave.ts:76-99`
**ROI:** Guarantees a save every ≤2 s under 10 Hz input; removes the only session-loss path.

```ts
// Current (starves forever)
if (currentSig === lastSaveSignature) return;
if (autoSaveTimer !== null) clearTimeout(autoSaveTimer);
autoSaveTimer = window.setTimeout(write, 2000);
```

```ts
// Target: leading-edge throttle + max-wait + honest dirty digest
let lastWriteMs = 0;
let pending: number | null = null;
const MIN_INTERVAL_MS = 2000;

export function requestAutoSave(): void {
  const sig = stateDigest();                 // tick + glucose + inventory + colony + vessels
  if (sig === lastSaveSignature) return;
  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastWriteMs));
  if (pending !== null) return;              // do NOT re-arm from 10 Hz input
  pending = window.setTimeout(() => {
    pending = null;
    try {
      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(buildSaveSnapshot()));
      lastSaveSignature = sig;
      lastWriteMs = Date.now();
    } catch { /* quota — surface a HUD warning once */ }
  }, wait);
}
```

### Refactor R2: Persist the whole vessel, with a versioned schema (P1-1/P2-6)

**Target:** `src/app/autosave.ts:35-49`, `src/engine/worldRestore.ts:11-30`, `src/engine/persistence.ts:18-55`
**ROI:** Eliminates thermal/electrical state loss and the `closed`/`headspaceClosed` mismatch; makes saves deterministic.

```ts
// Target serialized shape (v4)
interface SerializedVessel {
  id: number; material: VesselMaterialKey; capacityL: number;
  headspaceClosed: boolean; temperatureK: number; pressureKPa: number;
  heaterWatts: number; condenserTargetVesselId: number;
  appliedVolts: number; cellResistanceOhm: number; ruptured: boolean;
  moles: number[]; precipitated: number[];
}
// write: snapshot only what the worker owns; do not reconstruct from UI state.
// read: validate every field with `Number.isFinite` and clamp to physical bounds.
// migration: v3 saves get defaults for the new fields, and `closed` is accepted
//            as a legacy alias for `headspaceClosed`.
```

### Refactor R3: Coalesce worker→UI sync (P1-2/P1-3/P2-7)

**Target:** `src/engine/sim.worker.ts:381-385,444-450,459-467`; `src/app/workerMessages.ts:116-128,238-249`
**ROI:** 1,920 rebuilds → 1 on March ×8; 10 Hz rebuilds → only on actual change.

```ts
// Worker: batch mode suppresses intermediate syncs
let batchDepth = 0;
const sync = () => { if (batchDepth === 0) flushSyncs(); };
function advance(hours: number) {
  batchDepth++;
  try { for (let i = 0; i < hours * WORKER_HZ; i++) stepSingleTick(); }
  finally { batchDepth--; flushSyncs(); }   // one REQUEST_SYNC + one CRISIS_SYNC
}
```

```ts
// UI: hash-and-diff, and patch instead of innerHTML
let lastPlayerHash = '';
function onPlayerSync(p: PlayerMsg) {
  const h = hashPlayer(p);
  if (h !== lastPlayerHash) { lastPlayerHash = h; patchPlayerUI(p); }
}
```

### Refactor R4: One campaign state, owned by the worker (P1-7/P2-4)

**Target:** `src/ui/windows/InfluenceWindow.ts:21-95,237-238`, `src/ui/windows/RealmWindow.ts:22-32`, `src/engine/sim.worker.ts:267-284`
**ROI:** Removes ~700 LOC of mock/local state and makes Ages, missions, built works, and victories real, saveable systems.

```ts
// Worker
interface CampaignState { influence: InfluenceState; missions: MissionsState;
  builtWorks: BuiltWorksState; victories: CampaignVictoryState; age: AgeProgressState; }
// after every advance/resolve: ctx.postMessage({ type: 'CAMPAIGN_SYNC', campaign });
// save: SerializedWorldSave.campaign = campaign;
// UI: const c = state.campaign; render(c.influence...); send({type:'CONSTRUCT_BUILT_WORK', id});
```

### Refactor R5: Worker error boundary (P1-4)

**Target:** `src/engine/sim.worker.ts:469`, `src/main.ts:106-108`
**ROI:** Converts every unrecoverable sim error into a visible, recoverable state instead of a silent frozen UI.

```ts
function safeHandle(command: Command): void {
  try { handle(command); }
  catch (err) {
    ctx.postMessage({ type: 'SIM_ERROR', command: command.type,
      message: err instanceof Error ? err.message : String(err) });
  }
}
ctx.onmessage = (e) => safeHandle(e.data);
state.worker.onerror = (e) => showSimError(e.message);   // + "Start new world" button
```

---

## 5. Phased Execution Roadmap & Scoped Agent Prompts

1. **Phase 1 — Containment (P0 + state-loss P1s).** Autosave throttle (R1), save fidelity (R2), SAB capability guard (P1-6). Add MVTH 1–2. Gate: save/restore a hot, closed, electrified vessel and reload; confirm temperature/heater/volts/lid survive.
2. **Phase 2 — Tick budget & resilience.** Coalesce syncs (R3), error boundary (R5), consume-before-validate (P1-5), vessel cap (P1-8), gzip cap (P1-9). Gates: March ×8 → ≤2 sync messages and no frame drop; malformed import → visible `SIM_ERROR`; 33rd vessel rejected.
3. **Phase 3 — Wiring honesty & structure.** Campaign single source of truth (R4), delete mock/dead modules, fix map CSS/touch/DPR, keyboard/ARIA fixes, split `sim.worker.ts` into command modules. Gate: an import-graph test proves every launcher window reads worker state and sends commands.

### Copy-Paste Surgical Prompts for Coding Agents

> **Prompt [P0-1] (`src/app/autosave.ts`):** "Strictly scope edits to `src/app/autosave.ts` and a new `tests/autosaveScheduler.test.ts`. Do not modify any other file. Replace the re-arming `setTimeout` debounce in `requestAutoSave()` with a leading-edge throttle that never clears a pending timer on subsequent calls and enforces a 2,000 ms minimum interval. Expand the dirty signature to include inventory, colony, and vessel state. Add the MVTH-1 fake-timer test (10 s of 100 ms `PLAYER_SYNC` → ≥1 write, ≤1 per 2 s) and prove it fails against the current implementation before fixing."

> **Prompt [P1-1] (`src/app/autosave.ts` + `src/engine/worldRestore.ts`):** "Strictly scope edits to those two files and `tests/saveFidelity.test.ts`. Serialize every `VesselState` field (`headspaceClosed`, `temperatureK`, `pressureKPa`, `heaterWatts`, `condenserTargetVesselId`, `appliedVolts`, `cellResistanceOhm`, `ruptured`, `precipitated`) and restore them with finite-number clamps. Accept legacy `closed` as an alias. Add a deep-equal round-trip test; require it to fail on the pre-fix tree (temperature dropped) before restoring the fix."

> **Prompt [P1-2/P1-3] (`src/engine/sim.worker.ts` + `src/app/workerMessages.ts` + `src/app/panels.ts`):** "Do not change simulation math. Add a worker batch depth so `advance()` emits exactly one `REQUEST_SYNC` and one `CRISIS_SYNC` after the loop. In the UI, hash `PLAYER_SYNC`/`COLONY_SYNC` payloads and skip identical renders; skip `renderDock()` when the strategy container is hidden. Add `tests/advanceBudget.test.ts` asserting ≤2 syncs for `ADVANCE 192` and a test that two identical `PLAYER_SYNC` messages cause zero additional DOM writes."

> **Prompt [P1-4] (`src/engine/sim.worker.ts` + `src/main.ts`):** "Wrap the entire command switch in a `try/catch` that posts `{type:'SIM_ERROR', command, message}` and leaves the worker alive. Add `worker.onerror` in `startWorld` with a visible recovery card. Add `tests/workerResilience.test.ts` for `LOAD_WORLD` with `vessels:[null]`, unknown material, and `temperatureK:NaN`, asserting a `SIM_ERROR` and that a subsequent `INIT` still reaches `READY`."

> **Prompt [P1-7] (`src/ui/windows/InfluenceWindow.ts`, `RealmWindow.ts`, `src/engine/sim.worker.ts`):** "Delete every `mock*`/`localVictoryState` object. Add a single `CampaignState` owned by the worker, send it via `CAMPAIGN_SYNC`, persist it in `SerializedWorldSave`, and render both windows from `state.campaign`. Wire `FOUND_SETTLEMENT`, `PLACE_DISTRICT`, and `START_BLACKSMITH_BATCH` to UI controls. Add an import-graph test proving each launcher window imports its engine module and contains no mock state."

---

## 6. Verification Appendix

### Commands Run (read-only vs source)

```bash
git status --porcelain                          # clean at start; 259 tracked files
git rev-parse HEAD                              # 1fee8ba338c181a9e262b327e71c52681410b729
npx tsc --noEmit                                # 0 errors
npx vitest run                                  # 62 files, 312 tests, all pass (9.92 s)
rm -rf dist && npm run build                    # green; Entrypoint main 193 KiB
                                                # reported entrypoint sum: 197,202 / 200,000 bytes (98.6%)
python3 preflight_telemetry.py <repo>           # 170 files, 23,931 effective LOC
python3 dead_export_sweep.py <repo> --src src   # 0 test-only exports; dead UI modules listed
python3 import-graph scan                       # 11 engine modules with zero production importers
node /tmp/opencode/audit/autosave_sim.js        # 10 s active = 0 writes; pause + 2.5 s = 1 write
git diff --stat HEAD                            # empty (VERIFIED ZERO TRACKED MUTATION)
git status --porcelain                          # only the pre-existing untracked user plan
```

### Zero-Mutation Statement

- **Tracked source/config/test files modified: 0.** `git diff HEAD` is empty; HEAD is unchanged.
- The scanner digest changed between pre and post **only** because an untracked user-authored file appeared during the session: `docs/plans/OPTIONAL implementation_plan.md` (10,037 bytes, mtime `2026-11-05 17:28:25`, created by an external process, not by this audit). It was not read into scope, edited, or committed.
- `dist/` was deleted and rebuilt to verify the bundle budget; it is gitignored and untracked. No source file was touched.
- The only addition from this audit is this report.

### Delta vs the 2026-11-03 Audit

| Prior finding | Status at `1fee8ba` | Evidence |
| :--- | :--- | :--- |
| P1-1: unguarded `readSnapshot` kills rAF | **Fixed** | `src/main.ts:71-88` try/catch, loop always re-registers |
| P1-2: Import reports success but restores nothing | **Fixed** | `LOAD_WORLD` handler + `startWorld({load})` |
| P2-6: silent command drops / no exhaustive dispatch | **Fixed** | `assertNeverCommand` + handlers for `EQUIP_TOOL`/`HARVEST_PART` |
| P3-6: paddock never stepped | **Fixed** | `sim.worker.ts:343-368` daily `stepPaddockDay` |
| P2-5: `main.ts` God file | **Fixed** | split into `src/app/{state,autosave,panels,views,workerMessages,launcher,splash}.ts` |
| `worker.onerror` absent | **STILL OPEN (recurrence)** | no `onerror`/`onmessageerror` anywhere in `src` |
| innerHTML escaping / XSS pattern | **STILL OPEN** | `renderLog` `innerHTML` with unescaped messages; `renderVessels` with save `label` |
| — | **New P0/P1 debt** | autosave starvation, thermal-state loss, 10 Hz DOM churn, mock campaign layer, vessel ceiling, gzip bomb |

**Bottom line:** the engine and the previous audit's P1 fixes are real, but the Civ VII conversion added a large, tested, **unreachable/mocked** campaign layer on top of a save path that no longer preserves what the simulation computes. Restore state ownership first; wire or delete the campaign surface second; then re-run this audit to re-score.
