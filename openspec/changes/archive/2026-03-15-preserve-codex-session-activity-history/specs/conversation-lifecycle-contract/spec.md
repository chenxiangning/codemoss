## ADDED Requirements

### Requirement: Codex History Reopen Must Recover Structured Activity Facts

当 `Codex` 历史会话重新打开时，系统 MUST 从可恢复事实源重建关键结构化活动，不得仅因 `resumeThread` 快照稀疏而丢失已展示内容。

#### Scenario: sparse resume snapshot still recovers key activity

- **WHEN** `Codex` 历史会话的 `resumeThread` 结果只包含消息正文或缺少结构化活动项
- **THEN** 系统 MUST 使用可恢复的历史事实源补建 `reasoning`、`commandExecution`、`fileChange`
- **AND** 用户重新打开同一会话时 MUST 继续看到这些活动事实

#### Scenario: history fallback stays inside codex adapter boundary

- **WHEN** 系统为 `Codex` 启用历史 fallback
- **THEN** 该补偿逻辑 MUST 保持在 Codex adapter / history loader 边界内
- **AND** `Claude` 与 `OpenCode` 的生命周期行为 MUST 保持不变
