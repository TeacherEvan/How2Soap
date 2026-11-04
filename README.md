# The Grand Crucible (How2Soap) — A Turn-Based Alchemical Survival Odyssey

[![CI](https://github.com/TeacherEvan/How2Soap/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/TeacherEvan/How2Soap)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript: 5.4+](https://img.shields.io/badge/TypeScript-5.4+-blue.svg)](https://www.typescriptlang.org/)
[![Vitest: 100% Pass](https://img.shields.io/badge/Vitest-194%2F194%20Passed-brightgreen.svg)](https://vitest.dev/)
[![Bundle: 182 KB entry](https://img.shields.io/badge/Entrypoint-182%20KB%20%2F%20200%20KB-success.svg)](https://webpack.js.org/)
[![PWA: Offline-ready](https://img.shields.io/badge/PWA-Installable%20%2B%20Offline-blue.svg)](manifest.webmanifest)

An emergent thermodynamics, physical chemistry, and primitive survival simulation — **The Grand Crucible** is a turn-based alchemical survival odyssey: real chemistry, real consequences, one watch at a time. Zero external runtime dependencies. Features zero-copy Web Worker multithreading using atomic `SeqLock` shared memory, Arrhenius kinetics, calorimetry, latent heat phase transitions, electroneutrality pH calculations, Faraday electrolysis, and a full 5-tier technological progression from primitive fire to molten salt electrolysis. Installable as a PWA — fully playable offline.

---

## 🔬 Core Physical & Chemical Simulations

1. **Zero-Copy Concurrency & Atomic SeqLock**:
   - Flat 67,648-byte `SharedArrayBuffer` memory layout.
   - Atomic Sequence Lock (`syncFlags[0]`) prevents torn reads between the 10 Hz deterministic Web Worker and the 60 FPS UI thread.
   - Vercel COOP/COEP isolation headers (`same-origin`, `require-corp`).

2. **Thermodynamics & Phase Transition**:
   - Calorimetry solver: $\Delta T = \Delta Q / C_p$.
   - Phase-clamping boiling solver: prevents liquid overheating beyond boiling point ($T_{b,i}$) and transfers latent enthalpy into vapor moles $\Delta n_{\text{vap},i} = \Delta Q_{\text{excess}} / \Delta H_{\text{vap},i}$.
   - Condenser mechanics for fractional distillation (Ethanol, Water).

3. **Dynamic Electroneutrality pH Solver**:
   - Calculates strong ion difference $[\text{SID}] = \sum z_i [\text{Base}_i^+] - \sum z_j [\text{Acid}_j^-]$.
   - Solves $[\text{H}^+]$ against water auto-ionization $K_w = 1.0 \times 10^{-14}$ at $298.15\text{ K}$:
     $$[\text{H}^+] = \frac{[\text{SID}] + \sqrt{[\text{SID}]^2 + 4 K_w}}{2}, \quad \text{pH} = -\log_{10}\left([\text{H}^+]\right)$$

4. **Faraday Electrolysis Solver**:
   - Models aqueous brine splitting and high-temperature molten salt decomposition ($\text{KOH}$ and $\text{NaOH}$).
   - Decomposition threshold potentials and temperature gates.

---

## 🛠️ Complete 5-Tier Tech Progression

- **Tier 1: Survival & Mechanical Fabrication**
  - Two-compartment human metabolic model (Blood Glucose 0–2000 kcal, Adipose Reserves 15,000 kcal, BMR 70 kcal/h).
  - Environmental heat loss via clothing insulation ($I_{\text{clo}}$) and core body temperature tracking ($37.0^\circ\text{C}$).
  - Conchoidal flint knapping, softwood log carving (5L Bucket & 10L Trough), hide dehairing in alkaline ash water ($\text{pH } 11.2$), vegetable oak tannin cross-linking ($48\text{ ticks}$), and sinew awl stitching into the **24-slot Leather Backpack** (40 kg capacity).
- **Tier 2: Potash & Hard Bar Soap**
  - Wood drying via Fickian diffusion $\rightarrow$ High-temperature combustion ($1050\text{ K}$) $\rightarrow$ Hardwood Ash ($\text{K}_2\text{CO}_3 + \text{CaO}$).
  - Causticization: $\text{CaO} + \text{H}_2\text{O} \rightarrow \text{Ca(OH)}_2$; $\text{K}_2\text{CO}_3 + \text{Ca(OH)}_2 \rightarrow 2\text{KOH} + \text{CaCO}_3\downarrow$.
  - Decanting clear lye ($\text{pH} = 13.71$).
  - Arrhenius alkaline ester saponification with Tristearin fat at $345\text{ K}$:
    $$\text{C}_{57}\text{H}_{110}\text{O}_6 + 3\text{KOH} \longrightarrow 3\text{C}_{18}\text{H}_{35}\text{KO}_2 + \text{C}_3\text{H}_8\text{O}_3\text{ (Glycerol)}$$
  - Halite ($\text{NaCl}$) common-ion salting-out $\rightarrow$ **Sodium Stearate bar soap** ($154.4\text{ g}$).
- **Tier 3: High-Temperature Metallurgy**
  - Malachite ($\text{Cu}_2\text{CO}_3(\text{OH})_2$) and Cassiterite ($\text{SnO}_2$) carbothermic charcoal reduction at $1360\text{ K}$.
  - Alloying kinetics in carved soapstone molds ($88\text{ wt\% }\text{Cu} : 12\text{ wt\% }\text{Sn}$).
  - Casting the **Bronze Fork** (`EATING_UTENSIL` slot: $+15\%$ net caloric digestion efficiency, eliminates pathogen risk), Bronze Spear, and Bronze Axe.
- **Tier 4: Pharmaceuticals & Medicine**
  - Yeast fermentation of grain mash and fractional distillation at $351.5\text{ K}$ into $95\%$ antiseptic ethanol.
  - Acid hydrolysis and oxidation of White Willow bark Salicin $\rightarrow$ **Salicylic Acid** (febrifuge, $-1.8^\circ\text{C}$ fever reduction).
  - Submerged cultivation of *Penicillium chrysogenum* mold culture $\rightarrow$ **Penicillin** (cures lethal sepsis).
- **Tier 5: Voltaic Pile & Pure Elemental Isolation**
  - Sphalerite ($\text{ZnS}$) roasting $\rightarrow \text{ZnO} + \text{SO}_2$ ($1100\text{ K}$).
  - Niter bed Saltpeter ($\text{KNO}_3$) lead chamber oxidation $\rightarrow \text{H}_2\text{SO}_4$ ($2.5\text{ M}$).
  - 12-pair $\text{Cu}/\text{Zn}$ discs with acid-soaked leather $\rightarrow$ **Voltaic Pile Battery** ($13.2\text{ V DC}$, $1.10\text{ V/cell}$).
  - High-temperature molten salt electrolysis isolating **pure metallic Potassium ($\text{K}^0$)** and **Sodium ($\text{Na}^0$)**.

---

## 📜 What's New: The Grand Crucible

- **Grand Crucible Rebrand + PWA** (2026-11-04): Unified name across package, shell and docs; installable PWA (offline-first service worker, Web Manifest, CSP, OG tags); shell markup moved from JS strings into `index.html`; `main.ts` slimmed 1,194→359 LOC via the new `src/app/` orchestration layer; worker command dispatch is now compile-time exhaustive with unknown commands surfaced as in-game events (never silent); fixed two live command-protocol defects (dead "Charge to Vessel" button, condenser target never reaching the worker); `world.ts`/`sim.worker.ts` spine covered by 15 new test assertions; zero silent `catch {}` blocks remain in the tree.

- **Story & Chapter Progression**: 6 narrative chapters (from *The First Fire* to *The Lightning in the Bottle*) with Council of Solitude correspondence letters, dynamic Renown ranking (Apprentice through Grand Magister), and three distinct artisan affinities (*Apothecary*, *Soapwright*, *Forgewright*).
- **Survival Mechanics & Pathology**: Dual-compartment human metabolic burn, wild hunt animal wound risk, infection latency, septic fever, hypothermia, starvation death conditions, and clinical treatment applications.
- **Narrative Overlays & Audio**: Procedural typewriter prologue, chapter completions, victory/death overlays, and zero-asset synthesized Web Audio SFX (harvest thuds, clinks, chimes, stamps, level-ups, and ambient fire crackle).
- **Persistent World V2**: Continuous debounced auto-saving to `localStorage` (`how2soap.save.v2`), seamless Continue Chronicle / New World boot flows, and Gzip Base64 import/export with SHA-256 checksum verification (settled precipitate cloudiness gracefully re-settles upon world restoration).

---

## 📦 Project Structure

```
grand-crucible/  (working title How2Soap)
├── docs/plans/             # Master specification & architectural designs
├── public/                 # Shell markup, PWA manifest + service worker, icons, static assets
│   ├── index.html          # Static game shell (no JS-string HTML), CSP + OG meta
│   ├── manifest.webmanifest
│   ├── sw.js               # Offline-first service worker (hashed assets cache-first)
│   └── icons/              # 192/512 PNG + apple-touch icon (procedural PIL, zero-gen-AI)
├── src/
│   ├── app/                # Orchestration layer (extracted from main.ts)
│   │   ├── state.ts        # Shared state container + snapshot helpers
│   │   ├── dom.ts          # Element registry
│   │   ├── views.ts        # Vessel list / workbench / quest / log renderers
│   │   ├── panels.ts       # Tabs, paddock, player HUD, biome tree
│   │   ├── workerMessages.ts # Worker→UI dispatch (READY/VESSELS/EVENTS/PLAYER_SYNC/…)
│   │   ├── autosave.ts     # Debounced autosave + flush on hide
│   │   └── splash.ts       # Intro splash (reduced-motion aware)
│   ├── data/
│   │   ├── speciesRegistry.ts  # 38 registered chemical species & thermodynamic properties
│   │   ├── reactionRules.ts    # Arrhenius kinetics, precipitation, and electrolysis rules
│   │   └── biomeNodes.ts       # 3-level hierarchical Biome DAG (Trees, Rocks, Fungi, Animals)
│   ├── engine/
│   │   ├── memoryLayout.ts     # Flat 67,648-byte SharedArrayBuffer view & Atomic SeqLock
│   │   ├── chemistry.ts        # Calorimetry, phase changes, pH, and Faraday solver
│   │   ├── metabolism.ts       # Dual-compartment bio-energetics & clinical treatments
│   │   ├── fabrication.ts      # Mohs scaling, mechanical recipes & tool system
│   │   ├── husbandry.ts        # Live animal paddocks & renewable yields
│   │   ├── persistence.ts      # LocalStorage & Gzip Base64 import/export with SHA-256 integrity
│   │   ├── progression.ts      # Renown rank, affinity calculation, and objective evaluations
│   │   ├── conditions.ts       # Sepsis, hypothermia, fever, and starvation pathology
│   │   └── sim.worker.ts       # 10 Hz deterministic Web Worker simulation loop
│   ├── ui/
│   │   ├── BiomeTreePanel.ts       # Collapsible DAG explorer with energy cost telemetry
│   │   ├── WorkbenchCanvas.ts      # Multi-tab reaction, fabrication, paddock & journal workbench
│   │   ├── ToolAndInventoryPanel.ts# 6-slot Tool Menu & dynamic inventory containers
│   │   ├── JournalPanel.ts         # Council of Solitude letters, chapter tracking & milestones
│   │   ├── StoryMode.ts            # Typewriter prologue, splash screen & chapter overlays
│   │   ├── MenuController.ts       # WCAG 2.1 AAA settings & 38-species compendium modal
│   │   ├── mapMath.ts              # Pure projection/lighting math (split from StrategyMapCanvas)
│   │   └── audio.ts                # Synthesized Web Audio SFX & ambient soundscape
│   ├── main.ts             # Entry & wiring only (~360 LOC), COOP/COEP isolation detection
│   └── styles.css          # Responsive dark-theme 4-panel viewport styling
├── tests/                  # 40 Vitest test suites (194 tests passing 100%)
├── vercel.json             # Vercel deployment COOP/COEP isolation headers
└── webpack.config.js       # Webpack 5 production build with strict chunk budgets
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20 LTS+
- npm 10+

### Installation & Development
```bash
git clone https://github.com/TeacherEvan/How2Soap.git
cd How2Soap
npm install
npm start
```
Dev server will start at `http://localhost:8080/` with Cross-Origin Isolation headers enabled.

### Testing & Verification
```bash
# Run Vitest test suite (194 tests across 40 suites)
npm test

# Run TypeScript strict typecheck
npx tsc --noEmit

# Production Webpack build
npm run build
```

---

## 📄 License
MIT License. Free to use, adapt, and build upon.
