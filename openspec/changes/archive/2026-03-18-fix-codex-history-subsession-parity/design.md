## Context

当前 `Codex` 历史 reopening 由 unified history loader 驱动：先读 `resumeThread`，再可选合并本地 `Codex` session fallback。  
现状里，fallback 主要重建 `reasoning / commandExecution / fileChange`，未完整覆盖协作调用事实；同时 unified 路径缺少线程父子关系回填步骤，导致 `threadParentById` 在历史重开后不足。  
`session activity` 的 root-subtree 聚合依赖 `threadParentById` 或 `collabToolCall` fallback 事实，因此会出现“实时有子会话，历史丢子会话”。

## Goals / Non-Goals

**Goals:**

- 在 `Codex` 历史回放阶段重建可用于 thread linking 的协作工具事实。
- 在 unified loader 完成后回填父子关系，使 `session activity` 可稳定恢复 child sessions。
- 将行为收敛到可测试契约，避免仅靠 UI 缓存掩盖数据缺口。

**Non-Goals:**

- 不改变 `session activity` 的主要 UI 布局或交互模型。
- 不引入新的后端持久化 schema。
- 不扩大到非 Codex 引擎的历史解析重构。

## Decisions

### 决策 1：在 `parseCodexSessionHistory` 中扩展协作调用重建

- 选择：识别 `response_item/function_call` 中与协作相关的方法（如 `spawn_agent`、`send_input`、`wait`），输出 `collabToolCall` 语义的 `ConversationItem`。
- 原因：`buildFallbackParentById` 已支持从 `collabToolCall.detail` 解析 `From parent → child`，复用现有契约成本最低。
- 备选方案（未采纳）：新增专用 `threadLink` item 类型。缺点是需要跨 reducer、adapter、panel 改造，风险更高。

### 决策 2：在 unified history loader 路径增加“items -> parent map”回填

- 选择：在 `useThreadActions.resumeThreadForWorkspace` 的 unified 分支里，`setThreadItems` 前后补充一次基于历史 items 的 thread link 回填。
- 原因：legacy 路径已有 `applyCollabThreadLinksFromThread`；unified 路径缺这一步是当前差异根因之一。
- 备选方案（未采纳）：仅依赖 `session-activity` 的 fallback 解析。缺点是主状态缺关系，跨模块行为继续不一致。

### 决策 3：保持引擎隔离，Codex-only 生效

- 选择：仅在 Codex loader / Codex 历史解析中扩展，不改变 Claude/OpenCode 路径。
- 原因：最小化回归面，符合现有 adapter boundary。
- 备选方案（未采纳）：统一改三引擎 loader 结构。缺点是收益不匹配风险。

## Risks / Trade-offs

- [Risk] Codex 历史事件字段多版本差异，可能导致协作调用识别不全  
  → Mitigation: 多 key 兼容解析 + 单测覆盖常见 payload 变体。

- [Risk] 关系回填重复执行导致 parent 覆盖冲突  
  → Mitigation: 复用现有“已有 parent 不覆盖”策略，保持幂等。

- [Risk] 误把非协作函数调用识别为 collab tool facts  
  → Mitigation: 白名单方法名 + payload 结构校验（sender/receiver/newThreadId 至少一项有效）。

## Migration Plan

1. 先补 proposal/specs/design/tasks artifacts，锁定要求与验证口径。
2. 实现 Codex 历史协作调用解析，补 parser 单测。
3. 实现 unified 分支 link 回填，补 history reopen 回归测试。
4. 执行最小验证（target vitest + typecheck）。
5. 若出现回归，回滚到“仅保留既有 history parser + 不启用 link 回填”的前一提交点。

## Open Questions

- `spawn_agent` 历史 payload 在不同 Codex 版本中的字段命名是否需要额外别名（如 `agent_id`、`child_thread_id`）？
- `wait` 事件是否需要参与 thread linking，还是仅作为活动展示事件？
