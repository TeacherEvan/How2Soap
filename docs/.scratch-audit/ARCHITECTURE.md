# Architecture & Delta Specification — Milestone M0

## 1. Targeted Areas
- `src/ui/SoapKettleModal.ts`: Import `./soapKettle.css` (resolves D2).
- `src/app/launcher.ts`: Import `../ui/windows/windows.css` lazily on first window interaction (resolves D1 within budget).
- `src/ui/timedRequests.css` & `src/ui/TimedRequestsWidget.ts`: Switch progress bar from `width` animation to `transform: scaleX()` origin-left (resolves D4).
- `src/engine/persistence.ts`: Upgrade `SerializedWorldSave` to support version 3 with colony, paddock, timedRequests, and persistent `rngSeed` while retaining v1/v2 migration (resolves D5, D6).
- `src/app/autosave.ts`: Serialize colony, paddock, and timedRequests into save snapshot, keeping `state.rngSeed` (resolves D5).
- `src/engine/timedRequests.ts`: Add `restore(savedSlots)` method to `TimedRequestManager` (resolves D6).
- `src/engine/worldRestore.ts` & `src/engine/sim.worker.ts`: Unify vessel/world restoration through `restoreWorldFromSave` (resolves D6, D8).
- `public/sw.js`: Bump cache name from `how2soap-v1` to `how2soap-v2` (resolves D17).

## 2. Invariants
- `SAB_BYTE_LENGTH = 67648` is unchanged.
- Worker `COLONY_SYNC` postMessage remains contract-stable.
- Webpack entrypoint remains strictly under 200,000 bytes.
