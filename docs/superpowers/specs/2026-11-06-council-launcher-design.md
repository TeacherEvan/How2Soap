# Spec 1 — The Council: Tile-Launcher Navigation & Dashboard Removal

**Date:** 2026-11-06
**Status:** Draft for review
**Depends on:** nothing (first of two specs; Spec 2 `2026-11-06-day-commissions-engagement-design.md` builds on this shell)
**Parent brainstorm:** Approach A — "Council Chamber" (immersive world + tile launcher), chosen 2026-11-06

---

## 1. Problem

The current UI is a 4-panel desktop dashboard with a 13-chip topbar (isolation, clock, glucose, body temp, insulation, adipose, hydration, ambient, renown ring, health, safety, vigor, mandate), a tabbed center workbench, an always-visible quest box and event log, plus a launcher rail for the existing window system. Everything vies for attention at once; the dashboard overbloats and the player's eye has no resting place. Meanwhile the game already has a working single-purpose window pattern (`WindowManager`, lazy-loaded, ESC/focus-trapped) that is under-used — the dashboard duplicates window content inline.

**Goal:** replace the dashboard entirely with an immersive full-viewport world base and a full-screen tile launcher ("The Council") for navigation. Mobile-first. Zero persistent HUD beyond three chrome elements.

## 2. Decision record (from brainstorming, all user-approved)

| Question | Decision |
|---|---|
| Scope | Full navigation overhaul, not incremental declutter |
| Home model | Tile-based launcher (console/Steam-style) |
| HUD | **No persistent HUD.** All chips removed; vitals live inside dedicated windows |
| Layout fate | 4-panel dashboard **replaced completely** — no classic-mode toggle |
| Base screen | Immersive world (strategy/hearth canvas) behind the menu |
| Target viewport | Mobile-first (96%-compliant WCAG 2.2, ≥24×24 targets) |
| Approach | A — Council Chamber; two sequential specs |
| Chrome | Three elements only (see §4.1) |
| Roster | 10 tiles, 4 pillars (see §5) |
| New windows | **2 only**: Chronicle, Day Commissions |
| Engagement | Spec 2 (badges, commissions, juice, progression visibility) |

## 3. Non-goals

- No new runtime dependencies (`three` remains the only one, lazy-loaded).
- No `memoryLayout.ts` / SAB changes; no entrypoint budget regression (< 200,000 bytes, `webpack.config.js`).
- No redesign of window *internals* beyond the fold-ins listed in §6 (e.g. Settlement gains a vitals section; Fabrication absorbs tools/inventory).
- No desktop-only "classic" layout fallback.
- No visual redesign of `StrategyMapCanvas` internals.

## 4. Architecture

### 4.1 Persistent chrome (the entire always-visible UI)

1. **Menu FAB** — top-right, ≥44×44 px, brass-ringed, `☰ Council` label, bound to `Esc` and key `M`. Toggles The Council. Carries an attention dot (Spec-2 badge summary) when closed.
2. **End Turn FAB** — bottom-right, ≥56×56 px, `End Turn ▸` with tiny caption `Day N · HH:00`, bound to `Space` / `Enter` (existing behavior). Disabled state while the sim worker is catching up, matching current end-turn UX.
3. **New world** — top-left, tiny ghost `↺` button, ≥24×24 px, confirm-before-reset (native confirm or existing modal pattern). This is the only survivor of the old topbar's `#reset`.

Nothing else is always visible. The `.topbar`, `.telemetry`, all `hud-chip`s, `.banners` row stays only as an `aria-live="polite"` announcement surface (visually toasts, not persistent chrome) — see §8.4.

### 4.2 Base layer — the world

- `StrategyMapCanvas` is remounted from `#tab-strategy-content` into a new full-viewport `#world` container in `public/index.html` (fixed inset-0, behind everything). Existing dynamic-import discipline is preserved (it is already `import()`-loaded).
- Day/night diurnal lighting, hearth glow, colony boids, and the command dock behavior are **unchanged in code**; only the mount container and CSS sizing change.
- The canvas keeps its pan/zoom/keyboard nav. When The Council or any window is open, the world canvas is inert (`inert` attribute + pointer-events: none behind backdrop).

### 4.3 The Council (launcher overlay)

- Full-screen `role="dialog" aria-modal="true" aria-labelledby="council-title"` overlay, `#council`, dark slate (`#12151c`) + brass astrolabe styling consistent with the strategy map.
- Structure: header (title + pillar filter row `All · Craft · Colony · Domain · Hearth`) → scrollable pillar sections of tile buttons → footer hint (`Esc close · 0 close all windows`).
- Tiles are `<button class="council-tile" data-window="id">`, each with icon, label, optional kbd hint (keys 1–9, 0 for Settings-ish actions — keys only for windows that have them), optional badge slot.
- **Mobile-first grid**: 2 columns <480px, 3 columns ≥480px, 5 columns ≥900px; tiles ≥88px tall on small screens (thumb-friendly); pillar headings sticky within the scroll region.
- Keyboard: roving tabindex across the visible grid; `ArrowUp/Down/Left/Right` move by column/row; `Home`/`End` first/last; type-ahead by label prefix; `Esc` closes; numeric keys still open windows directly **from anywhere**, Council open or closed.
- Focus: opens on the currently-relevant tile (last opened window if any, else first Craft tile); focus trapped inside; restore focus to the Menu FAB on close.
- The old `window-launcher` rail is **deleted**; `initLauncher()`'s `WINDOWS` registry is repurposed as the single source of truth feeding Council tiles + keyboard shortcuts (rename to `FEATURE_WINDOWS`, add `pillar: 'craft' | 'colony' | 'domain' | 'hearth'` and `attention?: (s) => Badge | null` slots consumed by Spec 2).
- Windows remain lazy-loaded via dynamic `import()` — Council itself ships in the eager bundle and must stay ≤ ~15 KiB min+gzip; `windows.css` stays a lazy chunk next to window modules.

### 4.4 Windows — unchanged model, two additions

`WindowManager` is reused as-is (singleton per id, `role=dialog`, focus trap, ESC via `overlayStack`, backdrop click close, `clampToViewport`, full-screen sheet <720px). New windows register in `FEATURE_WINDOWS` with `load: () => import('../ui/windows/<Name>Window')`.

## 5. Tile inventory (approved)

**⚒ Craft**
| Key | Tile | Window | Notes |
|---|---|---|---|
| 1 | 🔬 Workbench | `reactions` | existing Reactions window (furnace, voltaic pile, condenser, vessel contents) |
| 2 | 🔨 Fabrication & Pack | `fabrication` | fabrication **absorbs the tools/inventory panel** (`ToolAndInventoryPanel`) as a "Pack" section |
| 3 | 🌾 Paddocks | `paddocks` | existing |

**🏘 Colony**
| Key | Tile | Window | Notes |
|---|---|---|---|
| 4 | 🧭 Biome Survey | `biome` | existing; absorbs nothing (already a window) |
| 5 | 🏘️ Settlement | `settlement` | existing; **gains a "Mandate & Estates" section** absorbing the health/safety/vigor/mandate chips (was `hud-health`, `hud-safety`, `hud-vigor`, `hud-mandate`) with progress-bar roles |

**🌐 Domain**
| Key | Tile | Window | Notes |
|---|---|---|---|
| 6 | 🏛️ The Realm | `realm` | existing |
| 9 | 🌐 Influence | `influence` | existing |

**🕯 Hearth**
| Key | Tile | Window | Notes |
|---|---|---|---|
| 7 | 📜 Chronicle | `chronicle` *(new)* | Event log (last-8 → scrollable full history) + **Master Tech ladder** (5 tiers, checkmarks, renown ring large, tier caption) + story/chapter records (`StoryMode` entries surface here read-only) |
| 8 | 🎯 Day Commissions | `commissions` *(new)* | Spec 2 flagship window: today's 3 commissions with progressbars, claim buttons, streak flame, lifetime claimed count, "+N renown to Level X" bar |

Keys 0 (`closeAll`) and `M` (toggle Council) are global, not tiles.

## 6. Fold-ins & deletions (spec 1 checklist)

**Delete from `public/index.html`:** `.topbar` internals except `#reset` (re-homed as the top-left New world button); `.telemetry`, all `hud-chip`s, `.banners` markup kept but emptied of static chips (announcement role only); `#workbench-tabs-container`; all five `#tab-*-content` panes; `.workbench-foot` (quest list + event log markup); `#window-launcher` rail; `#biome-panel-container`; `#tool-inv-container`; `#vessel-list` aside + `.add-vessel` flow (vessel quick-add button moves into Reactions window toolbar — it already owns vessel creation? No: vessel creation currently lives in `views.ts` `renderVessels`. It moves verbatim into the Reactions window header row); `#quest`, `#log`.

**Delete modules:** `src/app/views.ts` (fold into windows), `src/app/panels.ts` (verify contents — panels for tool-inv are re-homed or removed), obsolete selectors in `src/styles.css` (purge pass, must not remove window/HUD-independent rules), tab styles, `.vessel-list` styles if unused.

**Keep / repurpose:** `MenuController.ts` (if it owns the old rail/tabs, its responsibilities shrink to New-world/reset + pause coordination — read before editing); `overlayStack.ts` (shared, unchanged); `dom.ts` (prune removed exports); `audio.ts` (unchanged); `score.ts` (score/renown helpers used by Chronicle).

**New files:**
- `src/ui/council/Council.ts` (+ `council.css`) — overlay build, grid nav, pillar filter, tile render, badge slot wiring
- `src/ui/windows/ChronicleWindow.ts` — merges event log + Master Tech + story records
- `src/ui/windows/CommissionsWindow.ts` — shell only in Spec 1 (static "Commissions arrive with Day N+1" placeholder? **No** — Spec 1 ships the window with full claim UX only after Spec 2 lands; Spec 1 instead ships the window **disabled/hidden** (`enabled: false` flag in registry) to keep two specs independently shippable. Final visibility gates on Spec 2.)
- `#world` container in `public/index.html`; base-layer CSS in `styles.css`

## 7. Data flow

```
sim worker ──COLONY_SYNC/snapshot──► syncScheduler ──► WindowManager.broadcastSnapshot(openWindows)
                                   └─► Council.updateBadges(snapshot)   [Spec 2]
                                   └─► Chronicle/Commissions windows    [their onSnapshot]
End Turn click ──► existing command path ──► turn rollover in worker ──► dawn toast (Spec 2) + windows refresh
```

The world base never reads from the DOM of removed panels; all consumers are windows or the Council.

## 8. Accessibility & WCAG 2.2

1. Council: `role="dialog"`, focus trap, ESC, restore focus to Menu FAB; arrow-key grid nav per §4.3; tiles ≥44×44 (mobile) / ≥24×24 (desktop min).
2. New world (↺): ≥24×24, `aria-label="Start a new world"`, confirm dialog before destructive reset.
3. FABs: ≥44×44 (Menu), ≥56×56 (End Turn); `:focus-visible` dual-ring `2px solid #5aa5ff` offset 2px (existing token).
4. Announcements: `aria-live="polite"` region (reuse `#banners`) for: window opened/closed? No — too noisy. Only: crisis changes, commission outcomes, milestone tier-ups, reset completed.
5. Motion: all new transitions behind `@media (prefers-reduced-motion: reduce)`; badge pulse (Spec 2) becomes a static outline.
6. Contrast: slate/brass pairings reuse verified tokens from `windows.css`/`styles.css`; `forced-colors: active` outlines on tiles and FABs.
7. Keyboard parity: every action reachable without pointer (M, Esc, Space/Enter, 1–9, Tab order: New world → End Turn → Menu).

## 9. Testing & verification

- **Existing suite must pass unchanged** before any refactor (baseline), then after: `npx vitest run`, `npx tsc --noEmit`, `npm run build` (entrypoint < 200 KiB — verify Council chunk size in stats output).
- **New unit tests (pure modules only):** `src/ui/council/tileNav.ts` (grid arrow-key math, roving tabindex helpers) if extracted; Council is otherwise thin DOM code. Badge logic tests belong to Spec 2.
- **Manual a11y pass:** keyboard-only run-through (Tab order, M, Esc, trap, type-ahead), VoiceOver/NVDA smoke, 360px + 768px + 1440px viewport checks, reduced-motion + forced-colors emulation, Lighthouse a11y ≥ 95.
- **Save compatibility:** load pre-change save export → verify no migration needed, all slices intact (Spec 1 adds no save fields).
- **Deletion safety:** after deleting panels, `grep` for dangling references (`views.ts` functions, `#quest`, `hud-`) in `src/` must return zero hits; build must not warn about unresolved imports.

## 10. Rollout

1. Land Spec 1 in 3 commits on a feature branch: (a) base layer + chrome + Council shell (dead-code panels still present, hidden behind a `ui.shellV2` feature flag defaulting off for dev), (b) window fold-ins + deletions + tests, (c) flag removal — default becomes the Council, flag deleted.
   - Simpler accepted alternative (choose at planning time): single PR without flag; private repo, single user — ship atomic. Decide in the implementation plan.
2. Spec 2 lands after Spec 1 merges: badges module, commission engine, save migration (additive), juice, dawn toast.

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| StrategyMapCanvas remount breaks sizing/pointer math | It already reads its container rect; verify `resize` handler observes `#world`; keep canvas `width:100%;height:100%` with ResizeObserver (check existing code before assuming) |
| Removing chips hides vitals players rely on | All vitals re-homed with ≥ parity visibility in Settlement/Chronicle; mandate gets crisis badge (Spec 2) |
| Entrypoint exceeds 200 KiB | Council is lean DOM+CSS; measure with `npm run build` stats; if over, move Council CSS into lazy `council.css` (co-loaded with windows) — budget gate is a hard stop |
| Keyboard regressions from global M/Esc | Scope handler, ignore when target is input/select/textarea, reuse existing launcher guard pattern |
| Players lost without HUD | First-launch hint toast after update ("Your Council is one tap away — press M"), shown once, persisted in existing `featureFlags`-style save field or `localStorage` (decide: **localStorage**, not save — cosmetic, shouldn't touch save schema) |
