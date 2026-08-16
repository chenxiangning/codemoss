# engine-claude-history-load-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: GUI Claude history load MUST go through the default-off facade

`session_history_commands.rs::load_claude_session` MUST 经 `EngineManager::load_claude_history_session`。flag on MUST 走 `ClaudeCompatAdapter::load_history_session`。flag off MUST 走同一份 `claude_history::load_claude_session_with_config_window`。MUST NOT 删除 `engine/claude_history*`。

#### Scenario: GUI load uses the manager entry

- **WHEN** 检查 `session_history_commands.rs`
- **THEN** `load_claude_session` MUST 调用 `load_claude_history_session`
- **AND** MUST NOT 直调 `claude_history::load_claude_session_with_config_window`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** history load MUST 仍读同一份磁盘 JSONL 实现
