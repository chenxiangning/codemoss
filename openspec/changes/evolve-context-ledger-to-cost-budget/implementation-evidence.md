# Implementation Evidence

## Scope

This implementation completes the non-UI core slice of `context-ledger-cost-budget`:

- per-engine pricing fixtures and lookup
- traceable pricing source metadata
- `ThreadTokenUsage` based turn/session cost projection
- degraded state for unavailable or stale pricing
- cross-engine partial aggregate
- per-session budget thresholds
- CI parity command

StatusPanel dock/popover rendering and i18n key wiring remain `[UI-DEFER]` because the UI import/dependency refactor is intentionally kept out of this slice.

## Implemented Files

- `src/features/context-ledger/pricing/**`
- `src/features/context-ledger/cost/**`
- `src/features/context-ledger/budget/**`
- `src/features/context-ledger/cost-budget.ts`
- `scripts/check-context-ledger-cost-budget.mjs`
- `package.json`
- `.github/workflows/ci.yml`

## Pricing Calibration

- Claude and Codex fixtures align with existing `src-tauri/src/local_usage.rs` local usage cost rates.
- Gemini and OpenCode fixtures are intentionally empty in this first slice because current runtime usage snapshots do not provide trusted billing model/provider identity for those paths.
- Missing pricing returns degraded cost state with `pricing-unavailable`; it never returns silent zero.

## Validation Evidence

- `npm run check:context-ledger-cost-budget`
  - Pass.
- `npm exec vitest run src/features/context-ledger/pricing/pricingRegistry.test.ts src/features/context-ledger/cost/projectCost.test.ts src/features/context-ledger/budget/budgetThresholds.test.ts`
  - Pass: 3 files, 10 tests.
- `npm run typecheck`
  - Pass.
- `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`
  - Pass: 15 tests.
- `npm run check:large-files:gate`
  - Pass: `found=0`.

## Deferred UI Work

- StatusPanel Cost dock section remains deferred.
- StatusPanel Cost popover section remains deferred.
- `statusPanel.cost.*` and `statusPanel.budget.*` i18n keys remain deferred with the UI surface.
- i18n parity remains deferred until user-facing strings are added.

## Residual Risk And Follow-Up

- Cost math uses frontend `ThreadTokenUsage` snapshots and current local usage rate assumptions; provider-native billing statements remain out of scope.
- Reasoning output tokens are counted as billable output in this first slice. If providers later expose a separate billing bucket, projection should be refined.
- Block-level cost attribution remains future work because `ContextLedgerBlock.estimate.value` is not an authoritative billing base.
- Cost prediction, multi-currency, team budget, and cost-based routing remain follow-up changes.
