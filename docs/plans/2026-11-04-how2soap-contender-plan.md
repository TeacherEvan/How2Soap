# How2Soap — A Complete, Exceptional Game

**Supersedes:** v1/v2 (awards-shaped drafts) · **Date:** 2026-11-04 · **North Star, in your words:** the level of quality implied by "top ten turn-based indie contender" — applied as a *craft bar for every decision*, not as a competition to enter.

---

## 1. What this game is (identity, unchanged)

> Emergent chemistry, real consequences — make soap from scratch, one watch at a time.

Sea of Stars' campaign craft · Into the Breach's telegraph legibility · master's-degree chemistry under the hood. Engine: SAB + SeqLock worker, Arrhenius kinetics, electroneutrality pH, Faraday electrolysis, 5-tier progression, colony labor layer, 6-chapter campaign, Now Phase 1 complete (PWA, src/app orchestration, worker protocol honesty, 194/194 tests, 0 silent catches).

**The bar, stated plainly:** when someone plays any 5 minutes of this game, there is nothing "unfinished," "fake," or "flat" in them — no stub systems, no lying UI, no silent failures, no asset that breaks tone, no audio that is merely absent. That is what "top ten" means here. Everything below serves that.

## 2. Reach — the minimum, the honest minimum

- **Web (Cloudflare Pages, $0, commercial-legal)** — the free, always-playable canonical build.
- **itch.io ($0, 0% revenue share)** — named release when v1.0 is done, not before.
- **Steam ($100, one-time)** — only when the game is done and earned; no keys for press, no launch campaign, no festival gambling. It becomes a storefront, not a strategy.
- Everything else (press kits, socials, showcases): **out of scope until the game is finished.** Distribution is a finishing step, not a pillar.

Hosting note: Vercel Hobby is non-commercial, incompatible with a paid game — Cloudflare Pages `_headers` carries the same COOP/COEP isolation for $0 (done; verified).

## 3. The quality pillars (the actual plan)

### P2 — Feel & Soul (Crisis Turns + Score + Juice)
1. **Crisis turns** (D1, spec first): telegraphed calamities resolved in 3–4 quantified choices; Seeded RNG; full system integration (chemistry/metabolism/colony), never a parallel stat; unit-tested; headless-soak-verified; Into-the-Breach-style legibility. Calamities v1.0: Ash-blight Storm, The Pale Alchemist's Raid, Well Taint, Fever Wave, Wolf Pack, Boil-over, Rival Expedition, Blight Rain.
2. **Score — $0, zero new assets, full provenance**: an adaptive **generative score** in Web Audio (the repo's zero-asset philosophy, not a compromise): Hearth theme (Dorian modal, low drone + sparse plucks) · Crisis theme (Phrygian dominant tension, faster) · Victory theme (major-pentatonic lift) + stingers. Toggle in settings, respects `prefers-reduced-motion`/mute, seeded deterministic motifs. `LICENSES.md` + attribution stays trivial (nothing to license). A human composer can drop CC0/CC-BY files into `assets/audio/` later — engine is built file-first, synth as fallback.
3. **Juice**: boil-over screen shake, saponification flash + particle burst, renown-ring burst, Bench3D crucible emissive pulse, crisis-turn letterbox + stinger, fast-forward/skip everywhere.
4. **Art direction pass — "warm ceramic noir"**: slate `#12151c`, brass `#d4a020`, glow amber `#f5b042`; icon redraw; og-image; (Steam capsule only when Steam happens).

### P3 — Depth & Content
5. **Three acts + Pale Alchemist reveal** (Council of Solitude is the rival); 3 endings (Ascension / The Alchemist's Bargain / The Last Lye).
6. **The 20 Nights** — seeded NG+ roguelike run + shareable seed; modifiers; daily challenge (Wordle-style).
7. **Crucible Codex** — real chemistry, every reaction cited; unlock-by-doing. The soul of the game for chemistry-curious players.
8. **Difficulty tiers** — Apprentice / Alchemist / Grandmaster; 100% keyboard-completable; colorblind-safe reagent glyphs; full gamepad mapping (Free API, standard map).

### P4 — Trust & Finish
9. **Release engineering**: SemVer + CHANGELOG + git tags; CI gates (tsc strict, tests, soak sims, bundle budget, axe-core, Lighthouse ≥95); `main` always deployable; save-compat corpus (every release loads every prior save); Sentry free tier; asset-provenance ledger (all Blender/PIL/hand-authored).
10. **The v1.0 bar**: a first-time player, unaided, reaches first soap in ≤10 minutes; no stub anywhere; crash-free sessions; 60 FPS; installable PWA; web and (later) Steam builds of the same `main`.

## 4. Budget

**$0 recurring.** Optional, only-if-earned: $100 Steam Direct. Music: $0 by decision (generative + optional CC0 drop-ins).

## 5. Order of work (quality-gated, no dates dictated by outside clocks)

1. Crisis-turns spec (docs/plans/crisis-turns-spec.md) — design review with you.
2. Crisis engine, TDD (`src/engine/crisis.ts`) + worker integration + minimal resolution UI + tests.
3. Generative score engine (`src/ui/score.ts`) + settings toggle.
4. Juice pass (boil-over, saponification burst, ring burst, crucible glow).
5. Three acts + endings reframe; Crucible Codex; The 20 Nights.
6. Difficulty tiers + gamepad + colorblind pass.
7. v1.0 polish gate: playtest ×5, first-soap ≤10 min, zero stubs, ship web build.

No festival deadlines, no wishlist math, no press strategy, no awards submissions until the game is finished and you want them.

## 6. Honest risks

Generative score can feel samey without motif discipline — mitigated by 3 themes + stingers + silence used deliberately (Hearth theme at low amplitude; crisis overrides). · Crisis turns risk feeling bolted-on — mitigated by forcing every outcome through existing systems (no new currencies). · Scope — mitigated by the v1.0 bar being a checklist, not a vibe: every item above is either done or not.

## 7. Your three decisions (all defaults taken if silent)

1. **Score:** generative (decided) + CC0 drop-in path documented. ✅ $0
2. **Steam:** stay out until v1.0 is done. (Default.)
3. **Crisis-turns spec approval** — proceed to implementation on spec completion. (Default: yes — "best practices" = spec-first.)
