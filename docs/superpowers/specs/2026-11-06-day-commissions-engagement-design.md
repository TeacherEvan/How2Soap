# Spec 2 — The Hearth: Day Commissions, Tile Badges, Juice & Progression Visibility

**Date:** 2026-11-06
**Status:** Draft for review
**Depends on:** Spec 1 (`2026-11-06-council-launcher-design.md`) — Council exists, tile registry `FEATURE_WINDOWS` has `attention` slot, `ChronicleWindow` and `CommissionsWindow` shells are mounted (Commissions can be `enabled: false` until this spec lands).
**Parent brainstorm:** Engagement layer approved 2026-11-06

---

## 1. Problem

Spec 1 removed the always-visible HUD and navigation. Players now need:
- **At-a-glance attention cues** — "something needs me" without opening every window.
- **In-game daily goals** — a reason to open the game each day/turn, with visible progress and reward.
- **Celebration & feedback** — milestones felt, not just numbers ticking up.
- **Progression that is *more* visible**, not less — the tiny renown ring in the old topbar was easy to miss.

All without new deps, no SAB/memoryLayout changes, additive save only, and WCAG 2.2 compliance.

## 2. Decision record (from brainstorming, all user-approved)

| Question | Decision |
|---|---|
| Badge levels | `crisis` (red pulse), `action` (amber dot), `info` (count badge) |
| Commission model | 3 per in-game day, deterministic seeded, **manual claim** (not auto), streak on consecutive days with ≥1 claimed |
| Streak rewards | Every 7 days: +vigor + fanfare; no punishment for misses, just streak reset |
| Juice | Fanfares, shimmers, toasts, renown-ring pulses; all behind `prefers-reduced-motion` |
| Progression visibility | Chronicle owns large renown ring + Master Tech; Commissions shows "+N renown to Level X" bar |
| Save | Additive `commissions` field on `SerializedWorldSave`; **no version bump**; old saves load with defaults |

## 3. Non-goals

- No persistent notification center (badges + `aria-live` toasts suffice).
- No real-world daily streak (user chose *in-game daily commissions*).
- No external reward economy (achievements, leaderboards, cloud sync).
- No new worker threads or SharedArrayBuffer changes.
- No changes to `memoryLayout.ts` (SAB byte length remains 67,648).

## 4. Architecture

### 4.1 `src/ui/tileAttention.ts` — pure badge engine

```ts
export type BadgeLevel = 'crisis' | 'action' | 'info';

export interface Badge {
  level: BadgeLevel;
  count?: number;        // for 'info'
  label: string;         // aria-label / tooltip text
}

export interface AttentionModule {
  id: string;            // matches window id in FEATURE_WINDOWS
  check: (snapshot: SimSnapshot, state: ClientState) => Badge | null;
}
```

- **Exported:** `computeAllBadges(snapshot, state): Map<string, Badge>` — called from Council on each tick edge *after* `WindowManager.broadcastSnapshot`; synchronous, < 1 ms.
- **Rules (approved):**
  - `reactions` (Workbench): any vessel `pressure > 95% max` OR `pH outside [2, 12]` OR `temp > 90% vessel rating` → `crisis: "Vessel pressure/pH/temperature critical"`
  - `settlement`: `colony.morale < 20` (any colonist) OR `mandate < 35%` → `crisis: "Strike risk / mandate failing"`; `unreadDawnReport === true` → `action: "Dawn Report ready"`
  - `chronicle`: `state.log.length > lastReadLogIndex` → `info: count = state.log.length - lastReadLogIndex`
  - `commissions`: `anyCommissionCompleteAndUnclaimed` → `action: "Commission(s) ready to claim"`
  - `influence`: `timedRequests.some(r => r.state === 'PENDING' && !r.seen)` → `action: "Audience awaits"`
  - `fabrication`, `paddocks`, `biome`, `realm` — `null` (clean tiles are a feature; rules can be added later without schema change).
- **Config:** rules live in a single array so they are testable and scannable; no magic numbers in `check` bodies.

### 4.2 `src/engine/commissions.ts` — deterministic commission engine

**Templates (data, not engine):** `src/data/commissionTemplates.ts` — array of objects:
```ts
interface CommissionTemplate {
  id: string;                    // 'saponify', 'harvest', 'renown', 'dawn-report', 'morale'
  weight: number;                // relative pick weight
  minDay?: number;               // unlock after day N (default 1)
  minChapter?: number;           // or chapter
  objective: (snap, state) => number;  // progress 0..target
  target: number;
  renownReward: number;
  label: string;
}
```
Templates are pure data; progress evaluators are pure functions (fast, no side effects).

**Generator:**
- Input: `worldSeed` (from save) + `day` (in-game day from snapshot) → `seededRNG(seed = worldSeed ^ day)`.
- Output: exactly 3 distinct templates per day (rejection sampling from weighted pool filtered by `minDay`/`minChapter`).
- Determinism: same save + same day → same 3 commissions. Replays match.

**Evaluator:**
- Runs on tick edge (same frame as badge computation).
- For each active commission: `progress = Math.min(target, template.objective(snap, state))`.
- When `progress >= target`: `complete = true`, `claimed = false`.
- Claim action: `claimed = true`; renown reward granted via existing `progression.addRenown(reward)` → triggers existing renown level-up toast/fanfare *and* commission-specific shimmer.

**Streak:**
- `lastClaimDay`: last in-game day when ≥1 commission was claimed.
- On claim: if `lastClaimDay === day - 1` → `streak += 1`; else `streak = 1`.
- Every 7 (`streak % 7 === 0`): `addVigor(10)` + `audio.stimulantShimmer()` + toast `"7-Day Streak! Hearth Vigor +10"`.
- Missed day → streak resets to 0 on next claim; **no negative penalty**.

### 4.3 Save shape — additive only

`SerializedWorldSave` (Spec 1 `deserializeSave` already defaults missing) gains:

```ts
commissions?: {
  day: number;                 // day the current 3 were generated
  active: {
    id: string;                // template.id
    progress: number;
    target: number;
    complete: boolean;
    claimed: boolean;
  }[];
  streak: number;
  lastClaimDay: number;
  totalClaimed: number;
};
```

On new day tick rollover: if `save.commissions.day !== day` → `generateToday(day)` → overwrite `active` with fresh 3, `day = day`, streak/lastClaimDay/totalClaimed persist. Old saves without the field get defaults via `deserializeSave` (v2 migration already handles missing objects); **no version bump needed** because additive optional fields are safe.

### 4.4 Juice & feedback (audio + toast + visual)

| Event | Audio | Toast | Visual |
|---|---|---|---|
| Commission **complete** (progress reached) | `audio.wageClink()` (subtle) | `"+1 Commission ready — open The Council"` | Tile `action` badge; subtle shimmer on tile if Council open |
| Commission **claimed** | `audio.stimulantShimmer()` | `"+N renown · Day X streak"` | Floating `+N` over tile; renown ring pulse in Chronicle |
| **Streak milestone** (×7) | `audio.stimulantShimmer()` (louder) | `"7-Day Streak! Hearth Vigor +10"` | Full-screen center toast with fanfare particles (reduced-motion: toast only) |
| **Renown level-up** | `audio.recruitHorn()` (brassy) | `"Level X — New Title: <title>"` | Chronicle renown ring animates 360°; Council tile `action` badge on `chronicle` |
| **Dawn agenda** (turn rollover) | `audio.wageClink()` | `"Dawn — 3 commissions set · Day X streak"` | Tile `action` badge on `commissions` |

All particle/animation gated by `window.matchMedia('(prefers-reduced-motion: reduce)').matches` — if true, only toasts + audio.

### 4.5 Dawn Agenda toast (turn rollover)

- Triggered by existing turn-rollover path in worker → main thread `syncScheduler` → UI tick handler.
- Shows: day number, commission count (always 3), streak counter (flame icon + number), any crisis badges summary.
- **Once per turn**, non-dismissible for 3 s, then fade (reduced-motion: instant dismiss).

### 4.6 Council badge wiring

- `Council.ts` (Spec 1) receives `badgeMap` after each `computeAllBadges` call.
- Renders badges on tiles: `crisis` = pulsing red ring; `action` = steady amber dot (no pulse); `info` = white count pill.
- Menu FAB (closed) shows aggregated dot: if any `crisis` → red pulse; else if any `action` → amber; else if any `info` → white.

## 5. Accessibility & WCAG 2.2

- Badges: never color-only. Each badge has `label` → rendered as `aria-label` on tile; changes announced via `#banners` `aria-live="polite"` **once per state transition** (debounced: only when `level` or `count` differs from last-announced for that tile).
- Commissions window: progress bars with `role="progressbar" aria-valuenow aria-valuemin aria-valuemax`; claim buttons ≥24×24; completed/claimed state in accessible name.
- Toasts: use existing `Toast.ts` (verify it uses `role="status"` or `aria-live="polite"` — if not, fix in place).
- Renown ring in Chronicle: large SVG with `role="img" aria-label="Renown Level X — Y% to next"`.
- All animations gated by `prefers-reduced-motion`.

## 6. Testing

### 6.1 New unit tests (`npx vitest run`)

| Module | Coverage |
|---|---|
| `tileAttention.ts` | `computeAllBadges` returns correct level/label for each rule given synthetic snapshots; precedence: `crisis > action > info`; unknown tile → no badge; empty state. |
| `commissions.ts` (generator) | Same `worldSeed` + `day` → identical 3 templates; different days differ; filtered by `minDay`/`minChapter`; no duplicates. |
| `commissions.ts` (evaluator) | Progress monotonically increases; completes at target; claim grants renown; streak increments/resets correctly; 7-day milestone fires vigor + shimmer. |
| `commissions.ts` (save round-trip) | `serializeSave` + `deserializeSave` preserves commissions shape; old save without field loads with defaults; version remains 2. |

### 6.2 Existing gates

- `npx vitest run` — all old + new tests pass.
- `npx tsc --noEmit` — 0 errors.
- `npm run build` — entrypoint < 200 KiB; verify lazy chunks for Council/Windows/Commissions don't regress.

### 6.3 Manual verification checklist

- Play a full day cycle: see 3 commissions in Commissions window, progress as actions taken, claim → renown + streak toast.
- Let a day pass without claiming: next day streak resets to 1 (not negative).
- Trigger a vessel pressure crisis → Council tile + Menu FAB badge red pulse.
- Leave Dawn Report unread → Settlement tile amber dot.
- Open Council → arrow-key nav to `commissions` tile, Enter opens window, Tab order, claim buttons focusable.
- Verify reduced-motion: no particles, badge rings static, all toasts + audio remain.
- Verify forced-colors: tile outlines, FAB outlines, badge shapes distinguishable.

## 7. Rollout

- Land on top of Spec 1 (which ships `CommissionsWindow` as `enabled: false`). Spec 2 flips the flag and wires badge + juice.
- No save migration script — additive field is backward-compatible by `deserializeSave` defaults.
- Feature flag optional: if team prefers, a `featureFlags.commissions` boolean could gate the whole system, but additive defaults already make it safe-on-first-load. Decide at planning.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Commission evaluator runs too slow on tick edge | All evaluators are simple arithmetic; if any template needs expensive scan (e.g., "harvest X across all biomes"), move to a cached selector or skip that template for now. Target: total < 1 ms. |
| Badge spam on `aria-live` | Debounce: only announce when `level` or `count` actually changed; cache last announced per tile. |
| Streak confusion (is it real-world or in-game?) | UI always says "Day N streak"; no date reference; in-game day is explicit in dawn toast and Commissions window. |
| Old saves lose commissions history | Additive defaults mean old saves start at day 1 with fresh commissions — correct; no history was tracked before. |
| Entrypoint budget | Juice animations use existing audio + CSS; no new assets. Commission engine is pure TS in a lazy chunk with `CommissionsWindow`. Measure build output. |