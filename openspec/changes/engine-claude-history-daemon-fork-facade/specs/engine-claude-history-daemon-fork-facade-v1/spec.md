# engine-claude-history-daemon-fork-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: daemon Claude history fork MUST go through the default-off facade

`daemon_state.rs::fork_claude_session` MUST 经 `EngineManager::fork_claude_history_session`。MUST NOT 直调 `claude_history::fork_claude_session_with_config`。MUST NOT 删除 `engine/claude_history*`。本刀 MUST NOT 改 daemon `from_message` / delete。

#### Scenario: daemon fork uses the manager entry

- **WHEN** 检查 `daemon_state.rs`
- **THEN** `fork_claude_session` MUST 调用 `fork_claude_history_session`
- **AND** MUST NOT 直调 `claude_history::fork_claude_session_with_config`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** daemon history fork MUST 仍写同一份磁盘 JSONL 实现
