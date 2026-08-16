# engine-claude-history-catalog-delete-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: catalog Claude history delete MUST go through the default-off facade

`session_management.rs` catalog delete MUST 经 `EngineManager::owned_claude_history`。flag on MUST 走门面。flag off MUST 走同一份 `delete_claude_session_with_config`。MUST NOT 删除 `engine/claude_history*`。本刀 MUST NOT 改 native resolve。

#### Scenario: catalog delete uses the owned manager handle

- **WHEN** 检查 `session_management.rs`
- **THEN** catalog delete MUST 调用 `owned_claude_history` / handle delete
- **AND** MUST NOT 直调 `claude_history::delete_claude_session_with_config`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** catalog delete MUST 仍写同一份磁盘 JSONL 实现
