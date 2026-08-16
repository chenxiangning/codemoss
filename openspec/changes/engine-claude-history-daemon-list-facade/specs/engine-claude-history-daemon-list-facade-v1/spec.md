# engine-claude-history-daemon-list-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: daemon Claude history list MUST go through the default-off facade

`daemon_state.rs::list_claude_sessions` MUST 经 `EngineManager::list_claude_history_sessions`。MUST NOT 直调 `claude_history::list_claude_sessions_with_config`。MUST NOT 删除 `engine/claude_history*`。本刀 MUST NOT 改 daemon load / fork / delete。

#### Scenario: daemon list uses the manager entry

- **WHEN** 检查 `daemon_state.rs`
- **THEN** `list_claude_sessions` MUST 调用 `list_claude_history_sessions`
- **AND** MUST NOT 直调 `claude_history::list_claude_sessions_with_config`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** daemon history list MUST 仍读同一份磁盘 JSONL 实现
