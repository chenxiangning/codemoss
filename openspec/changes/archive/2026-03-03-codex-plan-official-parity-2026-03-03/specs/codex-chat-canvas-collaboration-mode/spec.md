## MODIFIED Requirements

### Requirement: Collaboration Mode Switch Consistency

Codex 会话默认协作模式 MUST 为 `Default`（运行时 `code`），且用户选择的协作模式 MUST 在后续消息中形成可观测且可验证的有效模式。

#### Scenario: default collaboration mode for codex resolves to default runtime

- **GIVEN** 用户进入新的 Codex 会话
- **AND** 用户尚未显式选择协作模式
- **WHEN** 协作模式初始化并准备发送首轮消息
- **THEN** 默认 UI 模式 MUST 为 `Default`
- **AND** 默认运行时模式 MUST 为 `code`

#### Scenario: explicit user selection overrides default

- **GIVEN** 用户手动切换为 Plan 或 Default
- **WHEN** 后续消息发送与会话继续
- **THEN** 系统 MUST 使用用户最终选择作为本轮模式输入
- **AND** 不得被默认值再次覆盖

#### Scenario: effective mode is emitted for codex turn start

- **GIVEN** 用户已选择协作模式
- **WHEN** 系统发起 Codex `turn/start`
- **THEN** 系统 MUST 产出该线程的 `selected_ui_mode` 与 `effective_runtime_mode`
- **AND** MUST 提供可观测信息用于确认本轮实际生效模式

#### Scenario: non-codex engines are not affected

- **WHEN** 当前活动引擎为 `claude` 或 `opencode`
- **THEN** 本协作模式机制 MUST NOT 改变其既有行为
