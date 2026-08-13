## 1. Provider-scoped CLI Discovery Bridge

- [x] 1.1 [P0, depends: none] 扩展 Codex app-server model-list core 以接受 `providerProfileId` session key；输入：现有 `model_list_core` 与 Provider session helper；输出：binding-scoped `model/list`；验证：focused Rust unit test。
- [x] 1.2 [P0, depends: 1.1] 新增显式 Codex discovery Tauri/daemon command 并保持 legacy passive `model_list` 不变；输入：`workspaceId + providerProfileId`；输出：Desktop/daemon payload/result contract parity，daemon managed runtime 显式 fail closed；验证：command mapping tests。
- [x] 1.3 [P0, depends: 1.2] 增加 frontend typed service mapping；输入：binding identity；输出：CLI model-list response；验证：`src/services/tauri.test.ts` focused cases。

## 2. Unified Provider Catalog Owner

- [x] 2.1 [P0, depends: 1.3] 为 `useSharedProviderTargetCatalog` 增加 configured/discovered/last-good slices 与 runtime-model dedupe；输入：现有 scoped cache；输出：稳定 merged catalog；验证：hook merge tests。
- [x] 2.2 [P0, depends: 2.1] 实现 `reloadConfig` 与 capability-gated `discoverModels`，按 action + binding 串行化并拒绝 stale overwrite；输入：Provider Profile scope；输出：更新后的当前模型框；验证：success/error/stale focused tests。
- [x] 2.3 [P1, depends: 2.2] 保证 refresh failure 保留 selection/last-good 并显示 binding error；输入：rejected backend result；输出：可继续使用的旧 catalog；验证：hook + selector tests。

## 3. Composer And Shared Session UI

- [x] 3.1 [P0, depends: 2.2] 将 `ModelSelect` action callback 改为完整 Provider Profile scope，并在标题栏渲染 `Reload Config` 与 capability-gated `Discover Models` icon；输入：当前展开 binding；输出：两个独立 accessible actions；验证：`ModelSelect.test.tsx`。
- [x] 3.2 [P0, depends: 3.1] 在 `ChatInputBox` 接入统一 catalog actions，使 Native Composer 与 Shared Session 使用同一 hook；输入：picker mode/workspace/binding；输出：无 active-thread 猜测的 scoped refresh；验证：ChatInputBox/Shared focused tests。
- [x] 3.3 [P1, depends: 3.2] 验证 Shared Provider B 刷新只更新 B，选择 discovered model 原子冻结 `id + runtime model + providerProfileId`；输入：A/B target fixture；输出：正确 `selectedNextTarget`；验证：Shared selector tests。

## 4. Contract And Incremental Verification

- [x] 4.1 [P1, depends: 2.3,3.3] 更新 `dev-guidelines/backend/provider-scoped-model-catalog.md` 的双动作、CLI-only 与 Shared binding contract；输入：OpenSpec deltas；输出：executable contract；验证：人工 diff 审计。
- [x] 4.2 [P0, depends: 1.3,2.3,3.3] 运行受影响 Vitest、focused Rust tests、changed-file lint、runtime contract 与 Rust bins check；额外执行 repo typecheck 并记录非本变更 blocker；输入：changed files；输出：增量通过证据；验证：目标命令 exit code 0。
- [x] 4.3 [P1, depends: 4.1,4.2] 执行 OpenSpec strict validation、implementation/spec consistency review，并记录未运行全量测试的用户授权；输入：artifacts + diff；输出：verification evidence；验证：change strict validation 通过。

## Verification Evidence

- 用户明确授权只跑增量测试，不运行全量 test suite。
- Vitest：hook + selector 29/29、ChatInputBox 3/3 通过；Tauri discovery mapping
  1/1 通过。
- Rust：Provider-scoped `model/list` focused test 1/1 通过；`cargo check --bins` 通过。
- ESLint：本次触及的 TypeScript/TSX 文件通过。
- Runtime contracts：AppShell 与 Git History contract checks 通过。
- OpenSpec：strict validation 通过。
- Repo-wide `pnpm typecheck` 已执行；被并行工作区既有
  `src/features/shared-session/runtime/sendSharedSessionTurnV2.ts` 的
  `EngineType` / `SharedSessionSupportedEngine` 类型不匹配阻断。本变更目标文件无新增
  typecheck diagnostic。
