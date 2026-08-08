## 1. Durable Mutation Lease

- [x] 1.1 [P0, deps: control-plane facts] 输入 normalized workspace owner；新增 additive lease table、epoch/holder types与 writer transaction API；输出 CAS row + audit fact atomicity；验证 same/different workspace concurrency and kill-boundary tests。
- [x] 1.2 [P0, deps: 1.1] 输入 canonical lease facts；实现 startup deterministic reconcile/rebuild，明确禁止 time-based expiry/reclaim；输出 fail-closed operational index；验证 old DB migration、rebuild、ambiguous-owner blocking tests。

## 2. Scope And Change Fence

- [x] 2.1 [P0, deps: none] 输入 sealed workspace root/path candidates；实现 canonical containment、symlink escape、remote/credential/deploy/commit/push deny policy；输出 stable scope diagnostics；验证 path traversal/symlink/nonexistent ancestor tests。
- [x] 2.2 [P0, deps: 1.1,2.1] 输入 dirty workspace before/after；实现 baseline fingerprints、observed delta artifacts与 typed outcome reconciliation；输出 preserving Change Fence；验证 dirty/untracked/unexpected/crash ambiguity tests。

## 3. Recovery And Stop

- [x] 3.1 [P0, deps: worker exact owner,1.2,2.2] 输入 projection + owner probe；实现 safe-abandon/reattach/settle/ambiguous classifier；输出 no-blind-replay recovery decisions；验证 each recovery matrix branch。
- [x] 3.2 [P0, deps: 3.1] 输入 cancel request；实现 durable cancel-before-action、scheduler admission stop与 exact-owner interrupt aggregation；输出 idempotent Cancelling/Cancelled/Blocked states；验证 duplicate/race/unsupported interrupt tests。
- [x] 3.3 [P1, deps: 2.2,3.1] 输入 verification or fence failure；实现 within-envelope forward repair与 authority-expansion hard stop；输出 bounded repair branch；验证 no reset/stash/checkout and no silent authority widening。
- [x] 3.4 [P1, deps: 3.1,3.2] 输入 `squadOrchestrationV1` flag；实现 kill switch admission/dispatch/readability policy；输出 reversible runtime gate；验证 historical projection remains readable。

## 4. Gates

- [x] 4.1 [P0, deps: 1.1-3.4] 输入 recovery implementation；运行 Rust concurrency/recovery tests、cargo check、focused frontend stop tests、strict OpenSpec与lock topology review；输出 zero half-commit/deadlock evidence。
- [ ] 4.2 [P1, deps: 4.1] 输入 dirty workspace + simulated crash cases；执行 manual kill/restart/stop/out-of-scope matrix；输出 forward-repair/no-rollback evidence。
- [x] 4.3 [P1, deps: all Phase 5 changes] 输入 code facts与test evidence；同步 foundation ADR 最近校准、Phase 5 checklist/report，记录 V1 ceilings 与 rollback flag；验证 docs gate。
