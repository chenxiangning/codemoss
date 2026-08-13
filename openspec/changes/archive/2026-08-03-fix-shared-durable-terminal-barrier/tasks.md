## 1. Terminal Barrier Contract

- [x] 1.1 [P0, depends: none] 为 `useThreadEventHandlers` 增加 durable terminal barrier 注册接口；输入 `threadId + runtimeTurnId`，输出为 pending realtime batch 已 flush 且 exact turn 已写入 terminal ledger；用 focused hook test 验证调用顺序。
- [x] 1.2 [P0, depends: 1.1] 在 `useThreads` 建立稳定 callback ref，并把 durable settlement 能力注入 `useThreadMessaging`；用首个 Shared Turn 测试验证 callback 可用。

## 2. Shared Commit Convergence

- [x] 2.1 [P0, depends: 1.2] 在 Shared V2 `committed` response path 使用非空 `runtimeTurnId` 安装 barrier，再清理 processing / active turn；缺失 identity 时输出 debug evidence，不伪造 turn id。
- [x] 2.2 [P0, depends: 2.1] 增加 durable commit 后迟到 `turn/started`、assistant/reasoning delta、normalized/raw item event 不复燃的 integration regression。
- [x] 2.3 [P1, depends: 2.2] 增加同一 Shared Thread 下一 Turn 正常启动，以及 Claude+Kimi / Claude+MiniMax 走同一 engine-neutral path 的覆盖。

## 3. Contract Sync And Verification

- [x] 3.1 [P1, depends: 2.3] 同步 `dev-guidelines/backend/shared-session-v2-send-contract.md` 与 cross-layer guidance，记录 durable terminal barrier 和 sibling event propagation checklist。
- [x] 3.2 [P0, depends: 3.1] 运行 focused Vitest、Rust Shared settlement test、`npm run typecheck`、runtime contract check 与 `openspec validate --all --strict --no-interactive`。
- [x] 3.3 [P1, depends: 3.2] 复核 diff、未完成 manual evidence 与 rollback 边界，更新任务状态并输出审计结果。

## Validation Evidence

- focused frontend regression：204 passed；durable Shared Claude + Kimi / MiniMax integration：2 passed。
- Shared messaging focused regression：3 passed。
- `pnpm run typecheck`、target ESLint、runtime contract、`git diff --check`：passed。
- Rust `shared_runtime_coordinator`：34 passed；仅保留仓库既有 warning。
- 当前 change strict validation：passed。
- repository-wide OpenSpec validation 已执行；本 change passed，另有既存 `add-tokentracker-usage-dashboard` 与 `reduce-client-polling-overhead` 两项失败。
- `doctor:strict` 已执行；runtime contract passed，随后被仓库既有 branding allowlist 残留阻断。
- manual evidence：仍建议在 Desktop 中各跑一次 Claude + Kimi、Claude + MiniMax，观察 Stop 在 durable commit 后立即消失。
- rollback：可整体回退 frontend durable terminal callback wiring、Shared identity-only `turn/started` path 与 unmount-only ledger cleanup；不涉及 Rust schema 或 durable data migration。
