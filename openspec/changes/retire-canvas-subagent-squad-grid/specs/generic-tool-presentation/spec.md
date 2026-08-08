## MODIFIED Requirements

### Requirement: SubAgent tools may use generic tool chrome on canvas

幕布上的 SubAgent 类 tool item（`isSubagentTool` 为真）MUST 允许以 Generic 工具行呈现。系统 MUST NOT 要求幕布使用 persona 卡或 squad 网格作为唯一呈现。并行的 SubAgent 型 task-notification MUST NOT 再作为完成卡（见 `claude-subagent-canvas-surface`）。

#### Scenario: Agent tool without squad host

- **WHEN** a Claude Agent/Task tool item is rendered on the main canvas timeline
- **THEN** the system MUST present it as a plain/generic tool row
- **AND** MUST NOT mount `SubagentSquadGrid` or `SubagentRingCard`

#### Scenario: notification still does not double as completion card

- **WHEN** a SubAgent-style task-notification also appears in the same turn
- **THEN** the system MUST NOT render legacy agent-session completion chrome for that notification
- **AND** completion observability MUST go through strip / StatusPanel / inspector enrich
