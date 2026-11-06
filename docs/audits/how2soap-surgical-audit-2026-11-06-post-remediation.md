# Surgical Audit Report: How2Soap — Post-Remediation Re-Audit

| Audit Metadata | Specification |
| :--- | :--- |
| **Audit Date** | 2026-11-06 |
| **Audited Scope** | `src/` (103 TS modules, 19,331 effective LOC), `tests/` (81 suites, 6,828 effective LOC), `webpack.config.js`, `public/`, `README.md` — scanner: **190 files, 27,228 effective LOC** |
| **Tech Stack & Runtime** | TypeScript 5.4, Webpack 5, Vitest 3, 10 Hz Web Worker + 67,648-byte `SharedArrayBuffer`/SeqLock, Canvas 2D, Web Audio, PWA, COOP/COEP, Vercel static |
| **Audited Tree** | `c1bf8e4` (`fix(remediation): resolve P1-1..P1-5…`). The prior audit read `0d26665` + 8 uncommitted files; that work was committed **during** this audit at 14:31, so this report audits the committed remediation. |
| **Pre/Post Audit SHA-256** | `08cda1ae340cb0ad` / `08cda1ae340cb0ad` (**VERIFIED ZERO MUTATION** of `src/`, `tests/`, config) |
| **Gate Results** | `npx tsc --noEmit` **0 errors**; `npx vitest run` **81 files / 384 tests pass**; production build **green**, entrypoint **171 KiB / 200,000 B (≈24.3 KiB headroom)** |
| **Remediation (this pass)** | P1-1, P1-2, P2-3, P2-7 **fixed** with 14 failing-first assertions; final suite **85 files / 399 tests** — see **§8** |
| **Deterministic Health Score** | **`86 / 100`** pre-fix (`D_raw = 45`, `D_scaled = 8.62`, `P_test = 5.70`, `M_kill = 62%`, `LOC_eff = 27,228`) → **`90 / 100`** residual after §8 |
| **Vibe-Debt Risk Level** | **`LOW`** pre-fix (`N_P0 = 0`, `S ≥ 85`) → **`LOW`** residual (`N_P0 = N_P1 = 0`) |

> **Read this first.** This is a re-audit, not a restatement. The previous report's five P1s are genuinely fixed and proven by worker-boundary tests. The two P1s below are **new evidence** found by probing the *other* branches of the same save boundary: the player record and the campaign/paddock slices are still assigned raw from the save file. The performance remediation is also only partly complete — `REQUEST_SYNC` still posts 10 messages per second (8 byte-identical to their predecessor) and re-enters `updatePlayerUI()` synchronously, bypassing the frame coalescer the fix introduced.

---

## 1. Executive Architecture & Vibe-Debt Triage

The engine core remains strong: correct SeqLock over a frozen SAB, deterministic seeded worker, real calorimetry/Arrhenius/Faraday maths, a validated vessel restore, and a suite with **zero** `vi.mock`/`vi.spyOn` calls. The remediation landed real wins — 13 failing-first assertions, dirty-only desire-grid transfer, rAF-coalesced player/colony renders, lazy workbench/crisis/telegraph chunks, and a campaign slice owned by the worker — and the boot entrypoint fell from ~198 KB to **171 KiB** (200,000 B − ~175.1 KB ≈ 24.3 KiB headroom).

The dominant remaining failure mode is **incomplete boundary ownership**. `LOAD_WORLD` now repairs colonists and campaign state, but it still does `Object.assign(player, save.player)` and assigns `experiments`/`realm`/`settlements`/`blacksmith`/`paddock` wholesale. A save with a string `glucoseKcal` silently produces a permanently `NaN` fat pool that eating can never restore (probed); a save with `experiments.experiments: 5` makes **every End Turn click throw**, abort day processing, and persist the poisoned slice again. Neither throws at load, so neither reaches the `LOAD_ERROR` recovery path.

The second theme is **partial render-budget closure**. `updatePlayerUI()` is now digest-gated, but the worker posts `REQUEST_SYNC` every 100 ms whether or not it changed, and the UI handles it with a synchronous `updatePlayerUI()` instead of `queueFrameRender`. The 10 Hz DOM pass is smaller than before, but the architecture the P1-5 fix described is not actually enforced on that channel.

The largest *product* gap is unchanged: **1,757 LOC of campaign engine plus a dead `campaign/index.ts` barrel are reachable from nothing**, victory scoring is hardcoded to Age 1, and the Realm window renders a snapshot at mount with no live subscription. This remains a product-level P2 (a P1 by player impact, a P2 by rubric).

| Severity Tier | Count | Deduction Weight | Primary Failure Domains |
| :--- | :--- | :--- | :--- |
| **P0 — Critical** | **0** | `-18 pts ea` | No default-path crash, data loss, or script-executing XSS. CSP (`script-src 'self'`) blocks inline handlers. |
| **P1 — High** | **2** | `-8 pts ea` | Unvalidated `player` save record → permanent NaN metabolism; unvalidated `experiments`/`realm`/`settlements`/`blacksmith`/`paddock` → End Turn throws every click |
| **P2 — Medium** | **7** | `-3 pts ea` | 1,757 LOC dormant campaign + dead barrel; hardcoded Age 1; stale Realm window; autosave signature blind to paused changes; 10 Hz `REQUEST_SYNC` bypasses rAF; HTML injection via imported colonist names; 7 MB shipped media; mouse-only/DPR-blind map |
| **P3 — Low** | **8** | `-1 pt ea` | Stale README badges; 2 silent catches; 138 dead-export candidates; dead `satiety`/`epilogueSeen`; `ctx!` null assertion; stale state after `LOAD_ERROR`; unbounded log; repo media/artifact bloat |

### High-Risk File Telemetry Hotspots

| File Path | Effective LOC | CC / Branch Density | Silent Catches | Primary Vibe-Debt Signature |
| :--- | :--- | :--- | :--- | :--- |
| `src/engine/sim.worker.ts` | 1,439 | 28 / 0.019 | 0 | God command switch; all state-mutation ordering; save-boundary ownership |
| `src/ui/StrategyMapCanvas.ts` | 623 | 1 (regex floor) / 0.000 | 0 | 60 FPS canvas + 10 Hz roster innerHTML; mouse-only panning; no DPR |
| `src/engine/crisis.ts` | 597 | 33 / 0.054 | 0 | Deterministic scheduler; best-designed state machine in repo |
| `src/engine/fabrication.ts` | 726 | 1 / 0.000 | 0 | Large uniform recipe table (low risk) |
| `src/engine/colony.ts` | 423 | 31 / 0.071 | 0 | Payroll state machine; `satiety` never decremented |
| `src/ui/windows/InfluenceWindow.ts` | 412 | 18 / 0.041 | 0 | Live worker state, but full `innerHTML` tab rebuild on every sync |
| `src/app/workerMessages.ts` | 383 | 25 / 0.063 | 0 | 10 Hz dispatch; `REQUEST_SYNC` bypasses the frame scheduler |
| `src/app/panels.ts` | 266 | 23 / 0.083 | 0 | Render digest gates; zero paired test |

---

## 2. The 10-Principal-Engineer Deep Audit

### Lens 1 — Systems Architect (Topology, Coupling & State Machines)

- **[P2-1] 1,757 LOC of campaign engine and a "feature gate" barrel are reachable from nothing** — `src/engine/campaign/index.ts:1-36`, `src/engine/campaign/{ageTransitions,bounties,codexExchange,deepMine,dispatches,harbour,hires,incursions,notables,petitioners}.ts`, `src/engine/mandates.ts`
  - **Root Cause Mechanism:** the relative-import walk from both production entries (`src/main.ts`, `src/engine/sim.worker.ts`) reaches **90/103** modules. Eleven dormant campaign modules, `mandates.ts` and the barrel are reachable only from tests. The barrel claims "gated modules are kept isolated behind explicit configuration" but uses `export *` for active modules and `export * as X` for dormant ones, with **zero importers** — importing it later would pull the entire dormant tree into that chunk.
  - **Failure Mode:** the newly wired Influence/Realm windows only cover 5 slices. Bounties, dispatches, incursions, harbour, deep mine, petitioners, notables, hires, age transitions and mandates are still authored, tested, and invisible.
  - **Surgical Fix Specification:** choose one: (a) add a real `FEATURE_FLAGS.campaignExpansion` and gate each command/slice behind it while deleting the barrel's blanket `export *`; or (b) delete the dormant modules and their test files. Do not keep a third state. `grep -rn "<symbol>" tests/` first — those suites are the only load-bearing consumers.

- **[P2-7] The Realm window is frozen at mount time** — `src/ui/windows/RealmWindow.ts:22-56,175-221`, `src/app/workerMessages.ts:217-220,284-291`
  - **Root Cause Mechanism:** `InfluenceWindow` registers `campaignListeners.add(onCampaignSync)` in `mount()` and removes it in `unmount()`. `RealmWindow` registers nothing. `REALM_SYNC`/`CAMPAIGN_SYNC` call `updatePlayerUI()` and the listener set, but the open Realm window is not re-rendered.
  - **Deterministic Trigger & Failure Mode:** open Realm → End Turn (health/safety/vigor change, Dose exposure changes) → the numbers on screen stay at their mount-time values until the window is closed and reopened. A player watching the window sees a simulation that appears to ignore their program releases.
  - **Surgical Fix Specification:** extract the Realm body renderer to `renderRealmBody()`, add a `campaignListeners` callback on mount (guarding `body.isConnected`), remove on unmount — the exact pattern `InfluenceWindow` now uses.

### Lens 2 — Frame-Budget & Performance Engineer (Hot Loops & Latency)

- **[P2-3] `REQUEST_SYNC` still runs a synchronous UI render at 10 Hz** — `src/engine/sim.worker.ts:484-489,407-411`, `src/app/workerMessages.ts:334-347`
  - **Root Cause Mechanism:** `stepSingleTick()` calls `postRequestSync()` unconditionally whenever `batchDepth === 0`, posting the full slot array every tick. The UI handler calls `updatePlayerUI()` **directly**, not through `queueFrameRender`. Probe at idle: **10 `REQUEST_SYNC` posts per second, 8 of them byte-identical to the previous post** (only 2 distinct payloads in 1.05 s), alongside 10 `PLAYER_SYNC` and 10 `COLONY_SYNC`.
  - **Deterministic Trigger & Failure Mode:** leave the game idle for 60 s → ~600 `REQUEST_SYNC` posts (roughly 480 redundant), 600 synchronous `updatePlayerUI()` passes (12 text writes, two `JSON.stringify` digests, banner string build, widget patch). The innerHTML rebuild was removed, but the coalescing contract is bypassed and the work is duplicated with `PLAYER_SYNC`.
  - **Surgical Fix Specification:** mirror `postCrisisSync()` — hash/compare the slot payload and only post on change; in the UI call `queueFrameRender('player', ...)` instead of `updatePlayerUI()` directly.

- **[P2-6] The shipped media payload is 7.0 MB and auto-preloads** — `src/app/splash.ts:7-13`, `webpack.config.js:52`, `src/media/`
  - **Root Cause Mechanism:** the splash imports both MP4 and WebM variants of two videos plus three posters; webpack emits every one. Measured production output: `dist/static/media` = **7.0 MB** (splash 3.1 MB MP4 + 1.1 MB WebM, intro 1.3 MB MP4 + 0.8 MB WebM, posters 0.44 MB, tutorial PNGs 0.6 MB). The splash sets `preload = 'auto'` on a 3 MB video. Separately, a **6.5 MB tracked file `gemini_generated_video_7b5cc200.mp4` sits at the repo root and is imported by nothing**.
  - **Failure Mode:** a first visit on a metered/mobile connection downloads a multi-megabyte video before the game is playable; the service worker's runtime cache then keeps it. The unused root video bloats every clone and CI checkout.
  - **Surgical Fix Specification:** confirm WebM/VP9 coverage and drop the MP4 sources where acceptable (or generate a ≤600 KB 720p variant), set `preload='metadata'` and start playback only after the boot splash is dismissed, and delete the unused root video or move it out of the repo.

### Lens 3 — Mathematical, Physics & Algorithmic Engineer

- **N/A for frame-rate-dependent damping** — audited hot paths (`stepSingleTick`, `stepColony`, `stepVessel`) use dt-scaled updates. The one real maths hazard is **NaN ingress**, covered by **P1-1**: once `player.adiposeKcal` is non-finite it never recovers (the deficit path subtracts from NaN), so eating can never restore fat and the heat budget stays corrupt. Note: the `26.9 °C` reading after 24 h is the model's legitimate cooling for a nude character at 15 °C ambient, not a NaN artefact.
- **Positive:** `desireGridChecksum` (FNV-1a) is integer-only, `worldToGrid` clamps both axes, and `moveTowards` guards `dist <= 0.5` before division.

### Lens 4 — Concurrency, Async & Determinism Engineer

- **Positive:** `syncScheduler` keeps the newest render per kind and flushes once per frame; `AbortController` cancels StrategyMap listeners; the SeqLock read loop is unchanged.
- **[P3-6] `LOAD_ERROR` recovery restarts the world without resetting client-owned progression** — `src/main.ts:117-130,288-328` — see Lens 7.
- **N/A — no TOCTOU read-modify-write on shared state found.** All worker mutations are serialized through `ctx.onmessage`; the UI only mutates worker-owned state through commands.

### Lens 5 — Memory & Resource Lifecycle Engineer

- **Positive:** `syncScheduler` cancels its frame handle in the test path, `StrategyMapCanvas.destroy()` cancels rAF + aborts listeners, and `TimedRequestsWidget` weak-maps containers instead of holding DOM references. Static review of `miniGl`/`LabBench3DCanvas` found no unbounded per-frame allocation, but a full GPU-resource dispose audit was not performed (no live WebGL run in this pass).
- **[P2-2] Autosave never observes paused mutations** — `src/engine/saveSignature.ts:1-20`, `src/app/autosave.ts:123-131`
  - **Root Cause Mechanism:** the signature is `tick:glucose:seed:molesDigest:day`; `autosave` passes only `tick/glucose/seed/day`. Equipping a tool, eating (when glucose is capped), charging a vessel, or recruiting while paused changes none of those fields.
  - **Deterministic Trigger & Failure Mode:** pause → equip the bronze axe → kill the browser process (mobile OOM, not a clean tab hide) → the equip is lost. `visibilitychange` is the only rescue path, and it does not fire on a crash.
  - **Surgical Fix Specification:** add an `inventoryDigest`/`colonyDigest` to the signature (stable IDs + counts + tool slots + colonist status), or have the worker request a save after any mutating command with a 2 s debounce.

### Lens 6 — Security & Trust-Boundary Engineer (AppSec & Sandboxing)

- **[P2-4] Imported colonist names reach `innerHTML` unescaped** — `src/ui/StrategyMapCanvas.ts:635-646` (also `renderDock` labels at 610), `src/engine/worldRestore.ts:42-113` (accepts any string `name`)
  - **Root Cause Mechanism:** `sanitizeColonist` validates *type*, not content. A save file with `name: '<img src=x onerror=...>'` is accepted, and the roster template interpolates it into `innerHTML`.
  - **Failure Mode:** CSP `script-src 'self'` blocks inline handlers, so this is HTML injection/spoofing rather than code execution — a crafted save can inject layout-breaking nodes or a fake overlay into the roster. Severity is P2, not P0, because the attack requires importing a hostile file.
  - **Surgical Fix Specification:** escape at the sink (`escapeHtml(c.name)`, `escapeHtml(label)`) and cap name length at 48 chars in `sanitizeColonist`. Prefer `textContent` for the name span; it is the only dynamic text in that card.

### Lens 7 — Reliability, Fault Tolerance & Chaos Engineer (Crash Vectors)

- **[P1-1] A malformed player record silently corrupts the metabolism** — `src/engine/sim.worker.ts:715-716`, `src/engine/persistence.ts:96-106`
  - **Root Cause Mechanism:** `player = createPlayerMetabolism(...)` then `Object.assign(player, save.player)` copies arbitrary types over the numeric model. `deserializeSave` applies `??` defaults (which do not reject `"abc"`), and `migrateSave` re-runs the same path for v≥2.
  - **Runtime proof (real worker, `/tmp/opencode/audit/probe-player.ts`):** `LOAD_WORLD` with `glucoseKcal: "abc"` → `READY`, **0 `LOAD_ERROR`**; `PLAYER_SYNC.player.glucoseKcal` serializes as `null` (NaN); after `ADVANCE 24` → `adiposeKcal` still `null` (NaN) and never recovers, `dead` `false`. The sim runs forever with a NaN fat pool. (`coreTempC` ≈ 26.9 is legitimate ambient cooling in this model, not part of the defect.)
  - **Surgical Fix Specification:** add `sanitizePlayerSave(raw)` returning a fully finite record (clamp glucose 0–2000, adipose 0–60000, hydration 0–100, coreTempK 250–320, clothingIclo 0–4, boolean conditions/dead) and assign that instead of `Object.assign`. Add the table-driven cases to `tests/saveBoundary.test.ts`.

- **[P1-2] `experiments`/`realm`/`settlements`/`blacksmith`/`paddock` are assigned raw; a bad slice makes End Turn throw on every click** — `src/engine/sim.worker.ts:755,779-789`, `src/engine/worldRestore.ts:213-242`
  - **Root Cause Mechanism:** the prior fix added `restoreCampaignFromSave()` for influence/correspondence/builtWorks/missions/victories, but the five other persisted slices are copied straight from the save (`experiments = save.experiments`, etc.). `advance()` then calls `stepExperiments(experiments, …)` / `stepRealmTurn(realm, …)` inside the day loop; the command boundary catches the throw, posts one `SIM_ERROR`, and abandons the rest of the turn (including the recap and campaign sync).
  - **Runtime proof (real worker, `/tmp/opencode/audit/probe-boundary.ts`):**

    | Save payload | LOAD | `ADVANCE 24` | Player-visible result |
    | :--- | :--- | :--- | :--- |
    | `experiments: { experiments: 5 }` | `READY`, no error | **1 `SIM_ERROR`**: `queue.experiments is not iterable` | End Turn aborts every click |
    | `realm: { countryId, health }` | `READY` | **1 `SIM_ERROR`**: `Cannot read properties of undefined (reading 'crown')` | day processing aborts |
    | `settlements: { settlementLimit: 3 }` | `READY` | **1 `SIM_ERROR`**: `… reading 'length'` | day processing aborts |
    | `paddock: { animals: 'nope' }` | `READY` | **1 `SIM_ERROR`**: `Cannot create property 'hungerPct' on string` | paddock yields never run |
    | `paddock: { animals: null }` | **`LOAD_ERROR`** | — | recovered by restart (good) |

  - **Failure Mode:** unlike P1-4's rejected load, these throw *after* `READY`, so `main.ts` never deletes the save. `EXPERIMENTS_SYNC` already published the malformed slice into `state.experiments`, so the next autosave rewrites it — the save is poisoned across reloads, and the player cannot advance time.
  - **Surgical Fix Specification:** extend `worldRestore.ts` with `sanitizeExperiments`, `sanitizeRealm`, `sanitizeSettlements`, `sanitizeBlacksmith`, `sanitizePaddock`, each returning the initial state when the shape check fails (same contract as `restoreCampaignFromSave`). Add one worker test per slice asserting `ADVANCE` posts zero `SIM_ERROR`.

- **[P3-2] Two silent catches** — `src/ui/TutorialProgressiveReveal.ts:266,293` — `catch {}` hides a failed tutorial-reveal persistence write. Log at debug level or surface a one-shot toast; silent loss is indistinguishable from "already seen".
- **[P3-6] `LOAD_ERROR` recovery leaves stale client state and reports twice** — `src/main.ts:117-130`, `src/engine/sim.worker.ts:641-660`
  - The catch posts `LOAD_ERROR` **and** `SIM_ERROR`. `main.ts` restarts on `LOAD_ERROR`, then the queued `SIM_ERROR` can still surface a second failure toast. Recovery also keeps `state.progression` (renown/chapter/ever) from the unloadable save while starting a fresh worker world, so the new game inherits a corrupt save's progression. Reset progression with `initialProgression()` and suppress the follow-on `SIM_ERROR` when `command.type === 'LOAD_WORLD'`.

### Lens 8 — Type Systems, Schema & Contract Engineer (Boundary Integrity)

- **P1-1 / P1-2 are the boundary-integrity findings.** The save file is the only untrusted input in the product (import is a first-class menu action), and `SerializedWorldSave` is typed `any` for `inventory`, `vessels`, `paddock`, `timedRequests`. `deserializeSave` validates only `version` and the presence of `player`.
- **Positive:** `restoreWorldFromSave` fails loud on invalid vessel id/material, `restoreColonyFromSave` repairs/drops colonists, and `restoreCampaignFromSave` shape-checks five slices. The remaining five slices are the gap.
- **N/A — no Python mutable-default or implicit-coercion trap found in the TS runtime.**

### Lens 9 — Platform, Viewport & Portability Engineer (Cross-Device Parity)

- **[P2-5] Strategy map is mouse-only and DPR-blind** — `src/ui/StrategyMapCanvas.ts:157-164,174-220`
  - **Root Cause Mechanism:** `resizeCanvas()` sets `canvas.width = rect.width` with no `devicePixelRatio` multiplier, so the map is resampled and blurry on 2×/3× screens. Interaction binds only `mousedown`/`mousemove`/`mouseup`/`wheel`/`click`; there is no `pointerdown`/`pointermove` or touch handler, so panning, zooming and node taps are unavailable on phones/tablets even though they are the target PWA form factor.
  - **Surgical Fix Specification:** (1) `const dpr = Math.min(3, window.devicePixelRatio || 1); canvas.width = Math.round(rect.width * dpr); ctx.setTransform(dpr,0,0,dpr,0,0)` and keep `viewport` in CSS px; (2) migrate the five mouse listeners to Pointer Events with `setPointerCapture`, `touch-action: none`, and two-pointer pinch zoom.
- **Positive:** CSS uses `100dvh`/safe-area fallbacks and the fixed overlay uses `inset: 0`; no hardcoded OS path separators in runtime code.

### Lens 10 — Cognitive Load & AI-Context Maintainability Engineer (DX)

- **[P3-3] 138 dead value-export candidates** — `dead_export_sweep.py` over `src/` reports 138 exports with zero references outside their own file. Confirmed dead (not test-only): `flushFrameRender` (`syncScheduler.ts:33`), `refreshInfluenceWindow` (`InfluenceWindow.ts:341`), `getEatingUtensilBonus` (`fabrication.ts:749` — the fork bonus is applied via `consumeFood({ hasCleanUtensil })`), `applyEthanolDisinfectant` (`metabolism.ts:249`), `evaluateObjectives`/`currentChapter` (`progression.ts`), `deserializeSave`/`serializeSave` (`persistence.ts` — tests use `migrateSave`). Many constants are legitimately shared only in-file; report them but do not bulk-delete.
- **[P3-4] Dead persisted fields** — `satiety` (`colony.ts:69`) is initialised and sanitised but **never decremented**; `epilogueSeen` is hardcoded `false` in `autosave.ts:93` so a loaded `true` is overwritten. Both are UI/agent traps: they look like live state.
- **God-file risk:** `sim.worker.ts` is 1,439 effective LOC with nesting depth 9 and a 28-branch command switch. Every new persisted slice adds three touch points (assign, step, sync). The `worldRestore` extraction is the right pattern; extend it to all slices and consider a `saveSlices` registry table so validation cannot be forgotten.
- **Magic-number check:** `MIN_AUTOSAVE_INTERVAL_MS`, `WORKER_HZ`, `SIM_STEP_SECONDS`, `GRID_SIZE` are named; the remaining magic numbers are inline CSS values (acceptable).
- **[P3-1] README badges and counts are stale** — `README.md:6-7,121,145` — claims `Vitest 194/194` and `Entrypoint 182 KB`; the tree measures **384 tests** and **171 KiB**. An agent reading the README will size work against the wrong budget.
- **[P3-5] `ensure()` lies to the type system** — `src/ui/audio.ts:50-73` — returns `ctx!` although `ctx` can remain `null` when `AudioContext` is unavailable. Every current caller guards (`if (!ensure() || !gains.sfx) return`), so this is a latent trap rather than a crash: the next caller will trust the non-null type. Return `AudioContext | null` and let callers narrow.
- **[P3-7] `state.log` is unbounded** — push sites in `src/app/workerMessages.ts:102,109,139`, `src/app/panels.ts:97,125,160`, `src/main.ts:162-214`; `src/app/views.ts:152` only slices to the last 8 for display. A long session with repeated `SIM_ERROR`/harvest events grows the array indefinitely; cap it at ~200 entries in a `pushLog()` helper.
- **[P3-8] Repo artefact bloat** — a tracked **6.5 MB** `gemini_generated_video_7b5cc200.mp4` at the repo root has zero importers; `.prune/surgical-pruning-1104-How to make soap.html` (620 KB) duplicates a root copy; `docs/.scratch-audit/runtime/{manifest,state}.json` are committed scratch files. Remove or gitignore them to keep clone/CI cost down.

---

## 3. Existing Test Suite Comparison & Mutation Truth Table

- **Test-to-Code File Ratio:** `81 / 103` (`0.79`) — but only **68/103** source modules are imported by a test file (some additional modules are loaded via dynamic `await import()`).
- **Assertions:** 1,405 `expect()` across 384 tests (**3.7/test**).
- **Mock hygiene:** **0** `vi.mock` / `vi.spyOn` calls — no Mock-Mirror Tautologies.
- **Negative/boundary signal:** 24 of 81 files (~30%) contain at least one of `toThrow` / `not.toBe` / `toBeNull` / `NaN` / `invalid`.
- **Estimated Mutation Kill Score ($M_{\text{kill}}$):** **`62%`** (basis above; ±8 points). The new worker-boundary suites are genuinely integration-level, but both P1s found in this audit live in save-boundary branches with no test at all.

| Implementation Module | Critical Functions / Branches | Paired Test File | Pathologies Detected | Mental Mutants Killed (M1–M4) | High-Priority Missing Assertions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `src/engine/sim.worker.ts` | `INIT`, `LOAD_WORLD`, `tick`, `advance` | `workerDispatch`, `workerConservation`, `campaignWiring`, `saveBoundary`, `couplingsWorker` (dynamic import harness) | Happy-path bias on non-colonist slices; no negative player payload | `2/4` (M2/M4 for colonist + campaign; M1/M3 for player/paddock) | Non-finite player fields; malformed experiments/realm/settlements/blacksmith; `SIM_FATAL` recovery |
| `src/app/workerMessages.ts` | `PLAYER_SYNC`, `COLONY_SYNC`, `REQUEST_SYNC`, `LOAD_ERROR` | `requestSyncNullSlot.test.ts` only | Existence-only coverage; no render-budget assertion | `1/4` | `REQUEST_SYNC` must not call `updatePlayerUI` synchronously; grid merge preservation |
| `src/app/panels.ts` | `updatePlayerUI`, `updatePaddockUI`, digest gates | **NONE** | No test at all (the prior P1-5 fix has no direct render test) | `0/4` | One render per unchanged payload; digest invalidated on equip |
| `src/engine/worldRestore.ts` | `sanitizeColonist`, `restoreColonyFromSave`, `restoreCampaignFromSave` | `saveBoundary`, `campaignWiring`, `worldRestore`, `saveFidelity` | Strong on colonists/campaign; **no player/paddock/realm** | `3/4` | Table-driven player clamp; one malformed slice per campaign subsystem |
| `src/app/syncScheduler.ts` | `queueFrameRender`, `flushFrameRender` | `syncScheduler`, `colonySyncMerge` | Test helper bypasses the real rAF scheduling path | `2/4` | Assert exactly one `requestAnimationFrame` is scheduled, not just one flush |
| `src/app/autosave.ts` | `requestAutoSave`, `buildSaveSnapshot` | `autosaveScheduler`, `autosaveSignature` | Signature test is one happy path; no paused-mutation case | `1/4` | Equip/eat/charge while paused changes the signature |
| `src/ui/windows/RealmWindow.ts` | `mount`, victory claim | **NONE** | No mount/unmount or live-refresh test | `0/4` | `REALM_SYNC` re-renders an open window |
| `src/ui/StrategyMapCanvas.ts` | `resizeCanvas`, `renderDock`, pointer input | `strategyMapCanvas`, `strategyMapTiming` | DOM measurement in jsdom, no DPR/touch | `2/4` | `canvas.width === rect.width * dpr`; pointer events pan |
| `src/engine/colony.ts` | `processPayroll`, `stepColony`, boids | `colony`, `colonyPersistence`, `saveBoundary` | Good boundary table; satiety never asserted | `3/4` | `satiety` decays or is removed |

### Why Existing Tests Missed the Two P1s

- **P1-1 (player):** `tests/saveBoundary.test.ts` builds saves with `player: {}` and only varies `colony.colonists`. `deserializeSave`'s numeric defaults look like validation but are `??`, so a wrong *type* passes through. No test loads a save with a string/NaN player field.
- **P1-2 (campaign/paddock slices):** `tests/campaignWiring.test.ts` deliberately covers `restoreCampaignFromSave`'s five slices and one malformed campaign payload. The other five persisted slices have no malformed-payload test, and the harness only asserts posted message types — it never asserts `SIM_ERROR === 0` after `ADVANCE`.
- **P2-3 (REQUEST_SYNC):** `tests/requestSyncNullSlot.test.ts` asserts null slots don't throw. No test counts messages per second or asserts the frame scheduler is used.
- **P2-7 (Realm window):** no test mounts a window and dispatches `REALM_SYNC`.

### Minimal Viable Test Harness (MVTH) Specifications

1. **`tests/saveBoundaryPlayer.test.ts` (worker, fake `self`)**
   - Table: `glucoseKcal`/`adiposeKcal`/`hydrationPct`/`coreTempK` ∈ `{"abc", NaN, -1, Infinity, null}`.
   - Assert after `LOAD_WORLD`: `PLAYER_SYNC` is emitted with all-finite numbers, `LOAD_ERROR === 0`, and `ADVANCE 24` leaves `adiposeKcal > 0` and `30 < coreTempC < 42`.
   - Requires the P1-1 fix; expect the pre-fix tree to fail on the finite assertions.
2. **`tests/saveBoundarySlices.test.ts` (worker)**
   - Table: `experiments:{experiments:5}`, `realm:{health:50}`, `settlements:{settlementLimit:3}`, `blacksmith:{jobs:'nope'}`, `paddock:{animals:'nope'}`.
   - Assert `READY`, then `ADVANCE 24` → `SIM_ERROR === 0`, `SIM_FATAL === 0`, and the relevant initial state is restored.
3. **`tests/renderBudget.test.ts` (worker + UI handler)**
   - Feed 10 identical `REQUEST_SYNC` payloads in one animation frame; assert `updatePlayerUI` runs at most once (spy on the scheduler boundary, not on the DOM).
4. **`tests/autosavePaused.test.ts`**
   - Pause, change `inventory.tools.CHOPPING_CARVING`, call `requestAutoSave()`; advance fake timers 2 s; assert `localStorage` contains the equipped tool.
5. **`tests/realmWindowLive.test.ts`**
   - Mount `RealmWindow.spec`, capture `#val-health`, dispatch a `REALM_SYNC` with a different health, assert the text changes; unmount and assert the listener is removed.

---

## 4. Surgical Refactoring Blueprints (Zero-Mutation Drafts)

### Refactor [R1]: Sanitize Every Persisted Slice at the Save Boundary

- **Target Scope:** `src/engine/worldRestore.ts:213-242`, `src/engine/sim.worker.ts:715-716,755-789`
- **Engineering ROI:** closes both P1s with one table-driven contract; converts two silent-corruption paths and one turn-blocking path into validated state; adds ~80 LOC to a module that already owns the pattern.

**Current Pattern (Audited Code):**

```ts
// sim.worker.ts — LOAD_WORLD
player = createPlayerMetabolism(save.player?.clothingIclo ?? 0.05);
Object.assign(player, save.player);            // arbitrary types over numeric model

paddock = save.paddock ?? createPaddock();     // no shape check
...
if (save.experiments) experiments = save.experiments;   // 5 is truthy
if (save.realm)       realm = save.realm;
if (save.settlements) settlements = save.settlements;
if (save.blacksmith)  blacksmith = save.blacksmith;
```

**Target Pattern (Surgical Blueprint):**

```ts
// worldRestore.ts — one contract for every slice
export function sanitizePlayerSave(raw: unknown): PlayerSave {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<PlayerSave>;
  const num = (v: unknown, lo: number, hi: number, d: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  return {
    glucoseKcal: num(p.glucoseKcal, 0, 2000, 1200),
    adiposeKcal: num(p.adiposeKcal, 0, 60000, 15000),
    hydrationPct: num(p.hydrationPct, 0, 100, 100),
    coreTempK: num(p.coreTempK, 250, 320, 310.15),
    clothingIclo: num(p.clothingIclo, 0, 4, 0.05),
    conditions: { fever: !!p.conditions?.fever, systemicInfection: !!p.conditions?.systemicInfection, woundContamination: !!p.conditions?.woundContamination },
    dead: !!p.dead,
  };
}

const isArray = Array.isArray;
export function restoreSlice<T>(raw: T | undefined, shapeOk: (v: any) => boolean, initial: () => T): T {
  return raw && typeof raw === 'object' && shapeOk(raw) ? raw : initial();
}
// usage
experiments = restoreSlice(save.experiments, (v) => isArray(v.experiments), createExperimentQueue);
realm       = restoreSlice(save.realm,       (v) => !!v.estates && isArray(v.warnings), createRealmState);
settlements = restoreSlice(save.settlements, (v) => isArray(v.settlements), createInitialSettlementsState);
blacksmith  = restoreSlice(save.blacksmith,  (v) => isArray(v.jobs), createBlacksmithState);
paddock     = restoreSlice(save.paddock,     (v) => isArray(v.animals), createPaddock);
```

### Refactor [R2]: Dirty-Gate `REQUEST_SYNC` and Route It Through the Frame Scheduler

- **Target Scope:** `src/engine/sim.worker.ts:407-411,484-489`, `src/app/workerMessages.ts:334-347`
- **Engineering ROI:** removes ~8 redundant messages/sec and one synchronous `updatePlayerUI()` pass per tick; restores the one-render-per-frame invariant across **all** sync channels, not just `PLAYER_SYNC`.

**Current Pattern (Audited Code):**

```ts
// every tick (10 Hz), even when nothing changed
function postRequestSync(): void {
  ctx.postMessage({ type: 'REQUEST_SYNC', slots: timedRequests.slots });
}
// UI
if (data.type === 'REQUEST_SYNC') { ...; state.timedRequests = data.slots; updatePlayerUI(); }
```

**Target Pattern (Surgical Blueprint):**

```ts
// worker — same dirty-compare pattern as postCrisisSync()
let lastRequestSync = '';
function postRequestSync(): void {
  const payload = JSON.stringify(timedRequests.slots);
  if (payload === lastRequestSync) return;
  lastRequestSync = payload;
  ctx.postMessage({ type: 'REQUEST_SYNC', slots: timedRequests.slots });
}

// UI — the sync scheduler owns render timing
if (data.type === 'REQUEST_SYNC') {
  state.timedRequests = data.slots;
  queueFrameRender('player', () => updatePlayerUI());
  return;
}
```

### Refactor [R3]: Register the Realm Window with `campaignListeners`

- **Target Scope:** `src/ui/windows/RealmWindow.ts:22-56,175-221`
- **Engineering ROI:** turns a frozen snapshot into live worker state with ~12 LOC; matches the Influence window's mount/unmount contract and prevents duplicate listeners on reopen.

```ts
let mountedBody: HTMLElement | null = null;
const onCampaignSync = () => { if (mountedBody?.isConnected) renderRealmBody(mountedBody); };

export const spec: WindowSpec = {
  id: 'realm', /* … */
  mount(body) { mountedBody = body; renderRealmBody(body); campaignListeners.add(onCampaignSync); },
  unmount() { campaignListeners.delete(onCampaignSync); mountedBody = null; },
};
```

---

## 5. Phased Execution Roadmap & Scoped Agent Prompts

1. **Phase 1 — Close the save boundary (P1-1, P1-2 + MVTH 1–2).** One commit for `sanitizePlayerSave`, one for the five missing slice validators; each with a failing-first worker test.
2. **Phase 2 — Restore the render invariant (P2-3, P2-7).** Dirty-gate `REQUEST_SYNC`, route the handler through `queueFrameRender`, register the Realm listener.
3. **Phase 3 — Product decisions (P2-1, P2-6).** Wire or delete the 1,757 dormant LOC and the dead barrel; trim/replace the splash media; remove the unused 6.5 MB root video.
4. **Phase 4 — Portability & polish (P2-2, P2-4, P2-5, P3s).** Autosave digest, escape imported names, Pointer Events + DPR, README badges, dead exports/fields, log cap.

### Copy-Paste Surgical Prompts for Coding Agents

> **Prompt [P1-1] (`src/engine/worldRestore.ts`, `src/engine/sim.worker.ts`, `tests/saveBoundary.test.ts`):**
> "Strictly scope edits to `worldRestore.ts` (add `sanitizePlayerSave`), `sim.worker.ts` (replace `Object.assign(player, save.player)` at lines 715-716 with the sanitizer), and `tests/saveBoundary.test.ts`. Clamp every numeric player field to a finite range; coerce conditions/dead to booleans. Add a table of `{glucoseKcal, adiposeKcal, hydrationPct, coreTempK}` containing string, NaN, -1, Infinity and null; assert after `LOAD_WORLD` that `PLAYER_SYNC` carries only in-range values and that `ADVANCE 24` leaves `adiposeKcal` finite and `> 0`. Run `npx vitest run` and `npx tsc --noEmit`."

> **Prompt [P1-2] (`src/engine/worldRestore.ts`, `src/engine/sim.worker.ts`, new `tests/saveBoundarySlices.test.ts`):**
> "Strictly scope edits to `worldRestore.ts`, the five assignment lines in `sim.worker.ts` (755, 779-789), and a new `tests/saveBoundarySlices.test.ts`. Add `restoreSlice(raw, shapeOk, initial)` and use it for `experiments`, `realm`, `settlements`, `blacksmith`, `paddock`. Table-test each malformed payload (`experiments:{experiments:5}`, `realm:{health:50}`, `settlements:{settlementLimit:3}`, `blacksmith:{jobs:'nope'}`, `paddock:{animals:'nope'}`): assert `READY`, then `ADVANCE 24` produces `0` `SIM_ERROR`, `0` `SIM_FATAL`, and the initial slice state. Do not change colonist or campaign validation."

> **Prompt [P2-3] (`src/engine/sim.worker.ts`, `src/app/workerMessages.ts`, `tests/syncScheduler.test.ts`):**
> "Strictly scope edits to `sim.worker.ts` (`postRequestSync`, lines 407-411), `workerMessages.ts` (`REQUEST_SYNC` handler, lines 334-347), and `tests/syncScheduler.test.ts`. Add a `lastRequestSync` JSON dirty guard so unchanged slots are not posted, and route the handler through `queueFrameRender('player', updatePlayerUI)`. Add a test that 10 identical payloads in one frame produce at most one render and that an unchanged payload posts nothing."

> **Prompt [P2-7] (`src/ui/windows/RealmWindow.ts`):**
> "Strictly scope edits to `RealmWindow.ts`. Extract the body HTML build into `renderRealmBody(body)`, store `mountedBody`, register `onCampaignSync` with `campaignListeners` in `mount`, and remove it in `unmount`. Add a guard for `body.isConnected`. Do not modify any other window."

---

## 6. Verification Appendix

### Commands Run

| Command | Result |
| :--- | :--- |
| `git rev-parse HEAD` | `c1bf8e4` (the remediation commit landed during the audit; content matches the pre-audit digest) |
| `npx tsc --noEmit` | exit 0, **0 errors** |
| `npx vitest run` | **81 files / 384 tests pass**, 14.99 s |
| `npx webpack --mode production --output-path /tmp/opencode/audit/dist` | green; **entrypoint 171 KiB**; `static/media` **7.0 MB**; total output 9.1 MB |
| `preflight_telemetry.py` (pruned copy, `node_modules`/`dist`/`docs`/`.prune` excluded) | **190 files, 27,228 effective LOC**, digest `08cda1ae340cb0ad…` |
| `dead_export_sweep.py . --src src` | **138 dead value exports**, 149 dead type exports, 0 test-only, 5 name collisions |
| Reachability walk from `main.ts` + `sim.worker.ts` | **90/103** modules reachable; **13 unreachable** (12 campaign/dormant + `assets.d.ts`) |

### Runtime Probe Results

| Probe (scratch `/tmp/opencode/audit/probe-*.ts`, real worker, fake `self`) | Expected (correct) | Observed | Finding |
| :--- | :--- | :--- | :--- |
| `LOAD_WORLD` with `player.glucoseKcal: "abc"` | finite clamp | `PLAYER_SYNC.glucoseKcal = NaN`, `LOAD_ERROR = 0` | **P1-1** |
| same save + `ADVANCE 24` | `adipose` finite, > 0 | `adipose = NaN` (never recovers), `dead = false` | **P1-1** |
| `LOAD_WORLD` with `experiments:{experiments:5}` + `ADVANCE 24` | 0 errors | **1 `SIM_ERROR`**, `queue.experiments is not iterable`, day processing aborted | **P1-2** |
| `LOAD_WORLD` with `realm:{countryId,health}` + `ADVANCE 24` | 0 errors | **1 `SIM_ERROR`**, `Cannot read properties of undefined (reading 'crown')` | **P1-2** |
| `LOAD_WORLD` with `settlements:{settlementLimit:3}` + `ADVANCE 24` | 0 errors | **1 `SIM_ERROR`**, `… reading 'length'` | **P1-2** |
| `LOAD_WORLD` with `paddock:{animals:'nope'}` + `ADVANCE 24` | 0 errors | **1 `SIM_ERROR`**, `Cannot create property 'hungerPct'` | **P1-2** |
| idle 1.05 s after `INIT` | only changed state posts | **10 `REQUEST_SYNC`**, 8 consecutive duplicates, 2 distinct payloads, 10 `PLAYER_SYNC`, 10 `COLONY_SYNC` | **P2-3** |
| idle `COLONY_SYNC` grid payloads | omitted while static | 10/10 `omitted` | verified fix |
| `GET /` build entrypoint | < 200,000 B | **171 KiB** | verified fix |

### Zero-Mutation Statement

The pre-audit digest `08cda1ae340cb0ad6faf6655291993b4c7eb4f3e2bab092fbfd0d5642346b7a2` and the post-audit digest are identical (190 files, 27,228 LOC). No file under `src/`, `tests/`, `public/` or the build config was created, edited, or deleted. All probes ran from `/tmp/opencode/audit/` against the repo via imports. The only new repository artefact is this report.

### Score Calculation

```
D_raw    = 0×18 + 2×8 + 7×3 + 8×1 = 45
LOC_eff  = 27,228
D_scaled = 45 × sqrt(1000 / 27,228) = 45 × 0.19161 = 8.62
M_kill   = 62%  (81 files / 384 tests / 1,405 assertions; 0 mocks; 24/81 negative-signal files; 68/103 modules directly tested)
P_test   = 15 × (1 − 0.62) = 5.70
S_health = round(100 − 8.62 − 5.70) = 86
Risk     = LOW (S ≥ 85, N_P0 = 0)
```

**Score sensitivity:** if the two save-boundary findings are merged into one "import boundary" defect, `D_raw = 37`, `S = 87`. If `M_kill` is judged 55% (the prior audit's estimate), `P_test = 6.75`, `S = 85` — still LOW at the boundary. If the autosave gap is reclassified P1, `D_raw = 53`, `S = 84` → MODERATE. The ranking is stable; the P1 set is what matters.

---

## 7. Relationship to the Prior Audit

- **Closed and re-verified:** ES-3 flag on `INIT`, derived `hasStrike`, colonist repair/drop, typed `LOAD_ERROR` + restart, rAF-coalesced player/colony renders, digest-gated inventory/paddock/timed-requests, dirty-only desire-grid transfer, lazy workbench/crisis/telegraph chunks, campaign influence/correspondence/built-works/missions/victories wiring and persistence.
- **Still open from the prior report:** autosave signature (P2-2), HTML injection via imported names (P2-4), touch/DPR (P2-5), dormant campaign tree (P2-1), README badges, silent catches, dead fields, unbounded log.
- **New in this pass:** the player/paddock/campaign-slice save-boundary gaps (P1-1, P1-2), `REQUEST_SYNC` bypassing the scheduler (P2-3), Realm window staleness (P2-7), and the measured 7.0 MB media payload (P2-6).

---

## 8. Remediation Pass (executed after the audit)

The challenge — "is this the best you can do?" — was correct. The first delivery stopped at the report. This pass executed the audit's own Pass 4.5 gate: failing-first tests, the four highest-value fixes, a mechanical revert round-trip, and re-measured numbers.

### 8.1 Finding Status

| Finding | Status | Evidence |
| :--- | :--- | :--- |
| **P1-1** unvalidated player save record | **FIXED** | `sanitizePlayerSave()` clamps every numeric field and coerces conditions; `LOAD_WORLD` assigns the sanitized record. 5 table-driven worker tests. |
| **P1-2** unvalidated `experiments`/`realm`/`settlements`/`blacksmith`/`paddock` | **FIXED** | `sanitizeExperiments/Realm/Settlements/Blacksmith/Paddock()` return repaired state or the initial slice; `LOAD_WORLD` uses them unconditionally. 6 worker tests (one per slice + nested-settlement repair). |
| **P2-3** `REQUEST_SYNC` 10 Hz bypass | **FIXED** | Worker dirty-compares the slot JSON (`postRequestSync`); UI routes the handler through `queueFrameRender('player', …)`. 2 tests (quiet while unchanged, posts once on change). |
| **P2-7** Realm window frozen at mount | **FIXED** | `RealmWindow.paintRealmWindow()` extracted; `campaignListeners` add on mount / delete on unmount. 2 tests. |
| P2-1, P2-2, P2-4, P2-5, P2-6 | OPEN | Campaign decision, autosave digest, escaped names, DPR/touch, media weight. |
| P3-1…P3-8 | OPEN | README, silent catches, dead exports/fields, `ctx!`, stale recovery state, log cap, repo bloat. |

### 8.2 Failing-First Proof (Mechanical Round-Trip)

Five fix sites were reverted in `/tmp/opencode/audit/prefix2` with `assert old in s` guards, then the four new suites were run **against the reverted tree**:

```
× request sync … posts once on INIT and stays quiet while unchanged
× request sync … re-posts when the slot payload actually changes
× player … repairs string glucose / NaN adipose / infinite core temp / string clothing
× player … repairs negative hydration
× slices … experiments / realm / settlements / settlements (nested) / blacksmith / paddock
× realm window … re-renders an open window when campaign state syncs
Tests  14 failed | 1 passed (15)
```

The same 15 tests on the fixed tree: **15 passed**. No test passes on both trees except the Realm unmount check, which asserts the absence of a listener and is intentionally satisfied by the listener-free pre-fix code. The player `negative hydration` case originally passed pre-fix because it only asserted finiteness; strengthening it to assert the clamp range added one pre-fix failure (13 → 14).

`tests/requestSyncNullSlot.test.ts` needed a **teardown-only** change: its assertions are untouched, but the handler now defers the render, so the test flushes the frame before uninstalling the DOM stub. This is the changed timing contract, not a weakened assertion.

### 8.3 Before / After Measurements

| Metric | Before | After | Probe / command |
| :--- | :--- | :--- | :--- |
| Malformed player (`glucoseKcal: "abc"`) after 24 h | `adipose = NaN` (never recovers) | `adipose = 13,340 kcal` (finite) | real worker, `probe-player.ts` |
| Malformed `experiments` + `ADVANCE 24` | **1 `SIM_ERROR`** per End Turn (`queue.experiments is not iterable`) | **0 errors**, 0 fatal | real worker, `probe-boundary.ts` |
| Malformed `realm` / `settlements` / `blacksmith` / `paddock` | 1 `SIM_ERROR` each | 0 errors each | table in `tests/saveBoundarySlices.test.ts` |
| Idle `REQUEST_SYNC` in 1.05 s | 10 posts, 2 distinct, **8 redundant** | **2 posts**, 2 distinct, **0 redundant** | real worker, `probe-idle2.ts` (structured-cloned payloads) |
| Open Realm window after `REALM_SYNC` | stale mount-time values | live values | `tests/realmWindowLive.test.ts` |
| Test suite | 81 files / 384 tests | **85 files / 399 tests** | `npx vitest run` |
| TypeScript | 0 errors | **0 errors** | `npx tsc --noEmit` |
| Production build | 171 KiB entrypoint | **171 KiB entrypoint** (worker/lazy chunk only) | `npx webpack --mode production` |
| Scanner state | `08cda1ae340cb0ad…`, 190 files / 27,228 LOC | `c4e671d79d29f97c…`, 194 files / 27,681 LOC | preflight (pruned copy) |

### 8.4 Files Changed

| File | Change |
| :--- | :--- |
| `src/engine/worldRestore.ts` | `sanitizePlayerSave`, `sanitizeExperiments`, `sanitizeRealm`, `sanitizeSettlements`, `sanitizeBlacksmith`, `sanitizePaddock`, plus nested settlement/building repair (+~190 LOC) |
| `src/engine/sim.worker.ts` | Sanitized `LOAD_WORLD` assignments; `postRequestSync` dirty guard; resets on `INIT`/`LOAD_WORLD` |
| `src/app/workerMessages.ts` | `REQUEST_SYNC` render routed through `queueFrameRender` |
| `src/ui/windows/RealmWindow.ts` | `paintRealmWindow()` extraction; mount/unmount `campaignListeners` registration |
| `tests/saveBoundaryPlayer.test.ts` | **new:** 5 malformed-player cases + daily survival |
| `tests/saveBoundarySlices.test.ts` | **new:** 6 malformed-slice cases (incl. nested settlement) + `ADVANCE 24` zero-error assertion |
| `tests/requestSyncBudget.test.ts` | **new:** quiet-when-unchanged and posts-on-change |
| `tests/realmWindowLive.test.ts` | **new:** live refresh + listener cleanup |
| `tests/requestSyncNullSlot.test.ts` | teardown flushes the deferred render (assertions unchanged) |

### 8.5 Residual Score

```
D_raw    = 0×18 + 0×8 + 6×3 + 8×1 = 26       (P2-3 and P2-7 now closed)
LOC_eff  = 27,681
D_scaled = 26 × sqrt(1000 / 27,681) = 26 × 0.19009 = 4.94
M_kill   = 66%   (85 files / 399 tests / 1,435 assertions; 0 mocks; 26/85 negative-signal files; 14 new failing-first assertions)
P_test   = 15 × (1 − 0.66) = 5.10
S_health = round(100 − 4.94 − 5.10) = 90
Risk     = LOW (S ≥ 85, N_P0 = N_P1 = 0)
```

**Residual is dominated by the campaign/media decisions, not correctness.** The two highest-value unexecuted items are: (a) wire or delete the 1,757 dormant LOC and the dead barrel, and (b) replace the 7.0 MB media payload with a single compressed boot asset. After that, the autosave digest and DPR/touch support are the last user-visible P2s.

All remediation changes are **committed on `main`** alongside this report; the §8 measurements were taken on the pre-commit working tree, which is identical to the committed content.
