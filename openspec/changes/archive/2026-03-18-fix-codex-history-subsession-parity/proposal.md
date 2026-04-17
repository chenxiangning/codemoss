## Why

`Codex` 会话在实时阶段可以正确展示子会话（child session）及其活动，但历史 reopening 后经常退化为仅主会话，导致“同一问答实时可见、历史丢失”的体验断裂。  
该问题已经影响 `session activity` 的可信度，且会误导用户判断子会话是否真正执行过。

## 目标与边界

- 目标：保证 `Codex` 历史 reopening 后，子会话关系与活动事实与实时阶段一致。
- 目标：优先修复历史恢复链路（history loader + thread linking），不依赖 UI 补丁掩盖数据缺口。
- 目标：保持 `Claude`、`OpenCode` 现有历史行为不回退。
- 边界：本次不重做右侧 `session activity` UI 架构，不改变面板布局模式。
- 边界：本次不引入新的持久化存储格式，优先复用已有 `Codex` session 历史记录。

## 非目标

- 不重构 `thread reducer` 全链路状态模型。
- 不为所有工具类型新增可视化卡片，仅覆盖会影响子会话拓扑恢复的协作调用事实。
- 不修改跨 workspace 的会话聚合策略。

## What Changes

- 为 `Codex` 历史回放补齐协作调用事实重建（至少覆盖 `spawn_agent / send_input / wait` 对应的 collab tool facts）。
- 在 unified history loader 路径中补充“历史 items -> 线程父子关系”回填，避免仅 `setThreadItems` 不建链。
- 明确 `session activity` 在历史 reopening 下的子会话可见性契约：历史态 MUST 与实时态保持 child session 拓扑连续。
- 新增回归测试，覆盖“实时 3 会话 -> reopen 后仍 3 会话”的一致性场景。

## 技术方案对比

### 方案 A：仅在面板层做 sticky 显示（不采纳）

- 优点：改动小，见效快。
- 缺点：底层父子链路仍缺失，刷新/切换线程后仍会错乱；属于 UI 掩盖，不是事实修复。

### 方案 B：补齐历史事实解析 + 统一回填 thread links（采纳）

- 优点：从数据源修复，消息区与 activity panel 同时受益；可被测试稳定验证。
- 优点：与现有 fallback linking 机制兼容，不要求重写 UI。
- 缺点：需要扩展 `Codex` 历史解析分支并增加链路回填测试。

结论：采纳方案 B，优先修复“历史事实缺失”根因。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-chat-canvas-workspace-session-activity-panel`: 新增历史 reopening 子会话连续性要求，禁止历史态丢失 child session。
- `conversation-lifecycle-contract`: 新增 Codex 历史回放必须可重建协作父子链路的生命周期要求。

## 验收标准

- 同一 Codex 线程在实时阶段出现多个 child sessions 时，历史 reopening 后 `session activity` 仍显示对应子会话。
- 历史 reopening 后，`relevantThreadIds` 与实时阶段同任务上下文保持一致（允许时间排序差异，不允许丢 child）。
- `Claude` 与 `OpenCode` 的历史恢复行为在现有测试基线下保持不变。

## Impact

- Affected code:
  - `src/features/threads/loaders/codexSessionHistory.ts`
  - `src/features/threads/loaders/codexHistoryLoader.ts`
  - `src/features/threads/hooks/useThreadActions.ts`
  - `src/features/session-activity/adapters/buildWorkspaceSessionActivity.ts`（只读契约验证）
  - 对应 loader / session-activity 回归测试文件
- APIs: 无新增对外 API；仅扩展历史恢复内部解析语义。
- Dependencies: 无新增第三方依赖。
