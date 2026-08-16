# engine-claude-history-hydrate-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: GUI Claude history hydrate MUST go through the default-off facade

`session_history_commands.rs::hydrate_claude_deferred_image` MUST 经 `EngineManager::hydrate_claude_history_image`。flag on MUST 走 `ClaudeCompatAdapter::hydrate_history_image`。flag off MUST 走同一份 `claude_history::hydrate_claude_deferred_image_with_config`。MUST NOT 删除 `engine/claude_history*`。

#### Scenario: GUI hydrate uses the manager entry

- **WHEN** 检查 `session_history_commands.rs`
- **THEN** `hydrate_claude_deferred_image` MUST 调用 `hydrate_claude_history_image`
- **AND** MUST NOT 直调 `claude_history::hydrate_claude_deferred_image_with_config`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** history hydrate MUST 仍读同一份磁盘 JSONL 实现
