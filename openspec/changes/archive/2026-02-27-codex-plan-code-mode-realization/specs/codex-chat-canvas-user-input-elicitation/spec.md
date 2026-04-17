## MODIFIED Requirements

### Requirement: askuserquestion Semantic Mapping

系统 MUST 在工具展示层将 `askuserquestion` 与 `requestUserInput` 语义对齐，并在 Code 模式阻断时提供明确的模式反馈。

#### Scenario: tool log alias maps to user input request semantics

- **WHEN** 工具日志中出现 `askuserquestion` 工具名
- **THEN** 幕布 MUST 将展示名映射为 `User Input Request` 或等效本地化术语
- **AND** 用户 MUST 能理解该事件属于需要用户回答的流程而非普通日志

#### Scenario: askuserquestion in code mode shows plan mode hint when blocked

- **GIVEN** 当前线程 `effective_mode=code`
- **WHEN** 系统拦截 `item/tool/requestUserInput`
- **THEN** 工具展示区域 MUST 显示模式受限提示
- **AND** 提示 MUST 明确该能力需要 Plan 模式

#### Scenario: askuserquestion in plan mode keeps interactive behavior

- **GIVEN** 当前线程 `effective_mode=plan`
- **WHEN** 工具日志中出现 `askuserquestion`
- **THEN** 系统 MUST 保持交互提问卡片路径可用
- **AND** MUST NOT 显示误导性的模式阻断提示

## ADDED Requirements

### Requirement: Mode-Blocked RequestUserInput Event Compatibility

系统 MUST 在 Code 模式阻断 `requestUserInput` 时发出兼容事件，供前端展示解释性反馈。

#### Scenario: blocked event includes actionable context

- **GIVEN** `requestUserInput` 在 Code 模式被阻断
- **WHEN** 系统生成阻断反馈事件
- **THEN** 事件 MUST 包含 `threadId`、`blockedMethod`、`effectiveMode` 与 `reason`
- **AND** 事件 SHOULD 包含可执行建议（例如切换到 Plan 模式）
