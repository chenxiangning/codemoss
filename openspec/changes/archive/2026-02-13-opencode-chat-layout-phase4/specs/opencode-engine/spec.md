## MODIFIED Requirements

### Requirement: OpenCode Mode UX Isolation
系统 MUST 保证 OpenCode 模式 UX 改造不影响 Claude/Codex 模式的布局、交互和默认行为。

#### Scenario: render non-opencode engines
- **WHEN** 当前引擎为 Claude 或 Codex
- **THEN** 系统 MUST NOT 渲染 OpenCode 状态摘要条与抽屉面板
- **AND** 现有 Claude/Codex 聊天流程 MUST 保持不变

### Requirement: OpenCode Session Stability During UI Overlay Changes
系统 SHALL 在 OpenCode 模式下确保会话发送链路不因 UI 面板开关而改变目标会话。

#### Scenario: send while toggling drawer
- **WHEN** 用户在发送消息前后快速打开/关闭 OpenCode 抽屉
- **THEN** 消息 SHALL 仍写入当前活动 OpenCode 会话
- **AND** 系统 SHALL 不出现旧会话转圈而新会话出回答的错位现象
