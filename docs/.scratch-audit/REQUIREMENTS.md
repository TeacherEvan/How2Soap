# G&L Auditor V2: Requirements Matrix

**Document:** `docs/.scratch-audit/REQUIREMENTS.md`  
**Source Plan:** `docs/plans/frontend_gameplay_overhaul_plan.md`  
**Target:** How2Soap (`teacherevan/how2soap`)  
**Date:** 2026-11-04  

---

## 1. Functional Requirements (FR)

- **FR-01 (CSS & DOM Layout Integrity):** Replace clipping/misaligned layout rules with a responsive 3-column / 3-row architecture adhering to `100dvw`/`100dvh`, strict `box-sizing: border-box`, `min-width: 0`, and `min-height: 0` constraints to eliminate border blowout.
- **FR-02 (Viewport & Window Clamping):** In `WindowManager.ts`, implement strict viewport boundary clamping (`pad: 12`, `topSafe: 62`, `bottomSafe: 68`) preventing modal popups and feature windows from bleeding outside the viewport bounds or under the OS taskbar on viewports down to 1280x720 and mobile.
- **FR-03 (Plain-English Terminology & Item Readability):** Add plain-English `simpleDesc` and simplified display names to item catalog entries without breaking existing item IDs (`PINE_DEADFALL_WOOD`, `RAW_ADIPOSE_FAT`, `HALITE_SALT`, `BAR_SOAP`, etc.), maintaining backwards compatibility with fabrication recipes, biome yields, and all test suites.
- **FR-04 (De-Cluttered Dashboard & Progressive Disclosure):** Consolidate top bar meters (Camp Health, Stamina/Food, Day Clock) and enforce progressive station disclosure (`unlockedUiFlags` or unlock states) so new players are not confronted with 11 simultaneous raw data surfaces.
- **FR-05 (Action-Driven Interactive Spotlight Tutorial):** Upgrade `TutorialController.ts` and `tutorialCurriculum.ts` to support interactive step-by-step onboarding spotlights (DOM element target highlight ring `#tutorial-spotlight-ring`) that advance on verified state milestones.
- **FR-06 (Timed Town Requests & Mini-Game Affordances):** Integrate active timed requests via worker message protocol (`PLAYER_SYNC` / `REQUEST_SYNC`), supporting urgency countdowns, rewards, speed multipliers, and interactive kettle / harvest timing boosts without violating the `SAB_BYTE_LENGTH = 67648` invariant.

---

## 2. Non-Functional Requirements & Invariants (NFR)

- **NFR-01 (Invariant SAB Byte Length):** `SAB_BYTE_LENGTH` MUST remain strictly `67648` bytes. Zero additions to SharedArrayBuffer.
- **NFR-02 (Zero Runtime Dependencies):** `package.json` `"dependencies"` MUST remain strictly empty (`{}`). Pure browser APIs only.
- **NFR-03 (Webpack Entrypoint Budget):** Entrypoint bundle size MUST remain `< 200,000` bytes (`webpack.config.js`).
- **NFR-04 (TypeScript Strict Compilation):** `npx tsc --noEmit` MUST pass with 0 errors.
- **NFR-05 (Unit & Integration Test Suite):** All 44 existing Vitest test suites (223+ tests) MUST pass with 100% success rate.
- **NFR-06 (WCAG 2.2 SC 2.5.8 Target Sizes):** Interactive controls MUST maintain at least 24×24 CSS px touch targets.

---

## 3. Acceptance Criteria (AC Table)

| ID | Requirement | Acceptance Criteria | Validation Method |
| :--- | :--- | :--- | :--- |
| **AC-001** | Layout Bounds | `.layout-4panel` or `#app-shell` and child cards apply `min-width: 0`, `min-height: 0`, and no borders overflow outside viewport rect. | DOM inspection / layout test |
| **AC-002** | Window Clamping | `WindowManager.ts` enforces `clampToViewport` logic on open and resize, keeping dialogs within visible bounds. | Vitest / WindowManager test |
| **AC-003** | Plain Descriptions | Item catalog entries provide clear, concise descriptions without breaking `item.desc.length >= 12` test gate. | `npx vitest run tests/items.test.ts` |
| **AC-004** | Progressive Gating | UI stations unlock progressively as player gathers items or advances through steps. | Vitest / UI state unit test |
| **AC-005** | Interactive Spotlight | Spotlight controller positions `#tutorial-spotlight-ring` over target elements and tracks coordinates. | DOM & tutorial tests |
| **AC-006** | Timed Requests Engine | Worker processes timed requests and broadcasts updates over structured `postMessage`, preserving `SAB_BYTE_LENGTH`. | `tests/memoryLayout.test.ts` + request test |
| **AC-007** | Build & Type Safety | Production build passes under 200 KiB budget; `tsc --noEmit` passes with 0 errors. | `npm run build && npx tsc --noEmit` |
