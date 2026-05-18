# Implementation Evidence

## Scope

This slice implements the non-UI realtime batching contract:

- pure batching delivery planner
- first visible assistant delta bypass
- bounded later-delta coalescing contract
- terminal flush before completion
- replay semantic parity checks
- CI parity command

It does not reroute production hooks/reducers yet and does not introduce EventBus, domain events, or new canonical runtime event names.

## Implemented Files

- `src/features/threads/contracts/realtimeBatchingContract.ts`
- `src/features/threads/contracts/realtimeBatchingContract.test.ts`
- `scripts/check-realtime-event-batching.mjs`
- `package.json`
- `.github/workflows/ci.yml`

## Propagation Boundary

- Current safe boundary is the existing replay/perf contract layer above canonical realtime event normalization and before UI rendering.
- Production hook/reducer wiring remains a follow-up so this slice can prove semantics without changing user-visible realtime behavior.

## Validation Evidence

- `npm run check:realtime-event-batching`
  - Pass.
- `npm exec vitest run src/features/threads/contracts/realtimeBatchingContract.test.ts src/features/threads/contracts/realtimeReplayHarness.test.ts src/features/threads/contracts/realtimeBoundaryGuard.test.ts`
  - Pass: 3 files, 8 tests.
- `npm run typecheck`
  - Pass.
- `npm run perf:realtime:boundary-guard`
  - Pass: 1 test.
- `npm run perf:realtime:extended-baseline`
  - Pass.
- `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`
  - Pass: 15 tests.
- `npm run check:large-files:gate`
  - Pass: `found=0`.

## Residual Risk And Follow-Up

- Production realtime event delivery is not yet rerouted through the planner.
- Actual jitter reduction in the live UI path requires a follow-up wiring slice once the UI refactor is stable.
- Dedup ratio semantics are guarded through replay parity; deeper telemetry remains future work.
