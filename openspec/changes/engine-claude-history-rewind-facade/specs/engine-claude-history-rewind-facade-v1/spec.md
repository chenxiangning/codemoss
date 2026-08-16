# engine-claude-history-rewind-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: GUI Claude history rewind MUST go through the default-off facade

`rewind_commands.rs::fork_claude_session_from_message` MUST 经 `EngineManager::fork_claude_history_session_from_message`。flag on MUST 走 `ClaudeCompatAdapter::fork_history_session_from_message`。flag off MUST 走同一份 `claude_history::fork_claude_session_from_message_with_config`。MUST NOT 删除 `engine/claude_history*`。本刀 MUST NOT 改 daemon / catalog。

#### Scenario: GUI rewind uses the manager entry

- **WHEN** 检查 `rewind_commands.rs`
- **THEN** `fork_claude_session_from_message` MUST 调用 `fork_claude_history_session_from_message`
- **AND** MUST NOT 直调 `claude_history::fork_claude_session_from_message_with_config`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** history rewind MUST 仍写同一份磁盘 JSONL 实现
