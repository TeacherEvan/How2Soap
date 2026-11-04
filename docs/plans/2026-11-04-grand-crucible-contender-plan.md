# The Grand Crucible — Path to a Turn-Based Indie GOTY Contender

**Status:** Approved for execution · decisions locked 2026-11-04 · Phase 1 complete
**Source authority:** surgical-investigation full-sweep (2026-11-04) + 2026-11-03 surgical audit (78/100) + awards research (TGA 2023–2025, BAFTA 2024–2026)
**Repo state at plan approval:** `main` @ `7109d4a` + Phase 1 working-tree changes (uncommitted by design; review via `git diff`)

---

## 1. Positioning statement

> **Sea of Stars' campaign craft × Into the Breach's telegraph legibility × real master's-degree chemistry.**
> A turn-based alchemical survival odyssey in which every potion is earned through real chemistry.

Not the goal: Expedition 33 2 (reactive-QTE combat) — the chemistry fantasy doesn't support it, and it doesn't need to.
Closer targets: **Sea of Stars** (TGA 2023 Best Independent Game; ~25 devs, art direction over fidelity), **Into the Breach** (2 devs; telegraphed tactics; quality-over-headcount), **Balatro** (solo dev; scope discipline; TGA 2024 Best Independent/Debut).

## 2. Locked decisions (user, 2026-11-04)

| # | Decision | Choice |
|---|---|---|
| D1 | Genre identity | **Crisis turns** — telegraphed calamities resolved in 3–4 choices; reuses `telegraph.ts` forecast machinery; Into-the-Breach legibility |
| D2 | Music | **Commission** main theme + 3 loops (hearth/crisis/victory) + stingers (~$300–800) — provenance clean (Indie Game Awards gen-AI disqualification precedent) |
| D3 | Distribution | **Web-only + IGF** (no Steam/Tauri for now). Canonical URL stays Vercel; itch.io release + devlog for awareness |
| D4 | Execution | **Phase 1 now**; later phases gated on review |

**Honest constraint on D3:** no known TGA/BAFTA winner shipped web-first; web distribution weakens BAFTA eligibility (verify rules at submission time) and caps reach. This can be revisited at any phase boundary for +$100 (Steam Direct). IU/engineering stays port-ready: `src/storage/` abstraction NOT needed for web-only; Tauri wrapper remains a 1–2 week option later.

## 3. What "contender" requires (research findings)

Juries name craft disciplines: Art Direction, Score & Music, Narrative, Performance, Game Direction [T1: thegameawards.com, bafta.org; T2: BBC, IGN]. How2Soap had **no score at all** — a category it cannot enter. "Basic 3D" is not rewarded; style is. No low-poly turn-based indie has been award-recognized. Community verdicts: static turn-based fails on "menu soup" + slow animations; telegraphing + snappiness + authored identity are the winners' pillars [T4 Reddit/JRPG + T3 ResetEra; T2 GameSpot, GameDeveloper.com]. **The Indie Game Awards disqualified Expedition 33 for gen-AI asset provenance** [T2 AV Club] — all assets here are Blender/PIL/handauthored; keep a written zero-gen-AI ledger.

## 4. Gap analysis vs the contender template

| Dimension | Today | Contender needs | Phase |
|---|---|---|---|
| Score & Music | Zero (procedural SFX only) | Commissioned themes + stingers | 2 |
| Turn-based identity | Watch-forecast telegraphing exists; no encounters | Crisis turns (D1) | 2 |
| Campaign depth | 6 chapters, 3 affinities, 3 endings | Three acts + recontextualized reveal; 20 Nights NG+ | 3 |
| Art direction | Flat canvas + one WebGL diorama | Cohesive "warm ceramic noir" bible (slate/brass/glow); Bench3D glow pass; key art | 2–3 |
| Accessibility | WCAG 2.2 target size/focus/reduced-motion/high-contrast already green | Apprentice/Alchemist/Grandmaster difficulty; 100% keyboard-completable; colorblind-safe reagents | 2 |
| Engineering spine | Nov-3 audit 78/100; world/worker untested | ≥85/100; S_health re-measured; spine tested | 1 ✅ |
| Distribution | Vercel web-only | itch.io + festival/IGF + press kit (D3) | 4 |
| Provenance | Clean | Written zero-gen-AI ledger | 4 |

## 5. Phases, gates, acceptance criteria

### Phase 1 — Foundations (✅ complete 2026-11-04)
1. `main.ts` 1,194→359 LOC via new `src/app/` (state/dom/views/panels/workerMessages/autosave/splash); shell markup moved into `public/index.html`; `StrategyMapCanvas` math extracted to `src/ui/mapMath.ts` (re-exported, tests unchanged).
2. Worker command dispatch compile-time exhaustive (`assertNeverCommand`); unknown commands → in-game EVENTS, never silent.
3. **Two live command-protocol defects fixed:** dead "Charge to Vessel" button (`CHARGE_ITEM_TO_VESSEL` → `CHARGE_ITEM`), condenser target never reaching worker (`targetVesselId` → `targetId`).
4. Spine tested: `tests/worldRoundtrip.test.ts` (4), `tests/workerDispatch.test.ts` (11) — 194/194 green, 40 suites.
5. PWA: service worker (cache-first hashed assets, network-first navigations), Web Manifest, CSP, OG tags, procedural PNG icons, Vercel `no-cache` for `sw.js`; favicon 404 fixed via zero-dep `CopyPublicPlugin`.
6. Production boot smoke: chromium headless — shell renders, splash launches, **0 console errors**; all PWA assets 200 over COOP/COEP-isolated server.
7. Preflight delta: `main.ts` risk 1,274→383; `StrategyMapCanvas` 600→537; silent catches 1→0; `src/app/` contributes 0 dead exports.

**Gate:** `npm test` 194/194 · `tsc --noEmit` 0 errors · `npm run build` green, entrypoint 182 KB/200 KB · dist contains sw/manifest/icons/favicon.

### Phase 2 — Soul (next; wk 3–6) — the named award categories
8. **Commission score** (D2): 1 main theme (2–3 min) + 3 loops + ~8 stingers; layered over procedural SFX; CC provenance ledger.
9. **Crisis turns** (D1): telegraph 2 watches ahead; 3–4 choice resolution; craftable counters; cinematic letterbox. Spec: `docs/plans/crisis-turns-spec.md` (to be written with user sign-off).
10. **Juice pass**: boil-over shake, saponification flash, renown-ring burst, Bench3D crucible glow, skip/fast-forward everywhere; HUD tone audit (dark slate/brass/glow).
11. **Accessibility**: difficulty tiers; full keyboard map; colorblind-safe reaction glyphs (no color-only signals).
**Gate:** external playtest ×5 — first-soap ≤10 min; juice checklist; accessibility audit.

### Phase 3 — Content depth (wk 5–9) — campaign weight
12. Three-act restructure; midpoint reveal — **the Council of Solitude is the Pale Alchemist**; endings (Ascension / The Alchemist's Bargain / The Last Lye).
13. **The 20 Nights**: seeded NG+ challenge, shareable seed string (streamers); **Crucible Codex**: real-chemistry compendium with citations (press hook).
14. Soak tests: headless 30-night CI runs proving Apprentice winnable, Grandmaster brutal; pacing curve sign-off.
**Gate:** three full recorded playthroughs (one per difficulty) for trailer capture; soak suite green.

### Phase 4 — Release & awards campaign (wk 8–16) — D3 route
15. itch.io release (name-your-price) + devlog series ("real chemistry in a game — here's every reaction, sourced"); press kit (presskit()); 60–90 s trailer from Phase 3 captures.
16. Submissions: **IGF 2027** (timeline risk — verify cycle at kickoff), **The Indie Game Awards**, **BAFTA Games 2027** (eligibility of web-only release — verify at submission; longlist is the realistic bar), Webby/IGF Nuovo-style niches; GDC Indie Summit talk proposal.
17. **Zero-gen-AI asset ledger** (Blender/PIL/hand-authored + licences) — E33 precedent.
**Gate:** release candidate on Vercel + itch; submissions filed before deadlines; review baseline ≥90% positive.

## 6. Budget & effort

Cash: $0–800 (music commission; $0 if user prefers free/CC0, weakening D2). Time: ~12–16 weeks focused solo across Phases 2–4. Engineering reuse is high (telegraph machinery, audio panner, 3D diorama infrastructure all exist).

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| "Awards are a lottery; top-ten is editorial" | Target named categories + IGF/Debut + BAFTA longlist; track submissions, not vibes |
| Web-only caps reach (D3) | Revisit at Phase 4 for Steam ($100); itch + press as multipliers |
| "Chemistry = spreadsheet" bounce | Crisis turns, Apprentice mode, Codex fantasy, fast kinetic text |
| Solo founder fatigue | Phase gates; weekly archive tags; CI green or don't merge |
| Scope creep (agent included) | This gate structure; no Phase 2+ work before Phase 1 review sign-off |
| Tauri/webview SAB quirks (if D3 revisited) | Keep canonical web edition; treat Steam as wrapper, never fork |

## 8. Success metrics

**Controllable:** $0→$800 cash; IGF entry filed; ≥1 festival/IGF finalist mention; itch downloads ≥10k (stretch); press pieces ≥3 (chemistry hook); submission checklist 100% complete.
**Stretch:** BAFTA longlist; The Indie Game Awards nomination; 90%+ positive itch reviews; "best chemistry game ever made" as recurring press phrase.
**Never promised:** "Top ten of the year." What is delivered: eligibility, quality, identity, distribution discipline.

## 9. Outstanding (needs user input)

- **Music commission budget** — confirm $300–800 envelope or CC0 fallback (weakens D2).
- **Phase 2 green-light** — start with crisis-turns spec or score?
- **Bundle budget note** — entrypoint now 182 KB (was 74.6 KB) because CSS/HTML moved; still under 200 KB with headroom 9%; if Phase 2 grows it, we split.
- **Commit** — Phase 1 changes are uncommitted on purpose; review via `git diff`, then commit as `feat(crucible): Phase 1 foundations — PWA, src/app orchestration, worker protocol honesty` (or your preferred message).

## 10. Evidence index

- 2026-11-03 audit: `docs/audits/how2soap-surgical-audit-2026-11-03.md` (78/100, pre-refactor)
- Awards research: TGA 2023–2025 (EX33 GOTY/Independent/Debut; Sea of Stars 2023; Balatro 2024), BAFTA 2024–2026 (BG3, Astro Bot, EX33) [thegameawards.com; bafta.org; BBC; Guardiana; IGN]
- Community pulse: r/truegaming, r/JRPG, ResetEra, GameSpot, GameDeveloper.com, howtomarketagame.com (tiers marked)
- Phase 1 measurements: preflight `/tmp/opencode/audit-scan/preflight-after.json` (96 files); dead-export sweep (49 candidates, textual, Nov-3 baseline 41 @ 85 files); headless-chromium boot (0 console errors)
- Build: `Entrypoint main 182 KiB / 200 KB`; `npm test` 194/194; `tsc --noEmit` clean
