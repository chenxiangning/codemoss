## Progress Calibration (2026-03-28, Re-verified)

说明：以下任务按“可复核代码证据 + 可执行验收命令”重排。  
当前任务已全部完成（含 watcher/Rust/FSM/feature flag）。

## A. Baseline（已完成）

- [x] A1 [P0] clean 文件检测到外部变化时自动同步并显示非阻塞提示。
- [x] A2 [P0] dirty 文件检测到外部变化时禁止 silent overwrite，并提供 `Reload / Keep Local / Compare`。
- [x] A3 [P1] 冲突提示支持事件聚合计数，避免重复弹风暴。
- [x] A4 [P0] detached 窗口聚焦态启用外部变化 polling，仅作用于 detached 上下文。
- [x] A5 [P0] 前端验证通过：`FileViewPanel / DetachedFileExplorerWindow / FileExplorerWorkspace` 相关测试通过。

## B. Incremental Upgrade（待完成）

### B1. Runtime Event Pipeline（P0）

- [x] B1.1 定义并落地 Rust->Frontend 事件契约：`workspaceId/normalizedPath/mtimeMs/size/detectedAtMs/source/eventKind/platform/fallbackReason`。
- [x] B1.2 新增 `detached-external-file-change` 事件发射与订阅链路（watcher 主链路）。
- [x] B1.3 watcher 初始化/投递失败自动降级 bounded polling，并保留 dirty 保护。

验收：
- [x] `cargo test --manifest-path src-tauri/Cargo.toml external_changes -- --nocapture`
- [x] 本地调试日志可看到 watcher 与 fallback 状态切换。

### B2. Deterministic State Model（P0）

- [x] B2.1 新增 `externalChangeStateMachine.ts`，定义 `in-sync/refreshing/external-changed-clean/external-changed-dirty`。
- [x] B2.2 将 `FileViewPanel` 的外部变化分支迁移到 FSM 驱动，移除隐式状态耦合。
- [x] B2.3 增加 `externalChangeStateMachine.test.ts`，覆盖合法迁移与非法输入兜底。

验收：
- [x] `pnpm vitest run src/features/files/externalChangeStateMachine.test.ts src/features/files/components/FileViewPanel.test.tsx`

### B3. Win/mac Reliability & Scope Hardening（P0）

- [x] B3.1 Windows case-insensitive 路径归一；同一文件大小写变化事件不重复触发。
- [x] B3.2 macOS rename+change burst 去抖/去重，单次保存仅触发一次有效迁移。
- [x] B3.3 文件暂态锁（permission denied/resource busy/sharing violation）采用受控退避重试策略。
- [x] B3.4 增加结构化日志字段，能定位平台分支与降级原因。

验收：
- [x] 覆盖 Windows/mac 回放样例测试并通过（单测或集成测试）。

### B4. Rollback Guard（P0）

- [x] B4.1 新增配置开关：`detachedExternalChangeAwarenessEnabled`（总开关）。
- [x] B4.2 新增配置开关：`detachedExternalChangeWatcherEnabled`（watcher 开关）。
- [x] B4.3 Settings UI 接入两项开关，并验证关闭后行为可回退到 polling 基线。

验收：
- [x] `pnpm tsc --noEmit`
- [x] 关闭开关后，功能行为与预期回滚路径一致。

## Verification Record (2026-03-28)

- `pnpm vitest run src/features/files/externalChangeStateMachine.test.ts src/features/files/components/FileViewPanel.test.tsx src/features/files/components/DetachedFileExplorerWindow.test.tsx src/features/files/components/FileExplorerWorkspace.test.tsx` ✅
- `pnpm tsc --noEmit` ✅
- `cargo test --manifest-path src-tauri/Cargo.toml external_changes -- --nocapture` ✅
