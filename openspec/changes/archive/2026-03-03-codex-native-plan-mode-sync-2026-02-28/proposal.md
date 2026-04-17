## Why

你要的目标不是“有个 plan 按钮”，而是“行为对齐官方 Codex.app / CLI”：

- Plan 模式：先规划，不直接动手改仓库。
- Default 模式：可直接执行任务并交付结果。
- 模式询问要有确定性答案，不能依赖模型随机口语化表述。

基于 2026-03-02 最新代码审计，本提案从“模式字段同步”升级为“Codex-only 行为级对齐”。

## Scope

### In Scope

- 仅 Codex 引擎：`Plan Mode` / `Default`
- 模式命令：`/plan` `/default` `/code`（兼容） `/mode`
- 线程级模式收敛（后端真值 + 前端消费）
- Plan 只读硬约束（发送层）
- 用户可见术语清理（禁出 `Collaboration mode: code`）

### Out of Scope

- 非 Codex 引擎（Claude/OpenCode/Gemini）行为改造
- 上游 Codex CLI / app-server 改动
- 多引擎统一模式体系重构

## Current Status (Code Audit)

### 已完成（可运行）

1. Codex-only slash 协议已落地：`/plan` `/default` `/code` `/mode`  
   - `src/features/threads/hooks/useQueuedSend.ts`
2. `/plan <text>` / `/default <text>` 原子链路已落地  
3. 非 Codex 下命令透传为普通文本  
4. `/mode` 确定性结构化返回已落地  
   - `src/features/threads/hooks/useThreadMessaging.ts`
5. 线程级模式状态已落地（避免串台）  
   - `src/App.tsx`
6. `collaboration/modeResolved` 后端发射 + 前端消费已落地  
   - `src-tauri/src/codex/mod.rs`
   - `src/features/app/hooks/useAppServerEvents.ts`
7. 用户可见术语已对齐 `Plan Mode` / `Default`  
   - `src/utils/collaborationModes.ts`
8. 用户正文去除旧 `Collaboration mode: code` 污染路径  
   - `src-tauri/src/shared/codex_core.rs`
   - `src/features/messages/components/Messages.tsx`
9. Plan 只读硬约束（发送层）已落地  
   - `src-tauri/src/shared/codex_core.rs` `resolve_execution_policy()`

### 未完成（下一迭代增强）

1. Plan 写阻断的统一事件协议未完整落地（`plan_readonly_violation` 目前主要在日志层）。
2. repo-mutating command 尚未做显式分类器（当前主要依赖 readOnly sandbox 兜底阻断）。

## What This Proposal Delivers

### 1) Official Semantics Parity (Codex-only)

- 用户只看到：`Plan Mode` / `Default`
- 内部仍保留：`plan` / `code`
- 固定映射：`default -> code`, `plan -> plan`

### 2) Deterministic Mode Contract

- `/mode` 返回 `{threadId, uiMode, runtimeMode}`
- `modeResolved` 作为最终真值，前端幂等收敛

### 3) Plan Hard Constraint (Executable)

- 当 `mode_enforcement_enabled && effective_mode=plan`：
  - `sandboxPolicy` 强制 `readOnly`
  - `approvalPolicy` 强制 `on-request`
- Default（runtime `code`）保持既有执行策略

### 4) Backward Compatibility

- `/code` 保留兼容（等价 `/default`）
- 非 Codex 路径不受影响

## Acceptance Criteria

1. Codex 用户可见模式仅 `Plan Mode` / `Default`。
2. 用户正文不出现 `Collaboration mode: code`。
3. Codex `/plan` `/default` `/code` `/mode` 行为符合协议，非 Codex 透传文本。
4. `modeResolved` 事件可被前端稳定消费，线程切换不串台。
5. Plan 模式执行策略具备硬约束（readOnly + on-request）。
6. Default 模式执行策略保持既有能力。

## Risks

- Plan 阻断提示尚未完全事件标准化，部分反馈仍依赖底层错误文本。
- repo-mutating 分类未独立建模，当前依赖沙箱行为。

## Rollback

- 关闭 `codex_mode_enforcement_enabled`，即可回落到非硬约束路径。
- slash/modeResolved/术语对齐路径可单独保留，不影响回滚开关。

## Verification Summary

- 已执行并通过：
  - `cargo test --manifest-path src-tauri/Cargo.toml codex_core -- --nocapture`
  - `pnpm vitest run src/features/threads/hooks/useQueuedSend.test.tsx src/features/app/hooks/useAppServerEvents.test.tsx src/features/collaboration/hooks/useCollaborationModes.test.tsx`
  - `pnpm vitest run ... Messages.test.tsx -t "hides code fallback prefix and keeps only actual user request"`
  - `pnpm tsc --noEmit`

详见：`verification.md`
