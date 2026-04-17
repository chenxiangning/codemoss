## MODIFIED Requirements

### Requirement: Collaboration Mode Switch Consistency

Codex 会话默认协作模式 MUST 为 Plan，且用户选择的协作模式 MUST 在后续消息中形成可观测且可验证的有效模式。

#### Scenario: default collaboration mode for codex is plan

- **GIVEN** 用户进入新的 Codex 会话
- **AND** 用户尚未显式选择协作模式
- **WHEN** 协作模式初始化
- **THEN** 默认模式 MUST 为 `plan`

#### Scenario: explicit user selection overrides default

- **GIVEN** 用户手动切换为 Code 或 Plan
- **WHEN** 后续消息发送与会话继续
- **THEN** 系统 MUST 使用用户最终选择作为本轮模式输入
- **AND** 不得被默认值再次覆盖

#### Scenario: effective mode is emitted for codex turn start

- **GIVEN** 用户已选择协作模式
- **WHEN** 系统发起 Codex `turn/start`
- **THEN** 系统 MUST 产出该线程的 `effective_mode`
- **AND** MUST 提供可观测信息用于确认本轮实际生效模式

#### Scenario: non-codex engines are not affected

- **WHEN** 当前活动引擎为 `claude` 或 `opencode`
- **THEN** 本协作模式机制 MUST NOT 改变其既有行为
