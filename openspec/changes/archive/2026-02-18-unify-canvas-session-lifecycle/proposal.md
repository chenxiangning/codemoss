## Why

当前 Codex Chat 幕布在会话生命周期上存在可感知的不可信行为：用户执行“删除已选”后，部分会话在重启后再次出现；同时 OpenCode
的入口可选性、最近会话排序与文案状态在不同界面不一致，导致用户难以判断系统真实状态。

该问题已经触达核心信任链路（删除语义与恢复一致性），必须优先通过规范收敛，把“UI 表达”与“后端事实”绑定。

## 目标与边界

- 统一删除语义：用户可见“删除”必须以后端确认成功为准，并可通过重启复验。
- 统一 OpenCode 入口语义：Workspace Home 与 Composer 对 OpenCode 的可选/可用状态保持一致。
- 统一最近会话排序语义：OpenCode 最近会话排序不依赖单次进程内活动缓存。
- 统一幕布关键文案语义：Plan 与 OpenCode 等待提示遵循 i18n 与统一 fallback。

## 非目标

- 不新增会话存储后端（如 SQLite）或历史数据迁移工具。
- 不重构线程系统整体架构（event bus/reducer/storage）
- 不引入新 AI 能力，仅修复一致性与可信度缺陷。

## 代码现状证据（as-is）

- 删除链路分叉：`removeThread` 对 Claude 调 `archiveClaudeThread`，其内部实际调用 `delete_claude_session`；对非 Claude 调
  `archive_thread`（归档语义）。
- 入口判定不一致：Workspace Home 直接暴露 OpenCode 选项，而 Composer `EngineSelector` 仅允许 installed engine 选择。
- OpenCode 最近会话排序信号弱：`opencode_session_list` 仅返回 `updatedLabel` 文本，前端合并时会回退到内存 activity 值。
- 幕布文案硬编码：PlanPanel 与 Messages 中存在硬编码中英提示文案，未完全走 i18n。

## What Changes

- 明确删除契约：删除成功必须以后端成功回执驱动；失败必须保留会话并暴露标准错误码。
- 收敛跨引擎删除行为：定义 Claude/Codex/OpenCode 的统一用户语义与引擎适配规则。
- 打通 OpenCode 入口一致性：首页入口与输入区引擎选择共享同一可用性判定。
- 补齐 OpenCode 会话排序基线：规范会话更新时间信号与回退顺序。
- 收敛幕布文案：Plan 与等待提示全部纳入 i18n，统一 fallback，禁止混合硬编码。
- 补齐回归清单：删除后重启一致性、入口一致性、排序稳定性、文案一致性。

## 技术方案对比与取舍

### 方案 A：维持现状（删除语义按引擎分裂）

- 优点：改动最小、短期风险低。
- 缺点：用户认知持续混乱；“删后回魂”难以系统性消除；回归口径不统一。

### 方案 B：统一产品语义 + 引擎执行适配（推荐）

- 优点：用户可理解、可验证；失败可观测；测试与发布门禁可统一。
- 缺点：需要补齐 OpenCode/Codex 删除边界与排序时间字段标准化。

**取舍结论**：采用方案 B。以统一用户语义为主线，底层差异仅保留在适配层，不暴露到 UI 语义。

## Capabilities

### New Capabilities

- `conversation-lifecycle-contract`: 定义跨引擎统一会话生命周期契约（delete/archive/sort/reload consistency）。

### Modified Capabilities

- `conversation-hard-delete`: 收敛删除成功判定、错误分类与重启一致性。
- `workspace-recent-conversations-bulk-management`: 增补跨引擎批量删除结果聚合与重载一致性。
- `workspace-home-opencode-entry`: 收敛首页 OpenCode 入口与 Composer 可用性一致。
- `opencode-engine`: 增补 OpenCode session list 稳定排序时间基线与解析失败回退。
- `codex-chat-canvas-plan-visibility`: 增补 Plan 面板文案 i18n 与空态准确性约束。
- `opencode-processing-heartbeat`: 增补等待提示 i18n 与 fallback 一致性约束。

## 验收标准

- 删除后重启一致性：删除成功会话在重启后不得再次出现在最近会话列表。
- 失败可观测性：删除失败必须保留会话并显示标准错误分类。
- 入口一致性：首页与 Composer 对 OpenCode 可选状态完全一致。
- 排序稳定性：OpenCode 最近会话在重启前后遵循同一排序规则。
- 文案一致性：Plan 与等待提示无硬编码混语，均走 i18n 键与统一 fallback。

## Impact

- 前端：WorkspaceHome、EngineSelector、ThreadActions 合并排序、PlanPanel、Messages。
- 后端：会话删除契约映射、OpenCode 会话列表字段与时间解析策略。
- 测试：新增跨引擎删除回归、重启一致性、入口一致性、i18n 快照覆盖。
