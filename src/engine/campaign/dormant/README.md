# Dormant Campaign Modules (Milestone M6)

These modules were implemented and unit-tested for Milestone M6 (§6.19-§6.25) but **never integrated** into the worker simulation loop or UI windows.

## Modules

| Module | LOC | Spec Section | Description |
|--------|-----|--------------|-------------|
| `bounties.ts` | 125 | §6.19.3, §6.19.5 | Named bounties on raiders/beasts/dissidents; Magister's Guard |
| `incursions.ts` | 165 | §6.25 | Territorial incursions (Pale Raid, Rival March, Harvest Raid) |
| `dispatches.ts` | 155 | §6.19.6 | Crown dispatches with timed royal orders |
| `codexExchange.ts` | 248 | §6.19.4 | Cross-civ knowledge trading via codex entries |
| `petitioners.ts` | 190 | §6.20 | Petitioners' Board - community complaints & demands |
| `deepMine.ts` | 99 | §6.22 | Deep mining expeditions for rare ores |
| `harbour.ts` | 143 | §6.24 | Coastal harbour trade & ship management |
| `notables.ts` | 197 | §6.21 | Named NPCs with traits, loyalties, events |
| `hires.ts` | 75 | §6.18 | Hire tiers for settlement workers |
| `ageProgress.ts` | 116 | §6.16 | Age I-IV progression tracking |
| `ageTransitions.ts` | 262 | §6.17 | Age transition events & unlocks |

## Integration Requirements

To wire these modules, each needs:

1. **Worker integration** (`sim.worker.ts`):
   - Import state creation function
   - Add to `FullSimState` or campaign state bag
   - Call step function in `stepSingleTick`/`advanceDays`
   - Add sync message type + handler

2. **UI integration** (`workerMessages.ts` + windows):
   - Add sync message types
   - Update `state` with campaign listeners
   - Create window components (or extend existing)

3. **Persistence** (`persistence.ts`):
   - Add to `SerializedWorldSave` interface
   - Handle in `deserializeSave`/`migrateSave`

4. **Commands** (`sim.worker.ts` Command union):
   - Add player actions (claim bounty, respond to incursion, etc.)

## Reactivation Checklist

- [ ] Add to `src/engine/campaign/index.ts` exports (remove `dormant/` prefix)
- [ ] Wire into worker simulation loop
- [ ] Add UI window/components
- [ ] Update persistence schema (version bump)
- [ ] Add command handlers
- [ ] Verify all existing tests still pass
- [ ] Add integration tests for new flows

## Test Status

All dormant modules have unit tests in:
- `tests/campaignAgesAndExchange.test.ts` (ageTransitions, codexExchange, notables, incursions, deepMine)
- `tests/campaignInfluenceAndPowers.test.ts` (dispatches, harbour, petitioners, bounties, incursions)
- `tests/campaignSettlementsAndBlacksmith.test.ts` (hires)
- `tests/tutorialSelectors.test.ts` (ageProgress)

**Note:** Tests still import from `../src/engine/campaign/*` - they will need path updates to `../src/engine/campaign/dormant/*` to pass.

---

*Archived: 2026-11-09 | Original location: `src/engine/campaign/*.ts`*