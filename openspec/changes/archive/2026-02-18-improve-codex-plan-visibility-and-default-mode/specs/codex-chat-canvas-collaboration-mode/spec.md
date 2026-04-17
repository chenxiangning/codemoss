# codex-chat-canvas-collaboration-mode Specification Delta

## MODIFIED Requirements

### Requirement: Collaboration Mode Switch Consistency

Codex 会话默认协作模式 MUST 为 Plan，以降低首轮规划信息不可见风险。

#### Scenario: default collaboration mode for codex is plan

- **GIVEN** 用户进入新的 Codex 会话
- **AND** 用户尚未显式选择协作模式
- **WHEN** 协作模式初始化
- **THEN** 默认模式 MUST 为 `plan`

#### Scenario: explicit user selection overrides default

- **GIVEN** 用户手动切换为 Code 或 Plan
- **WHEN** 后续消息发送与会话继续
- **THEN** 系统 MUST 使用用户最终选择
- **AND** 不得被默认值再次覆盖

#### Scenario: non-codex engines are not affected

- **WHEN** 当前活动引擎为 `claude` 或 `opencode`
- **THEN** 本默认值调整 MUST NOT 改变其既有行为
