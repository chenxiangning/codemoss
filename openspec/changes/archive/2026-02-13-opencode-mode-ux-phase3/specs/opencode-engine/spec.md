## ADDED Requirements

### Requirement: OpenCode UX Isolation Guard

系统 MUST 保证 OpenCode 模式 UX 改造不会改变 Claude/Codex 的默认渲染与交互流程。

#### Scenario: OpenCode panel does not alter Claude/Codex

- **WHEN** 当前引擎不是 OpenCode
- **THEN** 系统 MUST 不渲染 OpenCode 专属状态面板、MCP 控制区、Provider 健康检查入口

#### Scenario: OpenCode state does not leak to other engines

- **WHEN** 用户从 OpenCode 切换到 Claude 或 Codex
- **THEN** 系统 MUST 不复用 OpenCode 专属 UI 状态到其他引擎
