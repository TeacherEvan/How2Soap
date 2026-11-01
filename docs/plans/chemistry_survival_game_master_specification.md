# Master Technical Design Document: Emergent Chemistry & Survival Engine

## 0. Architectural Review & Final Audit Fixes

A full review of Drafts 1 through 3 identified four remaining low-level engineering gaps. All four are resolved in this unified specification:

1. **Zero-Copy Concurrency & Torn Reads (SeqLock Pattern)**:
   * *Audit Defect*: Even with a flat `SharedArrayBuffer` (`Float64Array`), if the $60\text{ FPS}$ UI thread reads `vesselMoles` while the $10\text{ Hz}$ Web Worker is mid-way through deducting reactants and adding products, the UI renders corrupted intermediate stoichiometry.
   * *Resolution*: `syncFlags[0]` acts as an atomic Sequence Lock (`SeqLock`). The Worker increments `syncFlags[0]` to an **odd** integer via `Atomics.add()` before mutating buffers, and increments it to an **even** integer upon completion. The UI thread reads `syncFlags[0]` before and after copying the $64\text{ KB}$ view; if the value is odd or changed between reads, it retries immediately.
2. **Latent Heat Phase-Clamping & Distillation Physics**:
   * *Audit Defect*: Draft 2 applied $\Delta T = \Delta Q / C_p$ unconditionally, allowing liquid water to heat to $500\text{ K}$ at $101.325\text{ kPa}$ without boiling.
   * *Resolution*: The thermodynamic solver clamps vessel temperature at the lowest boiling point $T_{b,i}$ of any liquid species present ($x_i > 0.01$) and diverts excess enthalpy $\Delta Q_{\text{excess}}$ into phase transition:
     $$\Delta n_{\text{vap},i} = \frac{\Delta Q_{\text{excess}}}{\Delta H_{\text{vap},i}}$$
     If a condenser is attached (`condenserTargetVesselId >= 0`), vapor moles transfer directly into the receiving vessel and condense; otherwise, they vent into the atmosphere (concentrating the remaining solution, such as boiling down weak wood-ash lye).
3. **Dynamic Electroneutrality $\text{pH}$ Solver**:
   * *Audit Defect*: Previous drafts tracked `pH` as a static float without computing $[\text{H}^+]$ from dissolved acid/base species.
   * *Resolution*: Every tick, aqueous vessels compute net strong ion charge difference $[\text{SID}] = \sum z_i [\text{Base}_i^+] - \sum z_j [\text{Acid}_j^-]$ and weak acid dissociation ($K_a$) against water auto-ionization ($K_w = 1.0 \times 10^{-14}$ at $298.15\text{ K}$):
     $$[\text{H}^+] = \frac{[\text{SID}] + \sqrt{[\text{SID}]^2 + 4 K_w}}{2}, \quad \text{pH} = -\log_{10}\left([\text{H}^+]\right)$$
4. **Persistence Layer & Save Compression**:
   * *Resolution*: Replaces synchronous `localStorage` with an asynchronous **IndexedDB** store (`chem_world_v1`) holding raw binary snapshots of the `SharedArrayBuffer` plus serialized entity DAG state, paired with `CompressionStream('gzip')` Base64 export/import in the Settings menu.

---

## 1. Webpack 5 & Vercel Edge Deployment Specification

To support `SharedArrayBuffer` in modern browsers, Vercel must serve strict Cross-Origin Isolation headers (`COOP: same-origin` and `COEP: require-corp`).

### 1.1 Vercel Configuration (`vercel.json`)

    {
      "version": 2,
      "buildCommand": "npm run build",
      "outputDirectory": "dist",
      "framework": null,
      "headers": [
        {
          "source": "/(.*)",
          "headers": [
            { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
            { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
            { "key": "Cross-Origin-Resource-Policy", "value": "same-origin" },
            { "key": "X-Content-Type-Options", "value": "nosniff" }
          ]
        },
        {
          "source": "/static/(.*)",
          "headers": [
            { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
          ]
        }
      ]
    }

### 1.2 Production Webpack 5 Configuration (`webpack.config.js`)

* **Runtime Target**: Node.js $20\text{ LTS}$, TypeScript $5.4+$, Web Worker native bundling via `new URL('./engine/sim.worker.ts', import.meta.url)`.
* **Strict Budgets**: Maximum entrypoint size $200,000\text{ bytes}$ ($200\text{ KB}$); maximum individual chunk size $180,000\text{ bytes}$ ($180\text{ KB}$).

    const path = require('path');
    const HtmlWebpackPlugin = require('html-webpack-plugin');
    const MiniCssExtractPlugin = require('mini-css-extract-plugin');
    const TerserPlugin = require('terser-webpack-plugin');

    module.exports = {
      mode: 'production',
      target: ['web', 'es2022'],
      entry: {
        main: './src/main.ts',
      },
      output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'static/js/[name].[contenthash:8].js',
        chunkFilename: 'static/js/[name].[contenthash:8].chunk.js',
        workerChunkLoading: 'import-scripts',
        assetModuleFilename: 'static/media/[name].[hash:8][ext]',
        clean: true,
      },
      resolve: {
        extensions: ['.ts', '.js'],
      },
      module: {
        rules: [
          {
            test: /\.ts$/,
            use: [{ loader: 'ts-loader', options: { transpileOnly: false } }],
            exclude: /node_modules/,
          },
          {
            test: /\.css$/,
            use: [MiniCssExtractPlugin.loader, 'css-loader'],
          },
        ],
      },
      optimization: {
        minimize: true,
        minimizer: [
          new TerserPlugin({
            terserOptions: {
              compress: { drop_console: true, passes: 2 },
              mangle: true,
            },
          }),
        ],
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          maxInitialRequests: 10,
          minSize: 20000,
          maxSize: 180000,
          cacheGroups: {
            chemRegistry: {
              test: /[\\/]src[\\/]data[\\/]/,
              name: 'chem-registry',
              priority: 20,
            },
            vendors: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
            },
          },
        },
      },
      performance: {
        maxEntrypointSize: 200000,
        maxAssetSize: 200000,
        hints: 'error',
      },
      plugins: [
        new HtmlWebpackPlugin({ template: './public/index.html', minify: true }),
        new MiniCssExtractPlugin({ filename: 'static/css/[name].[contenthash:8].css' }),
      ],
    };

---

## 2. Main Menu, Settings & Viewport Architecture

The UI layer runs at $60\text{ FPS}$ ($16.67\text{ ms}$ frame budget) driven by a deterministic Finite State Machine: `BOOT_CHECK` $\rightarrow$ `MAIN_MENU` $\leftrightarrow$ `SETTINGS_MODAL` $\rightarrow$ `ACTIVE_GAME_VIEW`.

### 2.1 Main Menu & Settings Best Practices
* **Main Menu Options**:
  1. **New Game**: Initializes a fresh $67,584\text{-byte}$ `SharedArrayBuffer`, seeds biome resource stocks within a $2.5\text{ km}$ radius, and sets player state to Day $1$, Tick $0$ ($06:00$), unclothed ($I_{\text{clo}} = 0.05$).
  2. **Continue**: Queries IndexedDB `chem_world_v1`. Enabled only if a valid save with matching schema checksum exists; displays saved Day/Tick, core body temperature ($^\circ\text{C}$), and active reaction count.
  3. **Settings**: Modal overlay accessible from both the Main Menu and in-game pause state (`ESC`).
  4. **Chemical Compendium**: Read-only encyclopedia populated dynamically as the player isolates elements and discovers compounds.
* **Settings Specifications**:
  * **Audio Routing**: WebAudio API graph with three independent `GainNode` channels (`Master`, `Reaction_SFX`, `Biome_Ambient`) adjustable from $0\%$ to $100\%$ ($-\infty\text{ dB}$ to $0\text{ dB}$).
  * **Visual & Accessibility (WCAG 2.1 AAA)**: High-contrast border toggle (minimum $7:1$ luminance ratio), colorblind-safe $\text{pH}$ and thermal palettes (Cividis/Viridis replacing red-green litmus), Reduced Motion toggle (disables particle boiling/smoke shaders), and root `rem` scaling ($100\%$, $125\%$, $150\%$).
  * **Simulation Speed Controls**: Sleep/Wait Fast-Forward multiplier ($10\times$ to $120\times$ base Worker tick rate) with automatic interrupt if player core temperature drops below $35.2^\circ\text{C}$ or a closed vessel approaches $85\%$ burst pressure.
  * **Save Data Management**: One-click **Export Save** (streams IndexedDB binary payload through `CompressionStream('gzip')` into a Base64 string with a SHA-256 integrity prefix) and **Import Save**.

### 2.2 Four-Panel Game Viewport (`100vw` $\times$ `100vh` CSS Grid)
1. **Top Telemetry Bar (`height: 48px`)**:
   * Displays **Blood Glucose** ($0\text{–}2000\text{ kcal}$), **Adipose Reserve** ($\text{kcal}$), **Hydration** ($0\text{–}100\%$), **Core Body Temp** ($37.0^\circ\text{C}$ nominal; hypothermia below $35.0^\circ\text{C}$, hyperthermia above $39.5^\circ\text{C}$), **Clothing Insulation** ($I_{\text{clo}}$), **Ambient Weather/Temp** ($\text{K}$ and $^\circ\text{C}$), and **Time/Sleep Control** ($1\text{ tick} = 1\text{ simulated hour}$, $24\text{ ticks} = 1\text{ day}$).
2. **Left Panel — Hierarchical Biome Explorer (`width: 340px`)**:
   * Collapsible 3-level DAG: **Category** (`Trees`, `Rocks & Outcrops`, `Mushrooms & Flora`, `Animals & Enclosures`) $\rightarrow$ **Species / Geological Deposit** $\rightarrow$ **Harvestable Part**.
   * Shows local stock count, foraging radius $d$ ($\text{meters}$), and exact caloric energy cost ($\text{kcal}$) dynamically recalculated from the currently equipped tool in the Tool Menu.
3. **Center Panel — Thermodynamics, Workbench & Camp (`1fr`)**:
   * Tabbed workspace switching between **Reaction Workbench** (interactive thermal sources, vessels, condensers, filtration, and electrolysis wiring), **Mechanical Fabrication Bench** (knapping, carving, stitching, molding), and **Domestication Paddocks / Drying Racks / Niter Beds**.
4. **Right Panel — Dedicated Tool Menu & Inventory (`width: 360px`)**:
   * **Top Section (Dedicated Tool Menu)**: Six specialized equipment slots:
     1. `CUTTING_SKINNING` (Flint Flake, Bronze Knife)
     2. `CHOPPING_CARVING` (Stone Axe, Flint Adze)
     3. `PERCUSSION_MINING` (Hammerstone, Antler Pick, Bronze Pickaxe)
     4. `THERMAL_HANDLING` (Wooden Tongs, Ceramic Crucible Tongs)
     5. `STITCHING_MEDICAL` (Bone Awl, Sterilized Bronze Needle)
     6. `EATING_UTENSIL` (Carved Wooden Spoon, **Bronze Fork**)
   * **Bottom Section (Inventory Containers)**:
     * **Bare Hands**: 2 slots, max $6.0\text{ kg}$ or $1$ bulk item per hand (always unlocked).
     * **Stationary Camp Ground Cache**: 6 slots at camp coordinates $(0,0)$, exposed to rain and night scavengers.
     * **Portable Backpack Grid**: **Locked at game start**. Unlocks $24\text{ slots}$ and $40.0\text{ kg}$ weather-protected payload only after crafting and equipping the **Vegetable-Tanned Leather Backpack**.

---

## 3. Shared Memory Layout & Off-Main-Thread Chemistry Engine

### 3.1 Zero-Copy `SharedArrayBuffer` Schema (`src/engine/memoryLayout.ts`)

    export const MAX_VESSELS = 32;
    export const MAX_SPECIES = 256;
    export const TELEMETRY_STRIDE = 8; // [tempK, pH, pressureKPa, volumeL, maxTempK, maxPressKPa, heatWatts, flags]
    export const SAB_BYTE_LENGTH = 67584; // 64B header + 2048B telemetry + 65536B moles

    export class SharedWorldView {
      public readonly syncFlags: Int32Array;         // Index 0: SeqLock counter, Index 1: World Tick
      public readonly vesselTelemetry: Float64Array; // 32 * 8 Float64s
      public readonly vesselMoles: Float64Array;     // 32 * 256 Float64s

      constructor(sab: SharedArrayBuffer) {
        this.syncFlags = new Int32Array(sab, 0, 16);
        this.vesselTelemetry = new Float64Array(sab, 64, MAX_VESSELS * TELEMETRY_STRIDE);
        this.vesselMoles = new Float64Array(sab, 64 + MAX_VESSELS * 64, MAX_VESSELS * MAX_SPECIES);
      }

      public beginWorkerWrite(): void {
        Atomics.add(this.syncFlags, 0, 1); // Becomes ODD (write in progress)
      }

      public endWorkerWrite(currentTick: number): void {
        Atomics.store(this.syncFlags, 1, currentTick);
        Atomics.add(this.syncFlags, 0, 1); // Becomes EVEN (snapshot consistent)
      }

      public getMoles(vesselIdx: number, speciesIdx: number): number {
        return this.vesselMoles[vesselIdx * MAX_SPECIES + speciesIdx];
      }

      public setMoles(vesselIdx: number, speciesIdx: number, moles: number): void {
        this.vesselMoles[vesselIdx * MAX_SPECIES + speciesIdx] = Math.max(0, moles);
      }
    }

### 3.2 Stoichiometric, Thermodynamic, Phase & Electrolysis Solver (`src/engine/chemistry.ts`)

Every tick ($\Delta t$), the Worker evaluates five physical laws per vessel:
1. **Arrhenius Reaction Kinetics**:
   $$k = A \cdot \exp\left(-\frac{E_a}{R \cdot T}\right), \quad \Delta \xi = \xi_{\max} \left(1 - \exp(-k \cdot \Delta t)\right)$$
2. **Calorimetry & Newtonian Thermal Loss**:
   $$Q_{\text{net}} = \sum \left(-\Delta H_{\text{rxn},r} \cdot \Delta \xi_r\right) + \left(P_{\text{heater}} - \frac{\kappa \cdot A_{\text{wall}} \cdot (T_{\text{vessel}} - T_{\text{ambient}})}{d_{\text{wall}}}\right) \Delta t$$
3. **Latent Heat Boiling & Vapor Condensation**:
   When $T_{\text{vessel}} \ge T_{b,i}$ for any volatile liquid $i$, temperature clamps at $T_{b,i}$ and excess heat $\Delta Q_{\text{boil}}$ vaporizes $\Delta n_i = \Delta Q_{\text{boil}} / \Delta H_{\text{vap},i}$.
4. **Solubility Product ($K_{sp}$) Precipitation & Decanting**:
   When aqueous ion product exceeds saturation solubility $S(T)$ (g per $100\text{ g}$ $\text{H}_2\text{O}$), excess moles precipitate into the solid phase at the bottom of the vessel (enabling decanting/filtration).
5. **Faraday Electrolysis (when connected to a Voltaic Pile)**:
   $$\Delta n_{\text{elec}} = \frac{I \cdot \Delta t}{F \cdot z}, \quad I = \frac{\max\left(0, V_{\text{applied}} - E_{\text{rev}}^\circ - \eta_{\text{overpotential}}\right)}{R_{\text{cell}}}$$

    export interface ChemicalSpecies {
      readonly index: number;             // 0..255 static ID
      readonly code: string;              // e.g., 'H2O', 'K2CO3', 'KOH', 'CaCO3'
      readonly molarMass: number;         // g/mol
      readonly specificHeat: number;      // J/(g*K)
      readonly standardPhase: 'SOLID' | 'LIQUID' | 'GAS' | 'AQUEOUS';
      readonly boilingPointK: number;
      readonly enthalpyVapJPerMol: number;
      readonly solubilityGPer100gH2O: number;
      readonly ionChargeZ: number;        // +1 for K+, Na+; -1 for OH-; -2 for SO4^2-
      readonly precipitateSpeciesIdx?: number;
    }

    export interface ReactionRule {
      readonly id: string;
      readonly reactants: ReadonlyArray<{ speciesIdx: number; stoich: number }>;
      readonly products: ReadonlyArray<{ speciesIdx: number; stoich: number }>;
      readonly activationEnergyJ: number; // Ea (J/mol)
      readonly preExponentialA: number;   // Frequency factor A (1/s)
      readonly enthalpyJPerMol: number;   // dH (J/mol): < 0 exothermic, > 0 endothermic
      readonly minpH?: number;
      readonly maxpH?: number;
    }

    export interface ElectrolysisRule {
      readonly electrolyteSpeciesIdx: number;
      readonly anodeProductIdx: number;
      readonly anodeStoich: number;
      readonly cathodeProductIdx: number;
      readonly cathodeStoich: number;
      readonly minDecompositionVolts: number; // E_rev + overpotential
      readonly electronsZ: number;
    }

---

## 4. Bio-Thermodynamic Player Model & Hierarchical World Nodes

### 4.1 Player Metabolic & Thermal Equations
The player's energy is governed by a two-compartment bio-energetic model: **Blood Glucose & Glycogen ($0\text{–}2000\text{ kcal}$)** for immediate mechanical work, and **Body Fat Reserves ($15,000\text{ kcal}$ starting)** mobilized during fasting/sleep.

$$\dot{E}_{\text{burn}} = \text{BMR}_{70\text{ kcal/hr}} + \frac{\dot{W}_{\text{mechanical}}}{\eta_{\text{human}}} + \max\left(0, \frac{T_{\text{core}} - T_{\text{ambient}}}{0.155 \cdot I_{\text{clo}}}\right)$$

* **Muscular Efficiency**: $\eta_{\text{human}} = 0.22$ ($22\%$ conversion of dietary kilocalories into mechanical joules; $1\text{ kcal} = 4184\text{ J}$).
* **Tool Mechanical Advantage ($MA$) & Mohs Hardness Scaling**:
  $$E_{\text{harvest}} = \frac{W_{\text{fracture}}}{MA_{\text{tool}}} \cdot \left(\frac{\text{Mohs}_{\text{target}}}{\text{Mohs}_{\text{tool}}}\right)^2 + E_{\text{haul}}(d)$$
* **Radial Foraging & Transport Cost ($E_{\text{haul}}$)**:
  Every biome species has a local population within $d_0 = 50\text{ m}$ of camp. Depleting local nodes expands the foraging distance $d$, adding round-trip transport cost:
  $$E_{\text{haul}}(d) = \frac{(m_{\text{player}} + m_{\text{carried}}) \cdot g \cdot c_{\text{terrain}} \cdot 2d}{\eta_{\text{human}} \cdot 4184}$$
  Because Bare Hands carry only $12\text{ kg}$ max across 2 slots, harvesting beyond $200\text{ m}$ requires $3.3\times$ more walking trips than carrying $40\text{ kg}$ in the **Leather Backpack**.

### 4.2 Hierarchical Biome Resource Matrix (Click-to-Expand DAG)

#### Node 1: Trees (Click to Expand Wood & Botanical Subtypes)
| Subtype | Species | Harvestable Parts | Base Work ($W_{\text{fracture}}$) | Chemical Composition & Moisture | Primary Gameplay Utility |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hardwood** | *Quercus alba* (White Oak) | Heartwood Log, Outer Bark, Acorns | $180\text{ kJ}$ (Requires Axe $\text{Mohs} \ge 5$) | $45\%$ $\text{H}_2\text{O}$ green; Ash $= 18\%$ $\text{K}_2\text{CO}_3$, $32\%$ $\text{CaO}$; Bark $= 14\%$ Tannic Acid | High-temperature fuel ($1050\text{ K}$), Potash Lye ($\text{KOH}$) precursor, Vegetable leather tanning |
| **Hardwood** | *Acer saccharum* (Sugar Maple) | Heartwood Log, Sap ($2.5\%$ Sucrose) | $165\text{ kJ}$ | $42\%$ $\text{H}_2\text{O}$ green; Ash $= 21\%$ $\text{K}_2\text{CO}_3$; Sap boils to Sucrose ($\text{C}_{12}\text{H}_{22}\text{O}_{11}$) | Highest $\text{K}_2\text{CO}_3$ yield for soap; sucrose fermentation into Ethanol ($\text{C}_2\text{H}_5\text{OH}$) |
| **Softwood** | *Pinus sylvestris* (Scots Pine) | Softwood Trunk, Deadfall, Oleoresin, Needles | $95\text{ kJ}$ ($25\text{ kJ}$ Deadfall) | $35\%$ $\text{H}_2\text{O}$; $6\%$ Terpene/Abietic Resin; Needles $= 85\text{ mg}/100\text{g}$ Vitamin C | Easy carving for **Wooden Bucket**; distills into Turpentine & Rosin pitch; prevents scurvy |
| **Soft Hardwood** | *Salix alba* (White Willow) | Inner Phloem Bark, Withy Shoots | $40\text{ kJ}$ | Bark $= 2.8\text{ wt\%}$ Salicin ($\text{C}_{13}\text{H}_{18}\text{O}_7$); Flexible cellulose shoots | Acid hydrolysis into **Salicylic Acid** (analgesic/antipyretic); early basketry |

#### Node 2: Rocks & Outcrops (Click to Expand Geological Subtypes)
| Subtype | Mineral Deposit | Mohs | Harvest Cost (with Hammer/Pick) | Chemical Formula | Primary Gameplay Utility |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Silicates** | Chert / Flint Nodules | $7.0$ | $16\text{ kcal}$ | $\text{SiO}_2$ (Cryptocrystalline) | Conchoidal fracture knapping into $0.05\,\mu\text{m}$ skinning blades, scrapers, and adzes |
| **Silicates** | Kaolinite Clay Bed | $2.0$ | $22\text{ kcal}$ | $\text{Al}_2\text{Si}_2\text{O}_5(\text{OH})_4$ | Fires at $1373\text{ K}$ into waterproof stoneware vessels and metallurgical crucibles |
| **Carbonates** | Limestone Outcrop | $3.0$ | $30\text{ kcal}$ | $\text{CaCO}_3$ | Calcines above $1100\text{ K}$ into Quicklime ($\text{CaO}$) for causticizing soda/potash into strong lye |
| **Evaporites** | Halite & Natron Beds | $2.5$ | $24\text{ kcal}$ | $\text{NaCl}$ & $\text{Na}_2\text{CO}_3 \cdot 10\text{H}_2\text{O}$ | Meat preservation, salting-out hard bar soap ($\text{C}_{18}\text{H}_{35}\text{NaO}_2$), Chlor-Alkali electrolysis |
| **Ores & Sulfides** | Malachite & Cassiterite | $4.0\text{–}6.5$ | $65\text{ kcal}$ | $\text{Cu}_2\text{CO}_3(\text{OH})_2$ & $\text{SnO}_2$ | Carbothermic smelting with charcoal into $88:12$ **Bronze** (tools, **Bronze Fork**, surgical gear) |
| **Ores & Sulfides** | Sphalerite & Pyrite | $4.0\text{–}6.5$ | $70\text{ kcal}$ | $\text{ZnS}$ & $\text{FeS}_2$ | Roasting yields $\text{ZnO} \rightarrow \text{Zn}$ anodes and $\text{SO}_2 \rightarrow \text{SO}_3 \rightarrow \text{H}_2\text{SO}_4$ battery acid |

#### Node 3: Mushrooms & Flora
* **Agaricus bisporus (Field Mushroom)**: Safe edible ($22\text{ kcal}/100\text{ g}$ raw, $38\text{ kcal}/100\text{ g}$ cooked with fat).
* **Fomes fomentarius (Hoof Tinder Fungus)**: Fibrous trama layer boiled in dilute wood-ash lye ($\text{K}_2\text{CO}_3$) and dried produces *Amadou*, catching sparks from Flint + Pyrite ($\text{FeS}_2$) with $95\%$ reliability.
* **Penicillium chrysogenum (Mold Culture)**: Cultivated on spoiled cooked grain substrate in dark vessels at $297\text{ K}$ for $96\text{ ticks}$; extracted at $\text{pH } 6.8$ to treat lethal systemic bacterial infections.
* **Amanita phalloides (Death Cap)**: Contains amatoxins; requires performing a $4\text{-tick}$ **Spore Print Test** (white gill print vs. brown *Agaricus* print) before consumption.

#### Node 4: Animals (Hunting & Live Farming across 4 Size Classes)
Players can either **Hunt (Lethal)** for immediate carcass harvesting or **Capture Alive** ($+20\%$ transport energy cost) to stock a crafted **Split-Rail Paddock** for renewable farming.

| Size Class | Species | Mass Range | Hunt Energy & Required Tool | Slaughter Yield (Hunting / Culling) | Live Farming Daily Input & Renewable Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Small** | Hare, Red Jungle Fowl | $1.5\text{–}3.2\text{ kg}$ | $45\text{ kcal}$ (Snare / Throwing Stone) | $1\times$ Small Pelt, $45\text{ g}$ Adipose Fat, $600\text{ g}$ Meat, Small Bones | Input: $150\text{ g}$ Seeds/Greens + $0.2\text{ L}$ $\text{H}_2\text{O}$. Output: $1\times$ Egg ($75\text{ kcal}$), $40\text{ g}$ High-N Guano |
| **Medium** | Roe Deer, Wild Boar, Goat | $25\text{–}65\text{ kg}$ | $160\text{ kcal}$ (Fire-Hardened Spear / Bow) | $1\times$ **Medium Hide** ($1.2\text{ m}^2$), $2.5\text{ kg}$ Suet/Lard, $14\text{ kg}$ Meat, Sinew, Femur | Input: $2.5\text{ kg}$ Fodder/Acorns + $4.0\text{ L}$ $\text{H}_2\text{O}$. Output: $1.2\text{ L}$ Milk ($54\text{ g}$ Butterfat), $800\text{ g}$ Manure |
| **Large** | Elk, Aurochs Cow | $200\text{–}420\text{ kg}$ | $410\text{ kcal}$ (Flint Atlatl / Pitfall Trap) | $1\times$ Heavy Hide ($3.5\text{ m}^2$), $15\text{ kg}$ Tallow, $85\text{ kg}$ Meat, Horn, Bladder | Input: $9.0\text{ kg}$ Hay + $25\text{ L}$ $\text{H}_2\text{O}$. Output: $6.0\text{ L}$ Milk ($270\text{ g}$ Butterfat), $5.0\text{ kg}$ Manure, Draft Hauling |
| **Extra Large** | Steppe Bison, Bull Moose | $550\text{–}950\text{ kg}$ | $780\text{ kcal}$ (Bronze Spear + Deadfall) | $2\times$ Heavy Hides ($7.0\text{ m}^2$), $38\text{ kg}$ Tallow, $240\text{ kg}$ Meat, Heavy Ribs | Not domesticable until Tier 4 Reinforced Timber Corral |

---

## 5. Mechanical Fabrication & The Leather Backpack Prerequisite

Before the **Leather Backpack** is crafted, the player is restricted to **2 Bare Hand slots** ($6.0\text{ kg}$ max each) and the stationary **Camp Ground Cache** ($6\text{ slots}$). All physical tool-shaping and leatherworking runs through the Mechanical Fabrication Engine (`src/engine/fabrication.ts`).

### Step-by-Step Leather Backpack Unlock Pipeline
1. **Knap Flint Skinning Blade & Adze**:
   * Gather `FLINT_NODULE` ($\text{Mohs } 7.0$) and `RIVER_HAMMERSTONE` ($\text{Mohs } 6.5$).
   * Execute `KNAP` operation ($12\text{ kcal}$): yields `FLINT_FLAKE_BLADE` and `FLINT_ADZE_HEAD`. Lash adze to a branch with plant fiber to equip `FLINT_ADZE` in the Dedicated Tool Menu (`CHOPPING_CARVING` slot).
2. **Carve a Dugout Tanning Trough / Bucket**:
   * Harvest a Softwood (*Pinus sylvestris*) log ($35\%$ moisture, $\text{Mohs } 1.8$).
   * Execute `CARVE_HOLLOW` with equipped `FLINT_ADZE` ($38\text{ kcal}$): yields a $10\text{ L}$ `WOODEN_TROUGH` (or $5\text{ L}$ `WOODEN_BUCKET`) + $400\text{ g}$ `PINE_SHAVINGS` (tinder).
3. **Hunt & Skin a Medium Animal**:
   * Craft a `FIRE_HARDENED_WOOD_SPEAR` and hunt a Medium Animal ($160\text{ kcal}$).
   * Equip `FLINT_FLAKE_BLADE` (`CUTTING_SKINNING` slot) and skin the carcass ($35\text{ kcal}$) to obtain $1\times$ `RAW_MEDIUM_HIDE` ($4.0\text{ kg}$ collagen dermis), $2.5\text{ kg}$ `RAW_ADIPOSE_FAT`, and `DEER_SINEW`.
4. **Alkaline Dehairing & Fleshing**:
   * Scrape subcutaneous fat from the hide ($25\text{ kcal}$) and soak in weak wood-ash water ($\text{pH } 11.2$) for $12\text{ ticks}$ to loosen hair follicles without hydrolyzing the dermis.
5. **Vegetable Tanning (Tannic Acid Collagen Cross-Linking)**:
   * Strip $2.0\text{ kg}$ of `WHITE_OAK_BARK`, crush with a hammerstone to increase surface area, and steep in the `WOODEN_TROUGH` with $6.0\text{ L}$ water ($\text{H}_2\text{O}$) to leach $0.08\text{ M}$ Tannic Acid ($\text{C}_{76}\text{H}_{52}\text{O}_{46}$, $\text{pH } 4.20$).
   * Submerge the `DEHAIRED_HIDE` in the tannin liquor and sleep/wait for $48\text{ ticks}$ ($2\text{ days}$). Polyphenols cross-link the collagen peptide chains, raising thermal shrinkage resistance from $335\text{ K}$ to $358\text{ K}$ and outputting rot-proof `VEGETABLE_TANNED_LEATHER`.
6. **Stitching the Backpack**:
   * Carve a `BONE_AWL` from animal bone, equip it in `STITCHING_MEDICAL`, and stitch the `VEGETABLE_TANNED_LEATHER` with `DRIED_SINEW` ($40\text{ kcal}$) to equip the **Leather Backpack** ($24\text{ portable grid slots}$, $40.0\text{ kg}$ capacity, waterproof flap).

---

## 6. Walkthrough of the Canonical Gameplay Loop: Making Soap from Scratch

Below is the exact execution trace of the user prompt's soap scenario inside the state engine:

1. **Selecting & Drying Wood (`Tick 0` to `Tick 24`)**:
   * Player clicks **Trees**, inspects **Softwood (Scots Pine)** vs. **Hardwood (White Oak)**, and harvests both using a Stone Axe.
   * *Why Softwood fails for Lye*: Pine contains terpene resins and only $0.4\text{ wt\%}$ potassium in its ash; burning it yields carbon soot and pine tar. However, its low density ($0.47\text{ g/cm}^3$) makes it ideal for carving the **Wooden Bucket**.
   * *Why Green Hardwood must be dried*: Fresh White Oak contains $45\text{ wt\%}$ water. Evaporating that water absorbs $2260\text{ kJ/kg}$, capping fire temperature below the $1050\text{ K}$ calcination threshold. Placing $5.0\text{ kg}$ of White Oak on the Camp Drying Rack and sleeping $1\text{ day}$ ($24\text{ ticks}$) reduces moisture to $12\text{ wt\%}$ via Fickian vapor diffusion.
2. **Carving the Wooden Bucket (`Tick 24`)**:
   * Player equips the **Flint Adze** in the Tool Menu and executes `CARVE_HOLLOW` on the Softwood log ($38\text{ kcal}$), producing a $5.0\text{ L}$ `WOODEN_BUCKET` ($T_{\text{max}} = 523\text{ K}$).
3. **Combustion & Calcination (`Tick 25` to `Tick 28`)**:
   * Player ignites the seasoned White Oak in the Camp Firepit ($1050\text{ K}$).
   * Complete combustion of $5.0\text{ kg}$ seasoned Oak produces $75\text{ g}$ of `HARDWOOD_ASH` containing $13.5\text{ g}$ Potassium Carbonate ($\text{K}_2\text{CO}_3 = 0.0977\text{ mol}$), $24.0\text{ g}$ Quicklime ($\text{CaO} = 0.428\text{ mol}$), and inert silica.
4. **Leaching Lye & Sleeping One Day (`Tick 28` to `Tick 52`)**:
   * Player fills the `WOODEN_BUCKET` with $1.0\text{ L}$ water ($55.5\text{ mol}$ $\text{H}_2\text{O}$) and adds $200\text{ g}$ accumulated `HARDWOOD_ASH` ($0.260\text{ mol}$ $\text{K}_2\text{CO}_3$ + $1.14\text{ mol}$ $\text{CaO}$).
   * Hydration and double-displacement causticization proceed in the Worker while the player sleeps $1\text{ day}$ ($24\text{ ticks}$, restoring $1400\text{ kcal}$ energy):
     $$\text{CaO}(s) + \text{H}_2\text{O}(l) \longrightarrow \text{Ca(OH)}_2(aq) \quad (\Delta H = -63.7\text{ kJ/mol})$$
     $$\text{K}_2\text{CO}_3(aq) + \text{Ca(OH)}_2(aq) \longrightarrow 2\text{KOH}(aq) + \text{CaCO}_3(s)\downarrow$$
   * Because $\text{CaCO}_3$ is practically insoluble ($S = 0.0013\text{ g}/100\text{ g}$ $\text{H}_2\text{O}$), it precipitates as solid chalk at the bottom of the bucket.
5. **Draining the Lye (`Tick 52`)**:
   * Player clicks **Decant / Drain Liquid** on the `WOODEN_BUCKET`, pouring off $0.95\text{ L}$ of clear aqueous **Potassium Hydroxide ($\text{KOH}$)** lye ($0.520\text{ mol}$ $\text{KOH}$, $\text{pH} = 13.71$) while leaving the $\text{CaCO}_3$ sludge behind.
6. **Rendering Animal Fat & Saponification (`Tick 53` to `Tick 55`)**:
   * Player takes $200\text{ g}$ of adipose fat harvested from hunting a Wild Boar (or butterfat churned from farmed Goat milk) and renders it at $385\text{ K}$ ($112^\circ\text{C}$) in a fired clay pot to isolate $150\text{ g}$ ($0.168\text{ mol}$) purified **Tristearin ($\text{C}_{57}\text{H}_{110}\text{O}_6$)**.
   * Player pours the $0.520\text{ mol}$ $\text{KOH}$ lye into the warm fat ($345\text{ K} / 72^\circ\text{C}$, safely below the $523\text{ K}$ charring point if mixed in wood, or heated gently in clay).
   * The Arrhenius solver executes alkaline ester hydrolysis ($E_a = 58.2\text{ kJ/mol}$, $A = 1.4 \times 10^6\text{ s}^{-1}$):
     $$\text{C}_{57}\text{H}_{110}\text{O}_6 + 3\text{KOH}(aq) \longrightarrow 3\text{C}_{18}\text{H}_{35}\text{KO}_2\text{ (Potash Liquid Soap)} + \text{C}_3\text{H}_8\text{O}_3\text{ (Glycerol)}$$
   * *Optional Hard Bar Upgrade*: Adding $50\text{ g}$ of mined Halite ($\text{NaCl}$) drives ion exchange and common-ion salting-out, precipitating solid **Sodium Stearate ($\text{C}_{18}\text{H}_{35}\text{NaO}_2$)** bar soap ($154.4\text{ g}$) at the surface while leaving glycerol in the bottom brine layer.

---

## 7. Complete Master Tech Progression: Clothes, Forks, Soap, Medicine & Electricity

| Tier | Milestone Deliverable | Biome Raw Materials | Chemical / Physical Synthesis Pathway | Exact In-Game System Effect |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Leather Backpack & Tunic** | Medium Animal Hide, White Oak Bark, Flint, Deer Sinew, Water | Alkaline dehairing ($\text{pH } 11.2$) $\rightarrow$ $0.08\text{ M}$ Tannic Acid ($\text{C}_{76}\text{H}_{52}\text{O}_{46}$) soak ($48\text{ ticks}$) $\rightarrow$ Bone Awl sinew stitching | Unlocks **24-Slot Portable Inventory** ($40\text{ kg}$ cap); raises thermal insulation $I_{\text{clo}}$ from $0.05$ to $1.15$ (prevents nocturnal hypothermia drain) |
| **2** | **Potash & Hard Bar Soap** | White Oak Log, Softwood Log, Animal Fat, Water, Halite ($\text{NaCl}$) | Wood seasoning $\rightarrow$ Pyrolysis ($1050\text{ K}$) $\rightarrow$ $\text{K}_2\text{CO}_3 + \text{Ca(OH)}_2 \rightarrow 2\text{KOH} + \text{CaCO}_3\downarrow$ $\rightarrow$ Tristearin saponification at $345\text{ K}$ | Cuts wound & surgical infection probability from $35\%$ to $2\%$; removes nonpolar grease; yields Glycerol ($\text{C}_3\text{H}_8\text{O}_3$) byproduct |
| **3** | **Bronze Fork & Metallurgy** | Malachite, Cassiterite, Hardwood Charcoal, Kaolin Clay, Soapstone | Forced-draft charcoal reduction at $1360\text{ K}$: $\text{Cu}_2\text{CO}_3(\text{OH})_2 + \text{C} \rightarrow 2\text{Cu} + 2\text{CO}_2 + \text{H}_2\text{O}$; alloyed $88\text{ wt\% }\text{Cu} : 12\text{ wt\% }\text{Sn}$ in carved mold | Equipped in `EATING_UTENSIL` slot: eliminates enteric parasite/pathogen risk on cooked food and grants $+15\%$ net caloric digestion efficiency |
| **4** | **Medicines (Salicylic Acid, Ethanol & Penicillin)** | White Willow Bark, Maple Sap / Grain, Pyrite ($\text{FeS}_2$), *Penicillium* spores | 1) Yeast fermentation + fractional distillation at $351.5\text{ K} \rightarrow 95\%$ $\text{C}_2\text{H}_5\text{OH}$. 2) Acid hydrolysis of Salicin + oxidation $\rightarrow$ **Salicylic Acid** ($\text{C}_7\text{H}_6\text{O}_3$). 3) Submerged mold broth extraction | **Salicylic Acid**: reduces fever hyperthermia ($-1.8^\circ\text{C}$) and pain penalty. **Ethanol**: topical antiseptic. **Penicillin**: cures lethal systemic sepsis |
| **5** | **Voltaic Pile & Pure Elements** | Malachite ($\text{Cu}$), Sphalerite ($\text{ZnS}$), Pyrite ($\text{FeS}_2$), Saltpeter ($\text{KNO}_3$), Halite ($\text{NaCl}$) | Roast $\text{ZnS} \rightarrow \text{ZnO} + \text{SO}_2$; oxidize $\text{SO}_2$ with $\text{KNO}_3$ in lead/ceramic chamber $\rightarrow \text{H}_2\text{SO}_4$ ($2.5\text{ M}$). Stack $12\times$ $\text{Cu}/\text{Zn}$ discs separated by acid-soaked leather: $\text{Zn} + \text{Cu}^{2+} \rightarrow \text{Zn}^{2+} + \text{Cu}$ | Generates **$13.2\text{ V DC}$** ($1.10\text{ V/cell}$). Drives Faraday electrolysis of Brine ($\text{Cl}_2\uparrow, \text{H}_2\uparrow, \text{NaOH}$) and molten $\text{KOH}/\text{NaOH}$ to isolate pure metallic **$\text{K}^0$** and **$\text{Na}^0$** |

---

## 8. Project Directory Structure for Vercel Deployment

    chemistry-survival/
    ├── package.json
    ├── tsconfig.json
    ├── vercel.json
    ├── webpack.config.js
    ├── public/
    │   └── index.html
    └── src/
        ├── main.ts                     # UI bootstrap, COOP/COEP check, Worker spawn
        ├── data/
        │   ├── speciesRegistry.ts      # 256 indexed chemical species & physical constants
        │   ├── reactionRules.ts        # Arrhenius kinetics, Ksp, and electrolysis rules
        │   └── biomeNodes.ts           # Hierarchical DAG for Trees, Rocks, Fungi, Animals
        ├── engine/
        │   ├── memoryLayout.ts         # SharedArrayBuffer views & Atomic SeqLock
        │   ├── sim.worker.ts           # 10 Hz deterministic off-main-thread loop
        │   ├── chemistry.ts            # Calorimetry, latent heat, pH, and Faraday solver
        │   ├── metabolism.ts           # Glycogen/Adipose pools, BMR, I_clo thermogenesis
        │   ├── fabrication.ts          # Mechanical work, Mohs scaling, backpack crafting
        │   └── husbandry.ts            # Live animal capture, paddock feeding, manure -> KNO3
        └── ui/
            ├── MenuController.ts       # Main menu, Settings modal, Gzip Base64 save I/O
            ├── ViewportGrid.ts         # 4-panel CSS Grid controller (60 FPS reader)
            ├── BiomeTreePanel.ts       # Collapsible category -> species -> part explorer
            ├── WorkbenchCanvas.ts      # Interactive vessels, heaters, condensers, decanting
            └── ToolAndInventoryPanel.ts# 6-slot Tool Belt + Leather Backpack lock state