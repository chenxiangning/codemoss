## 1. Worker Ownership

- [x] 1.1 [P0, deps: control-plane 1.1-1.3] 输入 approved node target；实现 scoped Worker Binding key/metadata 与 hidden-session catalog filtering；输出 unique ordinary CLI session owner；验证 same-target parallel/target-freeze tests。
- [x] 1.2 [P0, deps: 1.1] 输入 prepared attempt；实现 durable `NodeAttemptLink` before-send transaction/path；输出 exact runtime owner tuple；验证 identity conflict and crash-boundary tests。

## 2. Scheduler And Context

- [x] 2.1 [P0, deps: control-plane 2.2, worker 1.2] 输入 `SquadProjectionV1`；实现 pure ready-set/DAG scheduler、concurrency caps 与 adaptive sealed budgets；输出 event-driven dispatch decisions；验证 dependency/parallel/budget/cancel tests。
- [x] 2.2 [P0, deps: 1.2,2.1] 输入 node/dependency/approval evidence；扩展 Context Package 为 node-scoped manifest/identity；输出 auditable package and delivery record；验证 determinism/omission/no-native-history tests。

## 3. Worker Runtime And Outcomes

- [x] 3.1 [P0, deps: 2.2] 输入 prepared dispatch；复用 ordinary CLI adapters发送 Context Package并绑定 coordinator exact owner；输出 acceptance/terminal observations；验证 no-fallback and owner-conflict tests。
- [x] 3.2 [P0, deps: 3.1] 输入 raw Worker final output；实现 shared normalization + node-kind validators + one bounded repair；输出 trusted `TypedOutcomeEnvelopeV1` 或 visible failure；验证 strict/wrapped/repair/schema/fail-closed cases。
- [x] 3.3 [P0, deps: 2.1,3.2, recovery lease] 输入 Mutate/Verify outcomes；实现 Single Writer dispatch、verification-to-repair loop 与 bounded attempts；输出 deterministic branch transitions；验证 read-only Verify and ambiguity blocking tests。
- [x] 3.4 [P1, deps: 3.3] 输入 all required successful outcomes；实现 nested final Synthesize dispatch，并从 successful `SquadRunSettled` 投影一次 top-level Shared answer；输出 run-linked final answer；验证 incremental/duplicate terminal exactly-once tests。

## 4. Gates

- [x] 4.1 [P0, deps: 1.1-3.4] 输入全部 Worker实现；运行 focused Rust/context/coordinator tests、`cargo check`、typecheck、runtime/model capability matrix；输出 zero regression evidence。
- [ ] 4.2 [P1, deps: 4.1] 输入 Claude+Codex supported targets；执行 parallel Analyze + Mutate + Verify + Synthesize smoke matrix；输出 exact owner/budget/projection evidence，禁止用 native transcript 代替验收。
- [x] 4.3 [P0, deps: 4.1] 输入 Composer resolved target；实现 capability-aware Squad entry，Codex/Claude 可用、Grok/Kimi/OpenCode fail-before-arm，且 unsupported target transition 自动 disarm；验证普通 Shared send contract 不携带 `squadRequest`。
