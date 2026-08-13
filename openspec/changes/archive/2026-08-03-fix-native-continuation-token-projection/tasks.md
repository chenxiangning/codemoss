## 1. Effective Native History

- [x] 1.1 [P0][无依赖] 输入 Codex JSONL frozen prefix，输出 last-valid-compaction replacement history + 后续增量；在 `native_history::reader` 实现 deterministic replay，并用 focused Rust test 验证 superseded records 不再导出。
- [x] 1.2 [P0][依赖 1.1] 输入含 encrypted/unknown replacement item 的 compaction，输出既有 omission 且无 private payload；用 reader regression 验证。

## 2. Budgeted Context Projection

- [x] 2.1 [P0][无依赖] 输入 oversized atomic Tool Exchange，输出保留 call/result identity 的 bounded block 与 compression evidence；用 compiler unit test 验证 deterministic、Unicode-safe 和 size bound。
- [x] 2.2 [P0][依赖 2.1] 输入单一 oversized Turn，输出 budget 内的 non-empty User + final Assistant portable spine；用 compiler unit test 验证 `0 < packageEstimatedTokens <= budget`。
- [x] 2.3 [P0][依赖 2.1、2.2] 输入支持 `NativeHistoryImport` 且 source 超 budget 的 request，输出仍为 import mode 的 budgeted delta；用 Rust test 验证 transport 未降级且 package 不越界。
- [x] 2.4 [P0][依赖 2.2] 对 empty/无法满足 budget 的 native package fail closed，禁止 target side effect；用 command/compiler contract test 验证。

## 3. Product Semantics And Contracts

- [x] 3.1 [P1][依赖 2.3] 输入 preview Token estimates，输出“可移植历史 → 续接包”语义；更新 locale/component focused Vitest。
- [x] 3.2 [P0][依赖全部实现] 更新 `dev-guidelines/backend/native-provider-continuation-contract.md`，同步 effective window、transport-independent budget、non-empty spine executable contract。

## 4. Verification

- [x] 4.1 [P0][依赖全部任务] 执行 native history/shared context/native continuation focused Rust tests 与 `cargo check --lib`。
- [x] 4.2 [P0][依赖 3.1] 执行 ProviderContinuationDialog focused Vitest、`npm run typecheck`、runtime contracts。
- [x] 4.3 [P0][依赖全部任务] 执行 `openspec validate fix-native-continuation-token-projection --strict --no-interactive` 并检查 diff 未触碰工作区其他变更。
