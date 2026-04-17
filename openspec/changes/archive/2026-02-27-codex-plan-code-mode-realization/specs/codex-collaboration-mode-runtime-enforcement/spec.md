## ADDED Requirements

### Requirement: Effective Collaboration Mode Resolution

系统 MUST 在 Codex 消息发送链路中计算并输出线程级 `effective_mode`，不得仅依赖外部 app-server 对 `collaborationMode` 的解释。

#### Scenario: explicit mode resolves to effective mode

- **GIVEN** 用户在 Codex 会话中显式选择 `plan` 或 `code`
- **WHEN** 系统发起 `turn/start`
- **THEN** 系统 MUST 计算 `effective_mode`
- **AND** `effective_mode` MUST 与显式选择一致

#### Scenario: missing or invalid mode falls back deterministically

- **GIVEN** 请求中的协作模式缺失或非法
- **WHEN** 系统计算协作模式
- **THEN** 系统 MUST 回退到确定性默认模式
- **AND** MUST 记录 `fallback_reason`

### Requirement: Thread-Level Mode State Consistency

系统 MUST 在同一线程多轮对话中保持协作模式一致性，并定义 fork/resume 的继承规则。

#### Scenario: same thread keeps effective mode across turns

- **GIVEN** 线程 T 已计算出 `effective_mode=plan`
- **WHEN** 线程 T 发起后续 turn 且未显式切换模式
- **THEN** 系统 MUST 继续使用 `effective_mode=plan`

#### Scenario: fork or resume inherits mode unless explicitly overridden

- **GIVEN** 子线程或恢复线程来源于已有模式线程
- **WHEN** 新线程未提供显式模式
- **THEN** 系统 MUST 继承来源线程的 `effective_mode`
- **AND** 若请求显式指定模式，MUST 以显式指定覆盖继承结果

### Requirement: Mode-Aware RequestUserInput Enforcement

系统 MUST 在 `effective_mode=code` 时阻断 `item/tool/requestUserInput` 进入交互问答链路。

#### Scenario: code mode blocks request user input card flow

- **GIVEN** 当前线程 `effective_mode=code`
- **WHEN** 系统收到 `item/tool/requestUserInput`
- **THEN** 系统 MUST 阻断该事件进入交互卡片流程
- **AND** MUST 发出标准化阻断提示事件

#### Scenario: plan mode preserves request user input flow

- **GIVEN** 当前线程 `effective_mode=plan`
- **WHEN** 系统收到 `item/tool/requestUserInput`
- **THEN** 系统 MUST 保持现有交互提问流程
- **AND** MUST NOT 误触发阻断提示

### Requirement: Collaboration Mode Observability

系统 MUST 为每轮协作模式决策输出结构化可观测字段，支持问题定位与回归审计。

#### Scenario: logs include selected and effective mode metadata

- **WHEN** 系统发送 Codex 用户消息并启动 turn
- **THEN** 调试或日志输出 MUST 包含 `selected_mode` 与 `effective_mode`
- **AND** MUST 包含 `policy_version`
- **AND** 当发生降级时 MUST 包含 `fallback_reason`
