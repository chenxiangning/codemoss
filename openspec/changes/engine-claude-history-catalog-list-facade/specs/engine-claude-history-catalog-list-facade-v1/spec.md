# engine-claude-history-catalog-list-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: catalog Claude attribution list MUST go through the default-off facade

`session_management.rs` catalog list MUST 经 `EngineManager::list_claude_history_sessions_for_attribution_scopes`。flag on MUST 走门面。flag off MUST 走同一份 `list_claude_sessions_for_attribution_scopes_with_config`。MUST NOT 删除 `engine/claude_history*`。MUST NOT 把 catalog 接到 GUI `list_claude_history_sessions`。

#### Scenario: catalog list uses the manager entry

- **WHEN** 检查 `session_management.rs`
- **THEN** catalog list MUST 调用 `list_claude_history_sessions_for_attribution_scopes`
- **AND** MUST NOT 直调 `claude_history::list_claude_sessions_for_attribution_scopes_with_config`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** catalog list MUST 仍读同一份磁盘 JSONL 实现
