================================================================================
HOW2SOAP: SURGICAL FRONTEND, UX & GAMEPLAY OVERHAUL SPECIFICATION
================================================================================
Repository: teacherevan/how2soap (Commit: c4c53ac521917629cd3367e6bfd6584052e4cea6)
Architecture: TypeScript 5.6 + Webpack 5 + Web Worker (sim.worker.ts) + 
              Float64Array/Int32Array Memory Layout + WebGL/2D Canvases
Date: November 4, 2026

--------------------------------------------------------------------------------
PART 1: EXACT CODEBASE FORENSICS (WHY IT IS BROKEN RIGHT NOW)
--------------------------------------------------------------------------------

1.1. CSS Grid & Border Clipping Forensics (`src/styles.css` & `src/ui/windows/windows.css`)
- Issue 1: `.hud-grid` in `src/styles.css` uses:
  `grid-template-columns: 300px 1fr 340px; height: calc(100vh - 56px); overflow: hidden;`
  Because child panels (`.hud-panel`, `#biome-tree-panel`, `#tool-inventory-panel`, 
  `#journal-panel`) apply `border: 2px solid var(--brass-border)` and `padding: 12px` 
  while flex/grid items lack `min-height: 0` and `min-width: 0`, the right 2px border 
  of the 340px column and the bottom 2px border of all three columns are pushed 4px 
  outside the clipping rect of `.hud-grid`.
- Issue 2: `.hw-window` in `src/ui/windows/windows.css` sets `overflow: hidden` with 
  `border: 2px solid #b8860b` and `box-shadow`, while `WindowManager.ts` positions 
  windows at hardcoded offsets (`left: 80 + idx * 36`, `top: 70 + idx * 36`) with 
  fixed dimensions (`width: 640px; height: 480px;`). On 1366x768 or 1280x720 viewports, 
  opening `ReactionsWindow` or `PaddocksWindow` places the bottom border at `70 + 144 + 480 = 694px`, 
  clipping the window's bottom border and resize handle under the OS taskbar/viewport.
- Issue 3: `StrategyMapCanvas.ts`, `WorkbenchCanvas.ts`, and `LabBench3DCanvas.ts` 
  read `this.canvas.parentElement.clientWidth` once during initialization or on 
  `window.resize`, ignoring flex/grid reflows when sidebars update. The canvas 
  intrinsic pixel buffer desyncs from CSS layout size, causing stretched aspect 
  ratios and clipped right/bottom borders inside `.stage-canvas-wrap`.

1.2. Dashboard Information Overload Forensics (`public/index.html`, `src/app/panels.ts`, `src/app/views.ts`)
- On tick 0, `public/index.html` and `src/main.ts` mount and render **11 distinct data surfaces** simultaneously:
  1) Top Vitals Bar: 6 separate numeric/bar readouts (ATP/Metabolism, Hydration, Hygiene, 
     Morale, Scurvy/Pathogen risk, Turn/Tick counter).
  2) Telegraph Ticker (`telegraph.ts`) scrolling mandate/lore strings.
  3) Left Column Top: `BiomeTreePanel.ts` rendering all 5 biomes and 15+ geological nodes 
     regardless of whether the player has the tools to harvest them.
  4) Left Column Bottom: `ToolAndInventoryPanel.ts` rendering every crafted tool and a 
     raw chemical species table with molar/gram readouts (`speciesRegistry.ts`).
  5) Center Stage: 3 canvas modes (`StrategyMapCanvas`, `WorkbenchCanvas`, `LabBench3DCanvas`) 
     plus floating launchers (`launcher.ts`) for 4 pop-out windows (`BiomeWindow`, 
     `FabricationWindow`, `PaddocksWindow`, `ReactionsWindow`).
  6) Right Column: `JournalPanel.ts` + Mandate list + Story Act log (`StoryMode.ts`).
- Result: A new player sees ~85 interactive buttons and ~140 text labels on screen 
  before harvesting a single piece of wood.

1.3. Non-Interactive Tutorial Forensics (`src/ui/TutorialController.ts`, `src/ui/tutorialCurriculum.ts`)
- `src/ui/tutorialCurriculum.ts` defines static `TutorialTier` objects containing 
  multi-paragraph lectures on petrology, calcination, and stoichiometry paired with 
  static images (`blender_mines_geology.png`, `blender_elements_crucible.png`, etc.).
- `TutorialController.ts` simply opens a modal box with `Prev` / `Next` buttons. It 
  has **zero bindings** to `src/app/actions.ts` or `sim.worker.ts` state changes. Players 
  must close the wall of text and guess what to click on the dashboard.

1.4. Archaic Dialect & Jargon Forensics (`src/data/items.ts`, `src/data/speciesRegistry.ts`, `src/data/biomeNodes.ts`, `src/data/story.ts`)
- `src/data/items.ts` & `speciesRegistry.ts` expose raw alchemical/archaic terms directly 
  to UI labels: `"Lixiviated Potassa"`, `"Saponified Tallow Curd"`, `"Calcined Quicklime"`, 
  `"Vitriol (H2SO4)"`, `"Argentiferous Galena"`, `"Adipose Suet"`, `"Miasmatic Effluvia"`.
- `src/data/story.ts` & `src/engine/mandates.ts` use verbose 19th-century prose 
  (40-70 words per entry) that obscures the actual game objective (e.g., "Craft 2 Soap").

1.5. Passive Gameplay & Untimed Mandate Forensics (`src/engine/mandates.ts`, `src/engine/sim.worker.ts`, `src/ui/WorkbenchCanvas.ts`)
- `src/engine/mandates.ts` evaluates mandates purely as boolean inventory checks 
  (`inventory[item] >= requiredQty`). There is no `deadlineTick`, no `timeRemaining` 
  counter in `memoryLayout.ts`, no urgency escalation, and no expiration penalty.
- `src/ui/WorkbenchCanvas.ts` and `src/ui/windows/ReactionsWindow.ts` execute reactions 
  via a single `{ type: 'RUN_REACTION', ruleId }` worker message that immediately 
  deducts inputs and adds outputs. There is zero player skill, timing, temperature 
  control, or physical interaction required.

--------------------------------------------------------------------------------
PART 2: EXACT CSS & DOM ARCHITECTURE OVERHAUL (FIXING ALIGNMENT & BORDERS)
--------------------------------------------------------------------------------

2.1. Complete Replacement Specification for `src/styles.css` Layout Grid
Apply the following exact CSS rules to eliminate every cut-off border and misalignment:

```css
:root {
  --hud-gap: 10px;
  --hud-pad: 10px;
  --panel-border: 2px solid #8c6d3f;
  --panel-radius: 8px;
  --topbar-h: 52px;
  --dock-h: 56px;
}

*, *::before, *::after {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  width: 100dvw;
  height: 100dvh;
  overflow: hidden;
  background: #14120e;
}

#app-shell {
  display: grid;
  width: 100dvw;
  height: 100dvh;
  padding: var(--hud-pad);
  gap: var(--hud-gap);
  grid-template-rows: var(--topbar-h) minmax(0, 1fr) var(--dock-h);
  grid-template-columns: 280px minmax(0, 1fr) 320px;
  grid-template-areas:
    "topbar  topbar  topbar"
    "left    stage   right"
    "dock    dock    dock";
}

/* Prevent flex/grid blowout that clips borders */
#top-bar, #left-sidebar, #center-stage, #right-sidebar, #bottom-dock, .hud-panel {
  min-width: 0;
  min-height: 0;
}

.hud-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1a14;
  border: var(--panel-border);
  border-radius: var(--panel-radius);
  overflow: hidden; /* Clips inner scroll, keeps outer 2px border 100% intact */
}

.hud-panel__header {
  flex: 0 0 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid rgba(140, 109, 63, 0.4);
}

.hud-panel__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 2px safe inset on interactive cards so hover/active borders never clip */
.item-card, .request-card, .biome-card {
  margin: 2px;
  padding: 8px 10px;
  border: 1px solid #5a4628;
  border-radius: 6px;
  background: #27221a;
}
```

2.2. Responsive Breakpoints & Window Clamping (`src/ui/WindowManager.ts` & `src/ui/windows/windows.css`)
- In `src/ui/WindowManager.ts`, replace raw `style.left` / `style.top` assignment with 
  a strict viewport clamping function invoked on `openWindow()`, `onPointerMove()`, 
  and `window.addEventListener('resize')`:
  ```ts
  private clampToViewport(el: HTMLElement, x: number, y: number): { x: number; y: number } {
    const pad = 12;
    const topSafe = 62; // Below #top-bar
    const bottomSafe = 68; // Above #bottom-dock
    const rect = el.getBoundingClientRect();
    const maxW = window.innerWidth - pad * 2;
    const maxH = window.innerHeight - topSafe - bottomSafe;
    if (rect.width > maxW) el.style.width = `${maxW}px`;
    if (rect.height > maxH) el.style.height = `${maxH}px`;
    const clampedX = Math.max(pad, Math.min(x, window.innerWidth - el.offsetWidth - pad));
    const clampedY = Math.max(topSafe, Math.min(y, window.innerHeight - el.offsetHeight - bottomSafe));
    return { x: clampedX, y: clampedY };
  }
  ```
- In `src/app/views.ts`, attach a single `ResizeObserver` to `#center-stage .canvas-wrap` 
  that updates `StrategyMapCanvas`, `WorkbenchCanvas`, and `LabBench3DCanvas` dimensions 
  using `Math.floor(entry.contentRect.width)` and `Math.floor(entry.contentRect.height)` 
  so canvas borders never overflow `.hud-panel`.

--------------------------------------------------------------------------------
PART 3: DASHBOARD DE-CLUTTER & PROGRESSIVE DISCLOSURE ARCHITECTURE
--------------------------------------------------------------------------------

3.1. Consolidating 11 Surfaces Down to 4 Clean Regions
1. **Top Bar (`#top-bar` - 52px height):**
   - Left: Game Title + Current Chapter Badge (`"Step 1: Make Wood Ash"`).
   - Center: **3 Simple Status Meters** with plain labels and color-coded progress bars:
     - `Camp Health` (0-100%, combines Hygiene & Sickness resistance)
     - `Stamina / Food` (0-100%, combines ATP/Calories & Hydration)
     - `Day Clock` (`Day 1 - 08:00` + `[Pause] [1x] [2x]` buttons)
   - Right: `[? Guide]` button (re-triggers interactive spotlight) + `[Settings]`.
2. **Left Sidebar (`#left-sidebar` - 280px width): Unified Pocket Inventory**
   - Single clean 2-column grid of owned items (`qty > 0`).
   - Filter Pills at top: `[All] [Raw] [Lab] [Soap & Tools]`.
   - Zero unowned items shown (eliminates clutter of 30+ locked chemicals).
   - Each slot shows: 32x32 SVG Icon (`icons.ts`), Plain Name, and Quantity Pill (`x4`).
   - Clicking an item shows a compact 2-line plain-English info bar at the bottom 
     of the sidebar.
3. **Center Stage (`#center-stage`): Mode-Switched Interactive Viewport**
   - Controlled by `#bottom-dock` mode buttons so only ONE view is rendered at a time:
     - **Mode 1: `[World Map]`** (`StrategyMapCanvas.ts` with clickable biome nodes 
       and floating harvest timing rings).
     - **Mode 2: `[Camp Workshop]`** (Visual cards to build/use Fire Pit, Kiln, 
       Leaching Barrel, and Rendering Pot).
     - **Mode 3: `[Soap Kettle & Lab]`** (`WorkbenchCanvas.ts` + `LabBench3DCanvas.ts` 
       interactive mixing, heating, and stirring station).
     - **Mode 4: `[Animal Paddock]`** (Feeding and tallow collection).
4. **Right Sidebar (`#right-sidebar` - 320px width): Active Goal & Timed Requests**
   - Top Section (Fixed 130px): **Current Guided Step** (Plain instruction + 1-click 
     `"Show Me Where"` spotlight button).
   - Bottom Section (Flex 1): **Timed Town Requests** (Max 3 active cards at once, 
     each with live countdown bar, required item icons, reward preview, and 
     `[Deliver]` button).

3.2. Progressive UI Gating (`src/app/state.ts` & `src/engine/progression.ts`)
- Add `unlockedUiFlags: number` bitmask to `UIState`:
  - `UI_FLAG_MAP = 1 << 0` (Active at game start)
  - `UI_FLAG_WORKSHOP = 1 << 1` (Unlocks after gathering 3 Firewood)
  - `UI_FLAG_SOAP_LAB = 1 << 2` (Unlocks after producing first Wood Ash)
  - `UI_FLAG_REQUESTS = 1 << 3` (Unlocks after producing first Lye Water)
  - `UI_FLAG_PADDOCKS = 1 << 4` (Unlocks in Chapter 2)
- Locked buttons in `#bottom-dock` are hidden (`display: none`) until unlocked, 
  accompanied by a brief pulse animation and toast when a new station unlocks.

--------------------------------------------------------------------------------
PART 4: PLAIN-ENGLISH TERMINOLOGY & DESCRIPTION CONVERSION TABLE
--------------------------------------------------------------------------------
Rule: Replace all archaic/alchemical names in `src/data/items.ts`, 
`src/data/speciesRegistry.ts`, `src/data/biomeNodes.ts`, and `src/data/story.ts`. 
Every description must be 1 sentence, max 14 words, 6th-grade reading level.

4.1. Items & Chemical Species (`src/data/items.ts` & `src/data/speciesRegistry.ts`)
| Internal ID | OLD Name / Jargon | NEW `displayName` | NEW `simpleDesc` (<= 14 words) |
| :--- | :--- | :--- | :--- |
| `timber_hardwood` | Silvicultural Hardwood | **Firewood** | Dry logs chopped from the forest. Burn in a fire pit for ash. |
| `wood_ash` | Calcined Potash Ash | **Wood Ash** | Gray ash from burned firewood. Soak in water to make Lye Water. |
| `potash_lye` | Lixiviated Potassa (KOH) | **Lye Water** | Strong liquid dripped from wood ash. Mix with melted fat to make soap. |
| `raw_suet` | Unrendered Adipose Suet | **Raw Animal Fat** | Fresh fat from animals. Melt it in a pot to make Clean Fat. |
| `rendered_tallow` | Clarified Tallow | **Melted Fat** | Clean, liquid animal fat. Boil with Lye Water to create soap. |
| `crude_soap` | Saponified Alkali Curd | **Soft Camp Soap** | Basic soap that washes away dirt and stops camp sickness. |
| `hard_bar_soap` | Salted Castile Bar | **Hard Soap Bar** | Long-lasting soap bar hardened with salt. Great for town requests. |
| `medicated_soap` | Carbolic Antiseptic Bar | **Doctor's Healing Soap** | Strong germ-killing soap used by the clinic to cure infections. |
| `brine_water` | Halite Evaporite Brine | **Salty Water** | Water rich in salt. Boil it down to get dry Salt Crystals. |
| `halite_salt` | Crystalline Halite (NaCl) | **Salt** | Turns soft soap into hard bars and keeps meat from spoiling. |
| `limestone_ca` | Calcareous Limestone | **Limestone Rock** | White stone from the quarry. Bake in a hot kiln to make Quicklime. |
| `quicklime_cao` | Calcined Quicklime (CaO) | **Quicklime Powder** | Hot mineral powder that makes Lye Water much stronger. |
| `soda_ash` | Calcined Natron (Na2CO3) | **Soda Ash** | Mineral powder used to craft hard soap and glass bottles. |
| `charcoal` | Pyrolyzed Charcoal | **Charcoal** | Burns much hotter than firewood and filters dirty well water. |
| `sulfuric_acid` | Oil of Vitriol (H2SO4) | **Battery Acid** | Strong acid used for metal cleaning and simple electric batteries. |
| `galena_ore` | Argentiferous Galena | **Lead Ore** | Heavy gray rock dug from mines. Melt down to make lead plates. |
| `chalcopyrite` | Chalcopyrite Ore | **Copper Ore** | Greenish rock from the hills. Melt in a furnace to make Copper. |

4.2. Biome Nodes (`src/data/biomeNodes.ts`)
| Node ID | OLD Archaic Label | NEW `displayName` | NEW Action Button Label |
| :--- | :--- | :--- | :--- |
| `forest_timber` | Silvicultural Stand | **Pine & Oak Woods** | `Chop Firewood` |
| `river_alluvium` | Riparian Alluvium | **Clear Riverbank** | `Fetch Water & Clay` |
| `salt_pan` | Evaporite Salt Flat | **Dry Salt Flats** | `Scoop Salty Water` |
| `limestone_bluff`| Calcareous Outcrop | **Limestone Cliffs** | `Mine Limestone` |
| `pasture_meadow` | Pastoral Grazing | **Grassy Meadow** | `Collect Animal Fat` |

--------------------------------------------------------------------------------
PART 5: ACTION-DRIVEN INTERACTIVE SPOTLIGHT TUTORIAL (`TutorialController.ts`)
--------------------------------------------------------------------------------

5.1. Spotlight State Machine Architecture
Replace the static slide-deck in `src/ui/TutorialController.ts` and `src/ui/tutorialCurriculum.ts` 
with a reactive, event-driven onboarding controller:

```ts
export interface InteractiveTutorialStep {
  id: string;
  title: string;
  instruction: string; // Max 18 words, plain English
  targetSelector: string; // Exact DOM selector to spotlight
  requiredViewMode?: 'map' | 'workshop' | 'lab' | 'paddock';
  completionPredicate: (state: WorldSnapshot, lastAction?: GameAction) => boolean;
}
```

5.2. The 6-Step Hands-On Onboarding Script (`src/ui/tutorialCurriculum.ts`)
1. **`STEP_1_CHOP_WOOD`**
   - Target: `[data-node-id="forest_timber"]` on `#strategy-map-canvas` / Biome card.
   - Text: `"Welcome! Click 'Pine & Oak Woods' and hit the green ring to chop 3 Firewood."`
   - Advances when: `inventory.timber_hardwood >= 3`.
2. **`STEP_2_BURN_ASH`**
   - Auto-unlocks `[Camp Workshop]` dock button and spotlights it.
   - Target: `[data-station-id="fire_pit"] .btn-interact`
   - Text: `"Open the Camp Workshop and burn your Firewood in the Fire Pit to make Wood Ash."`
   - Advances when: `inventory.wood_ash >= 1`.
3. **`STEP_3_DRIP_LYE`**
   - Target: `[data-station-id="leaching_barrel"] .btn-interact`
   - Text: `"Pour river water through the Wood Ash in the Leaching Barrel to drip Lye Water."`
   - Advances when: `inventory.potash_lye >= 1`.
4. **`STEP_4_MELT_FAT`**
   - Target: `[data-station-id="rendering_pot"] .btn-interact`
   - Text: `"Melt Raw Animal Fat in the Rendering Pot so it is clean and ready for soap."`
   - Advances when: `inventory.rendered_tallow >= 1`.
5. **`STEP_5_COOK_FIRST_SOAP`**
   - Auto-unlocks `[Soap Kettle & Lab]` and spotlights the kettle.
   - Target: `#workbench-kettle-zone`
   - Text: `"Pour Lye Water + Melted Fat into the kettle, keep the heat in the green zone, and stir!"`
   - Advances when: `inventory.crude_soap >= 1`.
6. **`STEP_6_DELIVER_TIMED_REQUEST`**
   - Auto-unlocks the Right Sidebar Timed Request queue and spawns the first request.
   - Target: `.request-card[data-request-id="req_tutorial_wash"] .btn-deliver`
   - Text: `"The Camp Doctor needs soap before the timer runs out! Click 'Deliver' to earn a bonus."`
   - Advances when: `completedRequests >= 1`.

5.3. Spotlight Overlay CSS (`src/ui/tutorial.css`)
- Render `#tutorial-spotlight-ring` using `position: fixed; pointer-events: none; z-index: 9000; border: 3px solid #ffd166; border-radius: 8px; box-shadow: 0 0 0 9999px rgba(10, 8, 6, 0.72), 0 0 18px #ffd166; transition: all 0.22s ease-out;`
- Reposition `#tutorial-spotlight-ring` via `getBoundingClientRect()` on every `requestAnimationFrame` while active so it tracks moving/scrolling targets without clipping.

--------------------------------------------------------------------------------
PART 6: TIMED REQUESTS & INTERACTIVE GAMEPLAY ENGINE SPECIFICATION
--------------------------------------------------------------------------------

6.1. Memory Layout & Worker Extensions for Timed Requests (`src/engine/memoryLayout.ts`, `src/engine/mandates.ts`, `src/engine/sim.worker.ts`)
- Expand `memoryLayout.ts` to allocate a dedicated block for **3 Concurrent Timed Requests** 
  (Slot 0, Slot 1, Slot 2), using 8 `Float64` fields per slot (24 floats total):
  - `REQ_BASE + slot * 8 + 0`: `requestId` (0 = empty, >0 = active template ID)
  - `REQ_BASE + slot * 8 + 1`: `requiredItemId`
  - `REQ_BASE + slot * 8 + 2`: `requiredQty`
  - `REQ_BASE + slot * 8 + 3`: `spawnTick`
  - `REQ_BASE + slot * 8 + 4`: `deadlineTick` (e.g., `spawnTick + 90` to `180` seconds)
  - `REQ_BASE + slot * 8 + 5`: `urgencyTier` (`1 = Standard`, `2 = Urgent`, `3 = Emergency`)
  - `REQ_BASE + slot * 8 + 6`: `rewardScore`
  - `REQ_BASE + slot * 8 + 7`: `penaltyHygieneDelta`
- Tick Loop Logic in `src/engine/sim.worker.ts`:
  - Every simulation tick (`1000ms` at 1x speed), iterate over the 3 request slots:
    1) Calculate `remainingRatio = (deadlineTick - currentTick) / (deadlineTick - spawnTick)`.
    2) If `currentTick >= deadlineTick`:
       - Apply failure penalty: `colony.hygiene = Math.max(0, colony.hygiene - penaltyHygieneDelta)` 
         and `colony.morale = Math.max(0, colony.morale - 8)`.
       - Emit `{ type: 'REQUEST_EXPIRED', slot, requestId }` to main thread (`Toast.ts` + warning sound).
       - Clear slot and schedule next request spawn in 10 ticks.
  - When player dispatches `{ type: 'FULFILL_REQUEST', slot }`:
    - Verify `inventory[requiredItemId] >= requiredQty`.
    - Deduct items.
    - Calculate **Speed Multiplier**:
      - `remainingRatio >= 0.50` (Green Zone): **1.5x Reward + +10 Camp Health Bonus ("Fast Delivery!")**
      - `0.20 <= remainingRatio < 0.50` (Amber Zone): **1.0x Standard Reward**
      - `remainingRatio < 0.20` (Red Zone): **1.0x Reward + "Close Call!" badge**

6.2. Interactive Soap Kettle Mini-Game (`src/ui/WorkbenchCanvas.ts` & `src/ui/gl/LabBench3DCanvas.ts`)
Replace passive reaction clicking with an interactive 3-Phase Kettle Controller rendered directly on `WorkbenchCanvas.ts` (and mirrored in 3D animations on `LabBench3DCanvas.ts`):

- **Phase 1: Pouring the Mix (Hold-to-Pour Gauge)**
  - UI on Canvas: Two interactive vessels above the kettle (`Lye Water Jug` and `Melted Fat Pot`).
  - Mechanic: Holding pointer down on a vessel pours a stream of liquid particles into the kettle and fills a vertical ratio bar. The player releases the pointer when the fill line lands inside the highlighted green **Target Band** ($45\% - 55\%$).
- **Phase 2: Bellows & Heat Control (10-Second Active Boil)**
  - UI on Canvas: A live Thermometer Gauge ($20^\circ\text{C} \rightarrow 120^\circ\text{C}$) and an interactive `[ Pump Bellows ]` button (or `Spacebar` keybind).
  - Mechanic: Heat naturally cools by $-6^\circ\text{C}/\text{sec}$. Each Bellows pump adds $+12^\circ\text{C}$. Keeping the thermometer inside the green **Saponification Zone** ($80^\circ\text{C} - 95^\circ\text{C}$) fills the `Reaction Progress` bar at $+20\%/\text{sec}$. Exceeding $105^\circ\text{C}$ triggers a `"Kettle Boiling Over!"` warning and foams the pot unless the player clicks `[ Splash Cool Water ]`.
- **Phase 3: Stirring to Trace (Circular / Rhythm Stir)**
  - UI on Canvas: Wooden Stirring Paddle inside the kettle with a circular motion guide.
  - Mechanic: Dragging the paddle in circles (or clicking the rhythmic pulse prompt) thickens the liquid color from translucent amber to creamy ivory (`Trace 0% -> 100%`).
  - Output Quality Tier:
    - **Perfect Batch (90-100% accuracy):** Yields **+1 Bonus Soap Bar** and $+50\%$ request value.
    - **Standard Batch (50-89% accuracy):** Yields normal recipe output.
    - **Ruined/Caustic Batch (<50%):** Yields `Scrap Slurry` (can be re-boiled with extra water so resources aren't permanently lost).

6.3. Interactive World Map Hotspots & Active Harvesting (`src/ui/StrategyMapCanvas.ts`, `src/engine/harvest.ts`)
- **Timed Resource Hotspots on Map:**
  - Every 45 seconds, `sim.worker.ts` spawns a glowing **Bonus Hotspot** on one unlocked biome node (e.g., `"Driftwood Pile - 30s"`, `"Rich Salt Crust - 30s"`, `"Fresh Honey & Herbs - 30s"`).
  - Clicking the hotspot on `StrategyMapCanvas.ts` before its 30-second radial ring expires grants **3x resource yield** with zero stamina cost.
- **Timing-Ring Harvest Boost:**
  - Clicking any biome node displays a 1.2-second contracting golden ring around the node on `StrategyMapCanvas.ts`. Clicking a second time when the ring crosses the inner circle triggers a `"Clean Strike! (+100% Yield)"` particle burst.

6.4. Interactive Camp Emergencies (`src/engine/crisis.ts`, `src/ui/CrisisModal.ts`)
- Replace blocking text modals in `CrisisModal.ts` with a live **Top-Center Emergency Banner** that counts down over **45 seconds**:
  - **Emergency 1: `"Muddy Well Water!" (45s)`** -> Player drags/clicks `Charcoal (x1)` or `Quicklime (x1)` onto the banner to purify the well before Camp Health drops by $-15\%$.
  - **Emergency 2: `"Grease Fire in Workshop!" (30s)`** -> Player rapidly clicks `[ Throw Sand / Water (5x) ]` on the banner to douse the flames.
  - **Emergency 3: `"Dirty Bandages at Clinic!" (60s)`** -> Player delivers `Soft Camp Soap (x2)` or `Doctor's Healing Soap (x1)` to stop an infection wave.

--------------------------------------------------------------------------------
PART 7: STEP-BY-STEP EXECUTION & TEST VERIFICATION CHECKLIST
--------------------------------------------------------------------------------

Step 1: Update `src/styles.css`, `src/ui/windows/windows.css`, and `public/index.html`
- Apply the 3-column `100dvw`/`100dvh` grid, `min-width: 0`/`min-height: 0` rules, 
  and `2px` card margins.
- Run `WindowManager.ts` viewport clamping tests at `1920x1080`, `1366x768`, and `390x844`.

Step 2: Simplify Strings in `src/data/items.ts`, `src/data/speciesRegistry.ts`, `src/data/biomeNodes.ts`, `src/data/story.ts`
- Replace all archaic names and descriptions with the Part 4 table values.
- Update `tests/items.test.ts` and `tests/storyCompleteness.test.ts` to assert 
  `item.description.split(' ').length <= 15`.

Step 3: Refactor Dashboard Panels (`src/app/panels.ts`, `src/app/views.ts`, `src/ui/ToolAndInventoryPanel.ts`)
- Consolidate top bar to 3 status meters + Day Clock.
- Filter `ToolAndInventoryPanel.ts` to show only owned items (`qty > 0`) with 
  plain-English tooltips.
- Implement progressive UI unlocking via `unlockedUiFlags`.

Step 4: Implement Timed Requests & Interactive Kettle (`src/engine/memoryLayout.ts`, `src/engine/mandates.ts`, `src/engine/sim.worker.ts`, `src/ui/WorkbenchCanvas.ts`, `src/ui/StrategyMapCanvas.ts`)
- Add the 24-float Timed Request block to `memoryLayout.ts` and wire tick countdowns 
  and speed multipliers in `sim.worker.ts`.
- Build the 3-phase interactive Soap Kettle (Pour, Bellows Heat, Stir to Trace) in `WorkbenchCanvas.ts`.
- Add 30-second Bonus Hotspots and timing-ring strikes to `StrategyMapCanvas.ts`.

Step 5: Implement Interactive Spotlight Tutorial (`src/ui/TutorialController.ts`, `src/ui/tutorialCurriculum.ts`, `src/ui/tutorial.css`)
- Replace the static image modal with the 6-step DOM spotlight state machine tied 
  to worker state predicates.
- Run `npm test` across all 30 Jest test suites (`tests/telegraphAndMandates.test.ts`, 
  `tests/surgicalAuditAndTutorial.test.ts`, `tests/soapWalkthrough.test.ts`) to 
  confirm 100% pass rate.