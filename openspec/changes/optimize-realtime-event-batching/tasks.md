## 1. Realtime Path Inventory

- [x] 1.1 [P0][depends:none][I: realtime adapter/hook path][O: propagation map][V: delta/status/tool paths identified] Map realtime event propagation.
- [x] 1.2 [P0][depends:none][I: `S-RS-*` fixtures][O: baseline table][V: first-token/jitter/dedup metrics recorded] Capture realtime baseline.
- [x] 1.3 [P0][depends:1.1][I: propagation map][O: contract-layer batching boundary][V: canonical event semantics untouched; production hook/reducer wiring explicitly deferred] Identify the safe contract boundary.

## 2. Batching Design

- [x] 2.1 [P0][depends:1][I: first-token path][O: bypass rule][V: first visible delta flushes immediately] Define first-token bypass.
- [x] 2.2 [P0][depends:1][I: terminal events][O: flush rule][V: completion/error/interrupt flush pending deltas] Define terminal flush.
- [x] 2.3 [P0][depends:1][I: dedup path][O: dedup invariant][V: dedup identity unaffected] Define dedup guard.

## 3. Contract Implementation

- [x] 3.1 [P0][depends:2][I: contract-layer boundary][O: bounded batching planner][V: order and content preserved in replay/contract tests; no production hook reroute] Implement the non-UI batching planner contract.
- [x] 3.2 [P0][depends:3.1][I: first-token rule][O: tests][V: first delta bypass tested] Add first-token tests.
- [x] 3.3 [P0][depends:3.1][I: terminal/dedup rules][O: tests][V: terminal flush and dedup stable] Add terminal/dedup tests.
- [x] 3.4 [P0][depends:3.1][I: replay harness][O: additional replay tests][V: first-token slow path semantics stable; non-delta tool lifecycle flushes pending deltas] 补 replay 真实性覆盖。

## 4. Validation

- [x] 4.1 [P0][depends:3][I: touched files][O: type/test evidence][V: `npm run typecheck` + targeted realtime Vitest contract files] Run frontend contract baseline.
- [x] 4.2 [P0][depends:3][I: realtime fixture][O: extended perf evidence][V: `npm run perf:realtime:extended-baseline`] Run realtime extended baseline.
- [x] 4.3 [P0][depends:3][I: boundary guard][O: replay guard evidence][V: `npm run perf:realtime:boundary-guard`] Run boundary guard.
- [x] 4.4 [P1][depends:3][I: test output][O: heavy-noise parser evidence][V: `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`] Run heavy-noise parser sentry.
- [x] 4.5 [P0][depends:4.1-4.4][I: OpenSpec artifacts][O: strict validation][V: `openspec validate optimize-realtime-event-batching --strict --no-interactive`] Validate OpenSpec.

## 5. Completion Review

- [x] 5.1 [P0][depends:4][I: S-RS before/after][O: contract outcome summary][V: first-token/jitter/dedup contract impact explained without claiming live UI improvement] Record contract metric deltas.
- [x] 5.2 [P1][depends:5.1][I: residual runtime gap][O: follow-up backlog][V: production hook/reducer wiring listed] List follow-ups.

## 6. Deferred Runtime Items

- [ ] 6.1 [RUNTIME-DEFER][depends:3.1][I: batching planner contract][O: production realtime hook/reducer delivery reroute][V: live session replay + existing realtime tests pass] Wire production realtime delivery through the batching planner after UI refactor stabilizes.
- [ ] 6.2 [RUNTIME-DEFER][depends:6.1][I: production reroute][O: live jitter measurement evidence][V: first-token preserved and later-delta jitter reduced in live path] Record live UI path impact after runtime wiring.

## 7. Validation Evidence

- `npm run check:realtime-event-batching`
  - Pass.
- `npm exec vitest run src/features/threads/contracts/realtimeBatchingContract.test.ts src/features/threads/contracts/realtimeReplayHarness.test.ts src/features/threads/contracts/realtimeBoundaryGuard.test.ts`
  - Pass: batching contract covers non-delta flush and first-token slow path replay parity.
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

## 8. Residual Risk And Follow-Up

- Production realtime hook/reducer delivery is not yet rerouted through the batching planner; this is tracked as `[RUNTIME-DEFER]` in section 6.
- Live UI jitter improvement is not claimed by this slice. This slice only proves first-token, terminal flush, order preservation, and dedup replay semantics.
- This slice proves first-token, terminal flush, order preservation, and dedup replay semantics without changing canonical realtime event names.
