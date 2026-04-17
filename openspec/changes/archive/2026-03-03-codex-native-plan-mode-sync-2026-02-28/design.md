## Context

本变更目标是把 Codex 引擎的协作模式从“字段同步”升级到“官方行为对齐”：

- 用户术语只允许 `Plan Mode` / `Default`
- 运行时仍使用 `effective_mode=plan|code`
- 模式命令、模式答复、执行边界三者一致

## Goals / Non-Goals

**Goals**

- Codex-only 对齐 `Plan Mode` / `Default` 行为。
- 提供确定性 `/mode` 查询结果。
- 保证线程级模式收敛（前端状态 + 后端真值事件）。
- Plan 模式具备可执行的只读硬约束（至少发送层强制生效）。

**Non-Goals**

- 不修改上游 Codex CLI / app-server 协议实现。
- 不扩展到非 Codex 引擎。
- 不做多引擎统一重构。

## As-Is Code Map (2026-03-02, after implementation)

### 已落地

- Slash 命令（Codex-only）：`/plan` `/default` `/code` `/mode`
  - `src/features/threads/hooks/useQueuedSend.ts`
- 线程级模式状态与收敛：
  - `src/App.tsx`（`collaborationUiModeByThread` / `collaborationRuntimeModeByThread`）
  - `src/features/threads/hooks/useThreads.ts`
  - `src/features/threads/hooks/useThreadMessaging.ts`
- 后端真值事件：
  - `src-tauri/src/codex/mod.rs` 发射 `collaboration/modeResolved`
  - `src/features/app/hooks/useAppServerEvents.ts` 解析双命名字段
- 用户可见术语清理：
  - `src/utils/collaborationModes.ts`（Plan Mode / Default）
  - `src-tauri/src/shared/codex_core.rs` 替换 fallback 注入文案
  - `src/features/messages/components/Messages.tsx` 兼容清理旧前缀
- Plan 只读硬约束（发送层）：
  - `src-tauri/src/shared/codex_core.rs` `resolve_execution_policy()`
  - enforcement 开启 + `effective_mode=plan` 时强制 `readOnly + on-request`

### 待增强

- Plan 下“写文件/改仓命令”尚未统一标准化事件（reason code + suggestion）；
  当前主要依赖 readOnly 沙箱阻断结果。

## Decisions

### Decision 1: 双层模式模型

- 用户层：`plan | default`
- 运行时：`plan | code`
- 固定映射：`default -> code`, `plan -> plan`

### Decision 2: Codex-only 命令协议

- 官方入口：`/plan`, `/default`, `/mode`
- 兼容入口：`/code`（等价 `/default`，不在 UI 官方术语中外显）
- 非 Codex 引擎：以上命令全部按普通文本发送

### Decision 3: 线程级最终真值

- 真值事件：`collaboration/modeResolved`
- 事件字段兼容 camelCase + snake_case：
  - `threadId/thread_id`
  - `selectedUiMode/selected_ui_mode`
  - `effectiveRuntimeMode/effective_runtime_mode`
  - `effectiveUiMode/effective_ui_mode`
  - `fallbackReason/fallback_reason`
- 前端以 `modeResolved` 覆盖乐观状态，避免线程切换串台

### Decision 4: Plan Readonly Enforcement（当前实现）

发送层执行策略：

1. 先计算线程 `effective_mode`
2. 再计算执行策略
3. 当 `mode_enforcement_enabled && effective_mode=plan`：
   - 强制 `sandboxPolicy = { type: "readOnly" }`
   - 强制 `approvalPolicy = "on-request"`
   - 记录 reason：`plan_readonly_violation`（日志）
4. 当 `effective_mode=code`（UI `Default`）：
   - 保持 access mode 原策略

### Decision 5: 用户正文卫生规则

- 用户可见正文不得出现 `Collaboration mode: code`
- 运行时策略信息保留在不可见指令层或日志层

## Architecture Sketch

```
UI / Slash Input
  -> useQueuedSend (codex-only command gate)
  -> set mode by thread + optional text send
  -> send_user_message (tauri command)
     -> send_user_message_core
        -> resolve_policy (effective_mode)
        -> resolve_execution_policy (plan=>readOnly hard override)
        -> turn/start
     -> emit collaboration/modeResolved
  -> useAppServerEvents / useThreads consume modeResolved
  -> thread-scoped ui/runtime state convergence
```

## Risk & Trade-off

- 优点：不依赖模型自觉，Plan 只读至少在发送层可硬执行。
- 代价：尚未把所有阻断统一成 `modeBlocked` 事件，用户感知仍受底层报错形式影响。
- 回滚：关闭 `codex_mode_enforcement_enabled` 可回落到非硬约束路径。

## Next Iteration (Focused)

1. 增加 repo-mutating command 分类器（覆盖 git 写操作高风险子集）。
2. 将 Plan 写阻断统一映射为 `collaboration/modeBlocked`，reason 固化 `plan_readonly_violation`。
3. 前端统一展示阻断提示，避免底层错误直出。
