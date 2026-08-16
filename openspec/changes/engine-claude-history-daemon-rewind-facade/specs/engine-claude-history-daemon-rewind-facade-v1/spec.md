# engine-claude-history-daemon-rewind-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: daemon Claude history rewind MUST go through the default-off facade

`daemon_state.rs::fork_claude_session_from_message` MUST 经 `EngineManager::fork_claude_history_session_from_message`。MUST NOT 直调 `claude_history::fork_claude_session_from_message_with_config`。MUST NOT 删除 `engine/claude_history*`。本刀 MUST NOT 改 daemon delete / catalog。

#### Scenario: daemon rewind uses the manager entry

- **WHEN** 检查 `daemon_state.rs`
- **THEN** `fork_claude_session_from_message` MUST 调用 `fork_claude_history_session_from_message`
- **AND** MUST NOT 直调 `claude_history::fork_claude_session_from_message_with_config`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** daemon history rewind MUST 仍写同一份磁盘 JSONL 实现
