# engine-claude-history-list-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: GUI Claude history list MUST go through the default-off facade

`session_history_commands.rs::list_claude_sessions` MUST 经 `EngineManager::list_claude_history_sessions`。flag on MUST 走 `ClaudeCompatAdapter::list_history_sessions`。flag off MUST 走同一份 `claude_history::list_claude_sessions_with_config`。MUST NOT 删除 `engine/claude_history*`。

#### Scenario: GUI list uses the manager entry

- **WHEN** 检查 `session_history_commands.rs`
- **THEN** `list_claude_sessions` MUST 调用 `list_claude_history_sessions`
- **AND** MUST NOT 直调 `claude_history::list_claude_sessions_with_config`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** history list MUST 仍读同一份磁盘 JSONL 实现
