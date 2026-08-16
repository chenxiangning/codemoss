# engine-claude-history-delete-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: GUI Claude history delete MUST go through the default-off facade

`session_history_commands.rs::delete_claude_session` MUST 经 `EngineManager::delete_claude_history_session`。flag on MUST 走 `ClaudeCompatAdapter::delete_history_session`。flag off MUST 走同一份 `claude_history::delete_claude_session_with_config`。MUST NOT 删除 `engine/claude_history*`。本刀 MUST NOT 改 daemon / catalog。

#### Scenario: GUI delete uses the manager entry

- **WHEN** 检查 `session_history_commands.rs`
- **THEN** `delete_claude_session` MUST 调用 `delete_claude_history_session`
- **AND** MUST NOT 直调 `claude_history::delete_claude_session_with_config`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** history delete MUST 仍写同一份磁盘 JSONL 实现
