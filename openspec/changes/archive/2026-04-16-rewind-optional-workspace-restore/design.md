## Context

当前 `ClaudeRewindConfirmDialog` 已作为 `Claude/Codex` 共用 rewind 审查弹层。`useThreadActions` 在两条 rewind 路径中都会先调用 `applyClaudeRewindWorkspaceRestore`，并在 fork 失败时执行 `restoreClaudeRewindWorkspaceSnapshots` 回滚。现状没有用户可控开关，导致“只想回退会话、不想改工作区文件”的场景无法满足。

该变更目标是在不破坏现有回溯主链路的前提下，新增一个默认开启的文件回退开关，并将其选择值从 UI 透传到实际执行层。

约束：

- `Claude/Codex` 必须保持同一套交互与语义。
- 关闭文件回退开关时，不得影响会话回溯契约与线程状态变更。
- 开关能力属于本地交互参数，不引入后端持久配置。

## Goals / Non-Goals

**Goals:**

- 在 rewind 弹层新增 `restoreWorkspaceFiles` 显式开关，默认 `true`。
- 将该参数透传到 `onRewind -> forkSessionFromMessageForWorkspace -> fork*` 真实执行路径。
- 开关 `ON` 完整复用当前文件回退与失败回滚流程。
- 开关 `OFF` 严格跳过文件回退与文件回滚流程，仅保留会话回溯路径。

**Non-Goals:**

- 不做按文件粒度选择回退。
- 不做开关状态持久化（每次打开重置为默认 `ON`）。
- 不改动 rewind diff 导出（store changes）能力。

## Decisions

### Decision 1: 开关放在确认弹层，而不是输入区

- 方案 A：放在输入区工具栏。
  - 优点：可见度高。
  - 缺点：与“确认执行前决策”语义不一致，且污染主输入区。
- 方案 B：放在 rewind 确认弹层（采用）。
  - 优点：与“确认即执行”语义一致，减少误触。
  - 缺点：需要扩展弹层 props 与测试。

### Decision 2: 参数透传采用可选字段，保持向后兼容

- 方案 A：直接修改 `onRewind(messageId)` 为必填对象参数。
  - 优点：类型严格。
  - 缺点：影响面大，现有调用全量改造。
- 方案 B：保留现有签名兼容，并新增可选 `options.restoreWorkspaceFiles`（采用）。
  - 优点：平滑迁移，调用方可逐步接入。
  - 缺点：需要默认值归一处理。

### Decision 3: `OFF` 分支跳过所有文件回退相关副作用

- 方案 A：仍计算 restore plan，但不实际写文件。
  - 优点：保留更多调试信息。
  - 缺点：引入不必要计算与潜在副作用。
- 方案 B：直接跳过 `applyClaudeRewindWorkspaceRestore` 与快照回滚逻辑（采用）。
  - 优点：行为最清晰，执行路径最短。
  - 缺点：`OFF` 模式下不再产生 restore 相关 debug 事件。

### Decision 4: 默认值每次打开弹层重置为 `ON`

- 方案 A：记忆上次用户选择。
  - 优点：符合部分高级用户习惯。
  - 缺点：状态来源更复杂，容易造成误操作。
- 方案 B：每次打开默认 `ON`（采用）。
  - 优点：安全默认值，符合“当前行为不变”原则。
  - 缺点：频繁需要关闭时多一次点击。

## Risks / Trade-offs

- [Risk] 仅改 UI 未透传到执行层，导致“开关有了但不生效”  
  → Mitigation：在 `Composer` 与 `useThreadActions` 增加参数断言测试。

- [Risk] `OFF` 分支误触发文件回滚回滚逻辑  
  → Mitigation：将 restore state 初始化与回滚分支都绑定 `restoreWorkspaceFiles===true` 前置条件。

- [Risk] `Codex` 与 `Claude` 语义不一致  
  → Mitigation：新增双引擎对照测试，覆盖开关 `ON/OFF` 结果。

## Migration Plan

1. 扩展 rewind 弹层 props，新增 `restoreWorkspaceFiles` 状态与 `onChange` 回调。
2. 在 `Composer` 中持有开关状态，弹层打开时重置为 `true`。
3. 扩展 `onRewind` 调用参数，透传 `restoreWorkspaceFiles` 到线程执行层。
4. 在 `useThreadActions` 的 Claude/Codex rewind 分支按参数分流：`ON` 执行 restore；`OFF` 跳过 restore。
5. 补充前端与 hook 测试，覆盖两种模式和错误回滚边界。

回滚策略：

- 若上线后出现异常，可临时退回到“强制 `restoreWorkspaceFiles=true`”逻辑，不影响会话回溯主功能。

## Open Questions

- 本变更无阻塞实现的开放问题。
