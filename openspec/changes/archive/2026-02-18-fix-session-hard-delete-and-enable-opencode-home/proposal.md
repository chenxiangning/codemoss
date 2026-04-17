## Why

当前最近会话“删除”在用户感知上并不可靠：前端先本地移除，后端失败被静默吞掉，重启后会话可能重新出现，导致“删不干净”的信任问题。同时，Workspace
Home 的引擎下拉仍将 OpenCode 标为“即将支持”，与实际上已支持 OpenCode chat 的能力不一致，造成入口断层与认知混乱。

## 目标与边界

- 目标
    - 将 Workspace Home 最近会话删除语义升级为“真删除可验证”：成功必须有后端确认，失败必须对用户可见。
    - 打通 Workspace Home 的 OpenCode 启动入口，使其与已支持的 OpenCode chat 能力保持一致。
    - 明确不同引擎（Claude/Codex/OpenCode）的删除策略契约，避免“看起来删了、实际没删”。
- 边界
    - 本变更聚焦于 Workspace Home 最近会话管理与会话入口可用性，不改动消息渲染协议本身。
    - 不引入新的 AI 引擎；仅对现有 OpenCode 能力做入口与状态对齐。

## 非目标

- 不在本提案中引入“回收站/软删除历史恢复”功能。
- 不在本提案中统一重构全部线程存储结构。
- 不改变已有会话内容格式（jsonl 等）的数据模型。

## What Changes

- 将最近会话批量删除从“乐观本地移除 + best-effort 后端调用”升级为“后端确认优先 + 结果回写 UI”。
- 删除流程增加失败显式反馈：包括失败数量、失败原因分类（workspace 未连接、会话不存在、IO/权限错误等）。
- 为不同引擎定义明确删除契约：
    - Claude: 文件级 hard delete 成功后才算删除成功。
    - Codex/OpenCode: 提供可确认的 hard delete/archive 结果，不允许静默失败后仍显示成功。
- Workspace Home 引擎下拉中 OpenCode 从“即将支持(禁用)”改为“可选可用”，并打通“新建会话”到 OpenCode chat。
- 首页引擎可用性状态与实际运行能力对齐，避免 UI 声明与能力不一致。

## 技术方案对比

| 方案                   | 描述                           | 优点                 | 风险/缺点                  |
|----------------------|------------------------------|--------------------|------------------------|
| A. 维持现状，仅优化文案        | 继续使用当前删除链路，增加提示说明“可能稍后同步”    | 开发成本最低             | 无法解决“重启复活”根因，用户信任继续受损  |
| B. 强一致删除确认（推荐）       | 删除动作必须等待后端确认；失败显式提示并回滚 UI 状态 | 语义清晰、行为可预期、便于测试与追踪 | 需补齐引擎差异处理与错误映射         |
| C. 引入软删除本地 tombstone | 前端记录 tombstone 隐藏会话，后端异步慢删   | 短期体验平滑             | 增加状态复杂度，跨端一致性差，后续维护成本高 |

**取舍**：采用 **B**。本问题核心是“删除语义可信度”，必须以“后端确认成功才算成功”为原则。

## Capabilities

### New Capabilities

- `conversation-hard-delete`: 定义最近会话 hard delete 的成功/失败契约、错误可见性与结果一致性。
- `workspace-home-opencode-entry`: 定义 Workspace Home 引擎下拉中 OpenCode 可用性与新建会话入口行为。

### Modified Capabilities

- `workspace-recent-conversations-bulk-management`: 将“确认后删除”从宽泛语义升级为“后端确认删除成功才可从列表移除；失败需显式反馈并保留未删除项”。

## 验收标准

- 删除最近会话后，应用重启不再出现已确认删除成功的会话。
- 若后端删除失败，UI 必须显示失败结果，且对应会话不得被误标为已删除。
- 批量删除时支持部分成功/部分失败回执，并正确反映在列表状态中。
- Workspace Home 引擎下拉中 OpenCode 可被选择，点击“新建会话”可进入 OpenCode chat 流程。
- 引擎入口可用性与运行时能力一致，不再出现“OpenCode 已支持 chat 但首页仍禁用”的状态分裂。

## Impact

- 前端
    - `src/features/workspaces/components/WorkspaceHome.tsx`（删除交互与引擎下拉可用性）
    - `src/App.tsx`（删除回执处理与 Workspace Home 回调）
    - `src/features/threads/hooks/useThreads.ts`（remove/delete 调用语义）
    - `src/features/threads/hooks/useThreadActions.ts`（删除错误处理、结果回写）
- Tauri/Rust
    - `src-tauri/src/engine/claude_history.rs`（Claude hard delete 保证）
    - `src-tauri/src/codex/mod.rs`、`src-tauri/src/shared/codex_core.rs`（Codex/OpenCode 删除确认链路）
- 规范
    - 新增 `conversation-hard-delete`
    - 新增 `workspace-home-opencode-entry`
    - 修改 `workspace-recent-conversations-bulk-management`
