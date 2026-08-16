# engine-claude-history-daemon-load-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: daemon Claude history load MUST go through the default-off facade

`daemon_state.rs::load_claude_session` MUST 经 `EngineManager::load_claude_history_session`。MUST NOT 直调 `claude_history::load_claude_session_with_config`。MUST NOT 删除 `engine/claude_history*`。本刀 MUST NOT 改 daemon hydrate / fork / delete。

#### Scenario: daemon load uses the manager entry

- **WHEN** 检查 `daemon_state.rs`
- **THEN** `load_claude_session` MUST 调用 `load_claude_history_session`
- **AND** MUST NOT 直调 `claude_history::load_claude_session_with_config`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** daemon history load MUST 仍读同一份磁盘 JSONL 实现
