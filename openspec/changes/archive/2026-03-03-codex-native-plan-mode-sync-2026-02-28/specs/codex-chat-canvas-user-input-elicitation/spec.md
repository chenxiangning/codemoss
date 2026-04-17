## MODIFIED Requirements

### Requirement: askuserquestion Semantic Mapping

系统 MUST 在工具展示层将 `askuserquestion` 与 `requestUserInput` 语义对齐，并与官方 `Plan Mode` / `Default` 术语保持一致。

#### Scenario: tool log alias maps to user input request semantics

- **WHEN** 工具日志中出现 `askuserquestion` 工具名
- **THEN** 幕布 MUST 将展示名映射为 `"User Input Request"` 或等效本地化术语
- **AND** 用户 MUST 能理解该事件属于“需要用户回答”的流程而非普通日志

#### Scenario: blocked askuserquestion keeps official terminology

- **GIVEN** 当前线程运行时模式为 `effective_mode=code`
- **WHEN** 系统阻断 `item/tool/requestUserInput`
- **THEN** 用户可见提示 MUST 使用 `Default` / `Plan Mode` 术语表达
- **AND** MUST NOT 暴露底层术语 `Collaboration mode: code`

#### Scenario: plan mode keeps interactive behavior

- **GIVEN** 当前线程运行时模式为 `effective_mode=plan`
- **WHEN** 工具日志中出现 `askuserquestion`
- **THEN** 系统 MUST 保持交互提问卡片路径可用
- **AND** MUST NOT 显示误导性的模式阻断提示

### Requirement: Mode-Blocked RequestUserInput Event Compatibility

系统 MUST 在 `requestUserInput` 被阻断时发出兼容事件，供前端稳定展示解释性反馈与切换建议。

#### Scenario: blocked event includes actionable context with dual-case compatibility

- **GIVEN** `requestUserInput` 被模式策略阻断
- **WHEN** 系统生成阻断反馈事件
- **THEN** 事件 MUST 包含 `threadId/thread_id`、`blockedMethod/blocked_method`、`effectiveMode/effective_mode` 与 `reason`
- **AND** SHOULD 包含可执行建议（例如切换到 `Plan Mode`）

#### Scenario: blocked event can remove pending request by id compatibility

- **GIVEN** 阻断事件携带 `requestId` 或 `request_id`
- **WHEN** 前端消费该事件
- **THEN** 前端 MUST 能识别两种命名并从待处理请求队列移除对应项
- **AND** 队列状态 MUST 保持线程隔离
