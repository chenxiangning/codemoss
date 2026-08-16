# engine-claude-history-native-resolve-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: native continuation Claude resolve MUST go through the default-off facade

`native_continuation/commands.rs` MUST 经 `EngineManager::resolve_claude_history_session_file`。flag on MUST 走门面。flag off MUST 走同一份 `resolve_claude_session_file_with_config`。MUST NOT 删除 `engine/claude_history*`。

#### Scenario: native resolve uses the manager entry

- **WHEN** 检查 `native_continuation/commands.rs`
- **THEN** source path 与 bootstrap evidence MUST 调用 `resolve_claude_history_session_file`
- **AND** MUST NOT 直调 `claude_history::resolve_claude_session_file_with_config`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** native resolve MUST 仍读同一份磁盘 JSONL 路径解析实现
