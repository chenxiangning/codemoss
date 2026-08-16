# engine-claude-history-daemon-hydrate-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: daemon Claude history hydrate MUST go through the default-off facade

`daemon_state.rs::hydrate_claude_deferred_image` MUST 经 `EngineManager::hydrate_claude_history_image`。MUST NOT 直调 `claude_history::hydrate_claude_deferred_image_with_config`。MUST NOT 删除 `engine/claude_history*`。本刀 MUST NOT 改 daemon fork / delete。

#### Scenario: daemon hydrate uses the manager entry

- **WHEN** 检查 `daemon_state.rs`
- **THEN** `hydrate_claude_deferred_image` MUST 调用 `hydrate_claude_history_image`
- **AND** MUST NOT 直调 `claude_history::hydrate_claude_deferred_image_with_config`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** daemon history hydrate MUST 仍读同一份磁盘 JSONL 实现
