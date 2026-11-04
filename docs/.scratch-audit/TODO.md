# G&L Auditor V2: Implementation Task List (TODO.md)

**Document:** `docs/.scratch-audit/TODO.md`  
**Run:** `run-001`  
**Target:** How2Soap (`teacherevan/how2soap`)  
**Date:** 2026-11-04  

---

## Objectives (≥10 Measurable Objectives)

- [ ] **OBJ-001: CSS Layout Box-Sizing & Border Clipping Elimination**
  - **Requirement:** FR-01, AC-001
  - **Scope:** `src/styles.css`, `src/ui/windows/windows.css`
  - **Action:** Enforce `*, *::before, *::after { box-sizing: border-box; }`, apply `min-width: 0; min-height: 0;` to grid children, and add `margin: 2px` safe inset for interactive cards.
  - **Validation:** Visual inspection & layout checks.

- [ ] **OBJ-002: Window Viewport Boundary Clamping**
  - **Requirement:** FR-02, AC-002
  - **Scope:** `src/ui/WindowManager.ts`
  - **Action:** Implement `clampToViewport(el, x, y)` with `topSafe: 62`, `bottomSafe: 68`, and `pad: 12`.
  - **Validation:** Add unit tests in `tests/windowManager.test.ts`.

- [ ] **OBJ-003: Plain-English Item Descriptions & Readability Enhancement**
  - **Requirement:** FR-03, AC-003
  - **Scope:** `src/data/items.ts`
  - **Action:** Add `simpleDesc` field and ensure all item definitions have concise, clear descriptions while preserving canonical IDs and passing `tests/items.test.ts`.
  - **Validation:** `npx vitest run tests/items.test.ts`.

- [ ] **OBJ-004: Progressive UI Gating Flags**
  - **Requirement:** FR-04, AC-004
  - **Scope:** `src/app/state.ts`, `src/app/views.ts`
  - **Action:** Introduce UI disclosure flags (`UI_FLAG_MAP`, `UI_FLAG_WORKSHOP`, `UI_FLAG_SOAP_LAB`, `UI_FLAG_REQUESTS`) to hide locked stations until requirements are met.
  - **Validation:** Vitest UI state assertion.

- [ ] **OBJ-005: Interactive Tutorial Element Spotlight Engine**
  - **Requirement:** FR-05, AC-005
  - **Scope:** `src/ui/TutorialController.ts`, `src/ui/tutorial.css`
  - **Action:** Implement dynamic `#tutorial-spotlight-ring` tracking DOM elements via `getBoundingClientRect()` with smooth transitions and backdrop mask.
  - **Validation:** DOM tracking test in `tests/surgicalAuditAndTutorial.test.ts`.

- [ ] **OBJ-006: 6-Step Hands-On Interactive Onboarding Script**
  - **Requirement:** FR-05, AC-005
  - **Scope:** `src/ui/tutorialCurriculum.ts`, `src/ui/TutorialController.ts`
  - **Action:** Wire the 6 onboarding steps (Chop Wood, Burn Ash, Drip Lye, Melt Fat, Cook Soap, Deliver Request) to real inventory/event triggers.
  - **Validation:** Vitest tutorial progression test.

- [ ] **OBJ-007: Timed Requests Engine Model**
  - **Requirement:** FR-06, AC-006
  - **Scope:** `src/engine/timedRequests.ts` (new file)
  - **Action:** Implement 3-slot request manager with urgency tiers, tick countdowns, expiry penalties, and speed multipliers.
  - **Validation:** Unit tests in `tests/timedRequests.test.ts`.

- [ ] **OBJ-008: Worker Protocol Integration for Timed Requests**
  - **Requirement:** FR-06, AC-006
  - **Scope:** `src/engine/sim.worker.ts`, `src/app/workerMessages.ts`
  - **Action:** Wire `REQUEST_SYNC`, `FULFILL_REQUEST`, and expiry notifications into the worker tick loop via structured cloning.
  - **Validation:** Worker dispatch test in `tests/workerDispatch.test.ts`.

- [ ] **OBJ-009: Timed Requests HUD Widget in Right Sidebar**
  - **Requirement:** FR-06, AC-004
  - **Scope:** `src/ui/TimedRequestsPanel.ts` (or `src/app/views.ts`), `src/styles.css`
  - **Action:** Render active request cards with live animated progress bars, reward previews, and one-click deliver buttons.
  - **Validation:** Visual verification.

- [ ] **OBJ-010: Interactive Soap Kettle Mini-Game Controls**
  - **Requirement:** FR-06
  - **Scope:** `src/ui/WorkbenchCanvas.ts`
  - **Action:** Implement 3-phase interactive kettle controller (Pouring mix hold gauge, Bellows heat pump inside target band, Stirring rhythm).
  - **Validation:** Interactive canvas test.

- [ ] **OBJ-011: Strict Verification & Quality Budget Gate**
  - **Requirement:** NFR-01, NFR-02, NFR-03, NFR-04, NFR-05
  - **Scope:** Full repository
  - **Action:** Execute `npx vitest run`, `npx tsc --noEmit`, and `npm run build` (<200 KiB budget check).
  - **Validation:** Automated test and build outputs.

---

## Definition of Done (DoD)

1. Zero unstyled or overflowing layout boundaries across all screens.
2. `SAB_BYTE_LENGTH === 67648` verified by `tests/memoryLayout.test.ts`.
3. 0 dependencies in `package.json`.
4. Production bundle under 200,000 bytes.
5. All 44+ Vitest test suites green.
