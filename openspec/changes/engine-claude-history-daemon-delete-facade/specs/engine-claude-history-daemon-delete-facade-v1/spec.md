# engine-claude-history-daemon-delete-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: daemon Claude history delete MUST go through the default-off facade

`daemon_state.rs::delete_claude_session` MUST 经 `EngineManager::delete_claude_history_session`。MUST NOT 直调 `claude_history::delete_claude_session_with_config`。MUST NOT 删除 `engine/claude_history*`。本刀 MUST NOT 改 catalog。

#### Scenario: daemon delete uses the manager entry

- **WHEN** 检查 `daemon_state.rs`
- **THEN** `delete_claude_session` MUST 调用 `delete_claude_history_session`
- **AND** MUST NOT 直调 `claude_history::delete_claude_session_with_config`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** daemon history delete MUST 仍写同一份磁盘 JSONL 实现
