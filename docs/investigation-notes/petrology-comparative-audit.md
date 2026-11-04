# Petrological Audit & Comparative Analysis (2026 Petrology & Mineralogy)

This audit benchmarks the simulated geological deposits and mineral physics in *How to make soap* against **modern petrological classifications, crystal chemistry, and thermodynamic rock physics (2026 standards)**.

---

## 1. Comparative Mineralogical & Petrological Matrix

| Deposit ID / Rock | In-Game Formula & Subtype | Modern Petrological Classification & Composition (2026) | Mohs Hardness (Sim vs Petrology) | Thermodynamic & Pyrotechnic Behavior | Petrological Fidelity |
|---|---|---|---|---|---|
| `ROCK_CHERT_FLINT` | $\text{SiO}_2$ (Silicates) | **Micro-/cryptocrystalline sedimentary quartz (Chert/Flint)**. Micro-fibrous chalcedony + granular quartz matrix in carbonate host rocks. | **Sim: 7.0** <br> **Ref: 6.5–7.0** | Conchoidal fracture mechanics; isotropic knapping characteristics ($W_{\text{fracture}} \approx 6.7 \times 10^4\text{ J/m}^3$). | **High Fidelity (Accurate)** |
| `ROCK_KAOLIN_CLAY` | $\text{Al}_2\text{Si}_2\text{O}_5(\text{OH})_4$ (Silicates) | **Kaolinite (1:1 dioctahedral phyllosilicate)** formed via hydrothermal alteration or weathering of granitic feldspars. | **Sim: 2.0** <br> **Ref: 2.0–2.5** | Dehydroxylation at $450\text{–}600^\circ\text{C}$ to metakaolin; mullite phase transition at $>950^\circ\text{C}$ ($1373\text{ K}$ in game). | **High Fidelity (Accurate)** |
| `ROCK_LIMESTONE` | $\text{CaCO}_3$ (Carbonates) | **Biogenic/chemical sedimentary carbonate rock** (predominantly calcite with minor aragonite). | **Sim: 3.0** <br> **Ref: 3.0** | Endothermic calcination: $\text{CaCO}_3 \to \text{CaO} + \text{CO}_2$ ($\Delta H \approx +178\text{ kJ/mol}$, $T_{\text{decomp}} \approx 840\text{–}900^\circ\text{C}$). | **High Fidelity (Accurate)** |
| `ROCK_HALITE` | $\text{NaCl}$ (Evaporites) | **Marine/playa sedimentary evaporite** (cubic halite, $Fm\bar{3}m$). | **Sim: 2.5** <br> **Ref: 2.5** | High aqueous solubility ($35.9\text{ g}/100\text{ g } \text{H}_2\text{O}$); cleavage along $\{100\}$. Drives salting out via common-ion ionic strength. | **High Fidelity (Accurate)** |
| `ROCK_MALACHITE` | $\text{Cu}_2\text{CO}_3(\text{OH})_2$ (Carbonates) | **Monoclinic basic copper carbonate** (supergene secondary enrichment zone above copper sulfide deposits). | **Sim: 3.5** <br> **Ref: 3.5–4.0** | Thermal decarbonation and dehydration at $200\text{–}300^\circ\text{C}$ to tenorite ($\text{CuO}$), followed by carbothermal reduction with CO/C to $\text{Cu}^0$. | **High Fidelity (Accurate)** |
| `ROCK_CASSITERITE` | $\text{SnO}_2$ (Oxides) | **Rutile-structure tin dioxide** ($P4_2/mnm$), found in greisens, hydrothermal veins, and heavy alluvial placer gravels. | **Sim: 6.0** <br> **Ref: 6.0–7.0** | High specific gravity ($6.98\text{–}7.01\text{ g/cm}^3$); highly resistant to weathering; carbothermic reduction at $1100\text{–}1200^\circ\text{C}$. | **High Fidelity (Accurate)** |
| `ROCK_SOAPSTONE` | $\text{Mg}_3\text{Si}_4\text{O}_{10}(\text{OH})_2$ (Silicates) | **Steatite / Talc-carbonate schist** (ultramafic metamorphic rock altered by hydrothermal metasomatism). | **Sim: 1.5** <br> **Ref: 1.0–2.0** | High volumetric heat capacity, thermal shock resistance, low thermal expansion. Refractory up to $1300\text{–}1400^\circ\text{C}$ where talc transforms to enstatite ($\text{MgSiO}_3$) and cristobalite ($\text{SiO}_2$). | **High Fidelity (Accurate)** |
| `ROCK_SPHALERITE` | $\text{ZnS}$ (Sulfides) | **Cubic zinc sulfide** ($F\bar{4}3m$) with variable Fe substitution ($\text{(Zn,Fe)S}$, marmatite). | **Sim: 3.8** <br> **Ref: 3.5–4.0** | Oxidative roasting required ($\text{ZnS} + \frac{3}{2}\text{O}_2 \to \text{ZnO} + \text{SO}_2$); boiling point of $\text{Zn}$ ($907^\circ\text{C}$) is below reduction temp, historically requiring condensation retorts. | **High Fidelity (Accurate)** |
| `ROCK_PYRITE` | $\text{FeS}_2$ (Sulfides) | **Isometric iron disulfide** (fool's gold, $Pa\bar{3}$). | **Sim: 6.0** <br> **Ref: 6.0–6.5** | Thermal roasting produces hematite and $\text{SO}_2$ gas used in the lead-chamber process for sulfuric acid ($\text{H}_2\text{SO}_4$). | **High Fidelity (Accurate)** |

---

## 2. Key Petrological Alignments & Insights

1. **Paragenetic Compatibility**:
   - The spatial layout in `src/data/biomeNodes.ts` arranges deposits into geologically plausible associations:
     - Evaporites (`ROCK_HALITE`) and carbonates (`ROCK_LIMESTONE`) occupy adjacent sedimentary basin terrain ($120\text{–}150\text{ m}$).
     - Hydrothermal polymetallic vein associations (`ROCK_MALACHITE`, `ROCK_CASSITERITE`, `ROCK_SPHALERITE`, `ROCK_PYRITE`) radiate out into upland / mountain skarn zones ($180\text{–}260\text{ m}$).
2. **Mohs Mechanical Cutting & Scaling**:
   - The engine models tool wear and harvest mechanical energy as a function of the Mohs hardness ratio:
     $$\text{scaling} = \left(\frac{\text{targetMohs}}{\text{effectiveMohs}}\right)^2$$
   - This directly mirrors empirical rock drillability and cutting abrasion mechanics in modern geotechnical rock physics.
3. **Refractory Pyrotechnology of Steatite (Soapstone)**:
   - Soapstone's low hardness ($\text{Mohs } 1.5$) enables carving with basic flint tools ($\text{Mohs } 7.0$), while its high talc content gives it refractory thermal resilience to withstand molten bronze casting ($\approx 1000\text{–}1085^\circ\text{C}$), which is faithfully captured in the fabrication pipeline.
