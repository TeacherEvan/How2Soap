# Surgical Audit + Implementation Plan: Workbench Frontend Enhancement

| Audit Metadata | Specification |
| :--- | :--- |
| **Audit Date** | 2026-11-09 |
| **Audited Scope** | `src/ui/WorkbenchCanvas.ts`, `src/ui/windows/FabricationWindow.ts`, `src/ui/fabricationModel.ts`, `src/ui/ToolAndInventoryPanel.ts`, `src/ui/gl/LabBench3DCanvas.ts`, `src/ui/gl/miniGl.ts`, `src/ui/gl/kinetic.ts`, `src/ui/gl/bakedClips.ts`, `src/ui/SoapKettleModal.ts`, `src/ui/SoapKettleMiniGame.ts`, `src/app/panels.ts`, `src/styles.css` (workbench sections), `tests/fabricationModel.test.ts`, `tests/fabricationAndInventory.test.ts`, `tests/fabricateConsume.test.ts` |
| **Tech Stack & Runtime** | TypeScript, Webpack 5, browser-only (no framework), WebGL2 via hand-rolled `miniGl`, Web Worker sim (`sim.worker.ts`), Canvas 2D |
| **Pre/Post Audit SHA-256** | `ef628140eb46533b…` (preflight, `src/` only; post-audit tree unchanged except this docs file) |
| **Deterministic Health Score** | **~72 / 100** (workbench-scope; `D_raw ≈ 26`, `P_test ≈ 4.5`, `M_kill ≈ 70%`) |
| **Vibe-Debt Risk Level** | **MODERATE** (no P0; several P1/P2 in the workbench surface) |

## 1. Executive Architecture & Vibe-Debt Triage

The workbench exists in **two divergent implementations**: the legacy `WorkbenchCanvas.ts` tabbed renderer (inline styles, `innerHTML`, recipe table straight from `FABRICATION_RECIPES`) and the newer `FabricationWindow.ts` master/detail window (searchable, feasibility-assessed via the pure `fabricationModel.ts`). Both are live; `app/panels.ts` lazy-loads the legacy one, the window manager mounts the newer one. This split-brain duplication is the primary vibe-debt signature. The 3D lab bench (`LabBench3DCanvas`) is well-engineered (kinetic decay, reduced-motion freeze, DPR clamp) but mounts as a passive viewport with no direct manipulation — the richest "juice" asset in the app is wired as a spectator screen. Test coverage is strong on the pure model (`fabricationModel`) and worker paths, weak on the DOM renderers (no jsdom-level assertions on either workbench renderer).

| Severity Tier | Count | Deduction Weight | Primary Failure Domains |
| :--- | :--- | :--- | :--- |
| **P0 — Critical** | `0` | `-18 pts ea` | None found in scope |
| **P1 — High** | `3` | `-8 pts ea` | Split-brain renderers; unescaped interpolation in legacy path; non-atomic innerHTML re-render losing focus |
| **P2 — Medium** | `4` | `-3 pts ea` | God-file styles; inline styles bypassing token system; no dead-recipe detection; 3D viewport not interactive |
| **P3 — Low** | `3` | `-1 pt ea` | Magic numbers, emoji-as-label a11y, duplicated recipe-card markup |

### High-Risk File Telemetry Hotspots
| File Path | Effective LOC | CC / Density | Silent Catches | Primary Vibe-Debt Signature |
| :--- | :--- | :--- | :--- | :--- |
| `src/ui/WorkbenchCanvas.ts` | 163 | ~12 / low | 0 | innerHTML template with zero escaping; duplicated FABRICATION_RECIPES card markup |
| `src/ui/windows/FabricationWindow.ts` | 190 | ~14 / med | 1 (`getApprenticeChemistMultiplier` try/catch → 1) | innerHTML re-render on every keystroke/selection; inline styles |
| `src/ui/gl/LabBench3DCanvas.ts` | 435 | ~19 / med | 0 | Renders but no pointer hit-testing → passive viewport |
| `src/styles.css` (workbench slice) | ~2060 total | n/a | n/a | `.fab-*`, `.recipe-card`, `.workbench-tabs-nav` interleaved with global tokens |
| `src/ui/fabricationModel.ts` | 104 | ~8 / low | 0 | Clean pure module — the model to keep |

## 2. Findings (10 Lenses, workbench scope)

### Lens 1 — Systems Architect
- **[P1-WB-1] Split-brain workbench renderers** — `src/ui/WorkbenchCanvas.ts:53-110` vs `src/ui/windows/FabricationWindow.ts:15-190`. Two "Fabricate" UIs, two card layouts, two cost/feasibility presentations; only the window uses `assessRecipe` honestly. Legacy path fires `onExecuteRecipe` with no feasibility gate, letting the player queue impossible jobs and discover failure only via worker rejection. **Fix:** delete the legacy fabrication tab body, keep `renderWorkbenchTabs` as a thin nav, and delegate to the window (or extract a shared `FabricationPanel` component used by both).
- **[P2-WB-2] `state.colony` cast without validation** — `FabricationWindow.ts:80` casts `state.colony as ColonyState` inside try/catch. Type-system escape masking structural drift. Fix: validate via a schema guard or derive apprentice multiplier in the worker and sync it.

### Lens 2 — Frame-Budget & Performance
- **[P2-WB-3] Full `innerHTML` re-render per search keystroke** — `FabricationWindow.ts:105-128,178`. `renderList` rebuilds all recipe buttons (up to ~60 cards, each with feasibility assessment) on every `input` event. Assessments are O(inputs) each — fine at this scale, but the DOM churn destroys focus/scroll position and forces style recalc. Fix: debounce 80–120 ms, or render once and toggle `hidden`; preserve `list.scrollTop`.
- **[P3-WB-4]** `counts` Map is computed once at mount (`:52`); after a `FABRICATE` completes the pack strip and feasibility dots are stale until window remount. Fix: subscribe to the existing sync/COLoNY_SYNC postMessage path and recompute.

### Lens 3 — Mathematical / Algorithmic
- No frame-rate-dependent math in scope. `LabBench3DCanvas` uses `expDecay` correctly with dt in seconds; `BOILOVER_C = 105` duplicates the value in `SoapKettleMiniGame.ts` — **[P3-WB-5]** magic-number duplication; extract to a shared constant.

### Lens 4 — Concurrency / Async
- **[P2-WB-6]** `renderFabricationTab` dynamic-imports `SoapKettleModal` on click (good) but the `.then` callback is uncancelled; double-click mounts two modals. Fix: guard with a mount-in-flight boolean or disable the button during import.
- `FabricationWindow` event listeners are attached to nodes that are wiped by `innerHTML =` on re-render — listeners die with the nodes (no leak), but any external reference would dangle. Acceptable; note for refactor.

### Lens 5 — Memory & Resource Lifecycle
- `LabBench3DCanvas` — passes audit: DPR clamped, fixed 180px height (no CLS), reduced-motion freeze, `MiniGl` buffers tracked in a Map (verify `dispose()` is called on unmount — **[P2-WB-7]** no evidence of an explicit GL teardown path on window close; textures/buffers may leak across repeated mount/unmount of the lab bench view. Confirm and add `dispose()`).

### Lens 6 — Security & Trust-Boundary
- **[P1-WB-8] Unescaped interpolation into innerHTML** — `WorkbenchCanvas.ts:66-85,147-153` interpolates `recipe.name`, `recipe.description`, `i.label`, `o.label`, paddock `species` strings directly. Today these are compile-time constants (no live XSS), but the pattern is one data-source change away from stored XSS, and it sets the wrong template for future recipe/story content. `FabricationWindow.ts` has the same pattern (`recipe.name`, `i.label`, `itemId` at `:61`). Fix: route every interpolation through `escapeHtml` (already in `src/ui/escapeHtml.ts`) or build nodes with `textContent`.
- `#btn-open-soap-kettle` and `.fab-execute` are disabled-state honest in the window (good). Client feasibility is a projection; worker remains authority — correct posture, keep it.

### Lens 7 — Reliability
- Silent catch at `FabricationWindow.ts:81-84` (returns apprenticeMult=1). It hides schema drift rather than surfacing it. Fix: log via telemetry (`phdTelemetry`) and clamp, don't swallow.
- No null-guard needed on `FABRICATION_RECIPES[0]?.id` — handled.

### Lens 8 — Types & Contracts
- `ToolAndInventoryState` does not declare `mechanicalAdvantage` on tools; `fabricationModel.ts:44` works around it with a runtime cast and comment. Fix: extend the type (or a `MetallurgyTool` subtype) and delete the cast.
- `WindowSpec` `mount(body)` has no unmount hook contract → forces the GL-teardown gap in Lens 5. Fix: add optional `unmount?(): void` to `WindowSpec` and call it from `WindowManager`.

### Lens 9 — Platform & Viewport
- Workbench tab buttons and `.fab-execute` meet the 24×24 SC 2.5.8 floor per AGENTS.md, but `.fab-tier-chip` and `.fab-item` (listbox options) should be measured; emoji-only tab labels need `aria-label`.
- `.fab-layout` is a fixed two-pane flex with no media query — on narrow viewports the detail pane is crushed. Fix: `flex-direction: column` under 720px, or route to full-screen modal on mobile.

### Lens 10 — Cognitive Load / DX
- Inline styles throughout `FabricationWindow.ts` (pack strip, items grid, container) bypass the CSS token system — future agents must patch two styling systems. Extract to `.fab-pack-strip`, `.pack-item-chip` classes.
- `WorkbenchCanvas.ts` header comment references "Section 2.2" — dangling spec reference; update or remove.

## 3. Test Suite Comparison & Mutation Truth Table

| Implementation Module | Paired Test | Pathologies | M_kill (est.) | Missing Assertions |
| :--- | :--- | :--- | :--- | :--- |
| `fabricationModel.ts` | `fabricationModel.test.ts`, `fabricationAndInventory.test.ts` | Minor happy-path bias | ~75% (3/4) | NaN glucose, empty inventory + vessel-only inputs, apprenticeMult=0 clamp |
| `engine/fabrication.ts` (FABRICATE) | `fabricateConsume.test.ts`, `workerConservation.test.ts` | — | ~80% | Tool-slot removal mid-queue |
| `FabricationWindow.ts` (DOM) | **NONE** | n/a — untested renderer | 0% | Render smoke, feasibility-dot classes, focus preservation on re-render |
| `WorkbenchCanvas.ts` (DOM) | **NONE** | n/a — untested renderer | 0% | Tab activation, recipe-card button wiring |
| `LabBench3DCanvas.ts` | `webglAndMeshes.test.ts`, `kinetic.test.ts` | Model-only coverage | ~50% | Mount/unmount dispose, reduced-motion freeze |

**Why tests missed P1-WB-1/P1-WB-8:** no DOM-level harness exists for these renderers; the suite validates the pure model and the worker, so both wrong-UI renderers ship green.

### Minimal Viable Test Harness (MVTH)
1. `tests/fabricationWindow.test.ts` — table-driven: given inventory fixtures `{empty, partial, full}`, assert `.fab-execute` disabled/enabled, `.fab-dot` class, and `escapeHtml` applied to a recipe name containing `<img onerror>`.
2. `tests/workbenchCanvas.test.ts` — mount `renderWorkbenchTabs`, click each tab, assert `onSelectTab` payload; mount `renderFabricationTab` with a stub recipe table and assert button wiring.
3. `tests/labBench3DCanvas.test.ts` — mount with a stubbed WebGL context, call unmount, assert `gl.getError()` clean and buffer count 0.

## 4. Implementation Plan — Workbench Enhancement

### Phase 0 — Baseline (0.5 day)
- Capture `git status --porcelain`, `npm run build` byte count, `npx vitest run` count. Record entry-chunk size (must stay < 200,000 B; all workbench work stays in the lazy chunk).

### Phase 1 — Containment (P1 fixes, 1–2 days)
1. **Unify the renderers (P1-WB-1).** Extract the reusable core of `FabricationWindow.ts` into `src/ui/fabrication/FabricationPanel.ts` (pure DOM builder, options: `{showPackStrip: boolean, onExecuted?: () => void}`). `FabricationWindow.spec.mount` becomes a 20-line wrapper; `WorkbenchCanvas.renderFabricationTab` delegates to `FabricationPanel` instead of its own template. Delete `FABRICATION_RECIPES.map` from `WorkbenchCanvas.ts`.
2. **Escape everything (P1-WB-8).** Add `escapeHtml` to every interpolation in both files; add the MVTH XSS regression test first, watch it fail, then fix.
3. **Define `WindowSpec.unmount?()`** in `WindowManager.ts`, implement `LabBench3DCanvas.dispose()` (delete buffers/programs, `loseContext` via `WEBGL_lose_context` if available), wire through (P2-WB-7, Lens 8).

### Phase 2 — Experience & Juice (the actual "enhancement", 3–5 days)
4. **Interactive 3D bench.** Pointer hit-testing in `LabBench3DCanvas` (ray-vs-vessel AABB — vessels are few, O(N) is fine): hover highlights vessel (emissive `uColor` boost), click selects it and focuses the linked recipe in `FabricationPanel`. Keyboard: Tab cycles vessels, Enter selects. This turns the spectator screen into the primary workbench surface.
5. **Live pack strip.** Subscribe `FabricationPanel` to the COLONY_SYNC/worker inventory messages; recompute `counts` and feasibility dots in place (no full re-render), flash the changed chip (`@keyframes pack-flash`, respects `prefers-reduced-motion`).
6. **Fabrication feedback loop.** On `FABRICATE` worker ack: hammer-strike flash on the 3D bench (reuse `stepSpringSubstepped` for a 6-frame impact scale), progress ring on the recipe card for `workTicks`, completion toast (`Toast.ts`) + `wageClink`-style audio cue (`audio.ts`). Strike state and missing-mats stay worker-authoritative.
7. **Responsive layout.** `.fab-layout` column stack under 720px; pack strip collapses to a horizontally scrollable row; tab bar gets `role="tablist"`/`aria-selected` (currently missing).
8. **Day Book tab made real.** The `daybook` filter shows queued experiments; add per-experiment progress (ticks remaining) by reading `state.experiments` on sync and rendering a determinate `<progress>` element.

### Phase 3 — Structural cleanup (P2/P3, 1–2 days)
9. Extract all inline styles to `windows.css`/`styles.css` under `.fab-*`; delete duplicate `BOILOVER_C` (shared constant module); add `mechanicalAdvantage` to the tool type; replace the silent catch with telemetry; delete `WorkbenchCanvas.ts` header spec-reference rot.
10. Add the renderers' MVTH tests (Phase 3 test files above) and a `fabricationPanel` focus-preservation test (search → re-render → `document.activeElement === search`).

### Phase 4 — Verification & Delivery
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` (entry < 200,000 B; workbench stays in lazy chunk — assert via `bundle-lazy-imports.test.ts`).
- Manual: keyboard-only pass, 360px viewport, reduced-motion, high-contrast.
- Commit series: `fix(fabrication): escape + unify renderers` → `feat(labbench): interactive vessel selection` → `feat(fabrication): live pack strip + progress` → `chore(fabrication): styles + types` → `test(fabrication): MVTH`. Report before/after build bytes and test counts.

### Copy-Paste Agent Prompts
> **Prompt [P1-WB-1/8]:** "Scope edits to `src/ui/WorkbenchCanvas.ts`, `src/ui/windows/FabricationWindow.ts`, new `src/ui/fabrication/FabricationPanel.ts`, and `tests/fabricationPanel.test.ts`. Extract a shared FabricationPanel; route all interpolations through `src/ui/escapeHtml.ts`; write a failing XSS + disabled-button test first. Do not touch the worker or `fabricationModel.ts`."
> **Prompt [P2-WB-7]:** "Add `unmount?(): void` to `WindowSpec` in `src/ui/WindowManager.ts`; implement `dispose()` on `LabBench3DCanvas` deleting all `GlMeshBuffers` and programs; call it from the window close path. Verify `webglAndMeshes.test.ts` still green."
> **Prompt [Phase 2.4]:** "Add pointer hit-testing to `LabBench3DCanvas`: ray-cast from camera through NDC pointer coords, test against per-vessel AABBs, set hover emissive uniform, emit `onSelectVessel(id)`. No new dependencies; stay in the lazy chunk (< 9 KB headroom budget)."

## 5. Risks & Non-Goals
- Do **not** expand `SAB_BYTE_LENGTH` or move workbench data into the SAB — keep COLONY_SYNC postMessage.
- Do **not** add a texture pipeline to `miniGl` (documented budget decision in `LabBench3DCanvas.ts:15-19` stands).
- Do not rewrite the engine FABRICATE path; client stays a projection.
