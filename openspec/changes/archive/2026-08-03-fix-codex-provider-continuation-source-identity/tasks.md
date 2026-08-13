## 1. Identity Contract Implementation

- [x] 1.1 [P0][无依赖] 在 `validate_provider_continuation_shape` 实现 Engine-aware source identity truth table；输入为现有 `NativeHistorySource`，输出保持现有 `Result<(), String>`，通过 focused Rust unit tests 验证 raw/canonical/mismatch/non-Codex cases。
- [x] 1.2 [P1][依赖 1.1] 将 `useSidebarMenus` Codex continuation regression fixture 改为 raw catalog thread id；输出 request 必须保留 raw `sessionId` 与相同 `nativeSessionId`，通过 focused Vitest 验证 prepare 与 create payload。

## 2. Contract Sync And Verification

- [x] 2.1 [P0][依赖 1.1] 更新 `dev-guidelines/backend/native-provider-continuation-contract.md`，写明 Codex raw/canonical 等价规则、exact logical id preservation 与 Claude/Kimi strict rule；用 source/code diff 人工核对。
- [x] 2.2 [P0][依赖 1.1、1.2、2.1] 执行 Rust focused tests、frontend focused Vitest、`npm run typecheck`、`npm run check:runtime-contracts` 与 `openspec validate fix-codex-provider-continuation-source-identity --strict --no-interactive`，记录全部结果。
