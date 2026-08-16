# engine-claude-lookup-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: remaining Claude session lookups MUST go through EngineManager

`shared_session_v2` 的 Claude lookup、`session_lifecycle` stop、换 bin 时的 session list MUST 调用 `EngineManager` 入口。MUST NOT 在这些入口直打 `claude_manager`。MUST NOT 删除 `engine/claude*`。

#### Scenario: shared session lookup uses the manager entry

- **WHEN** 检查 `shared_session_v2.rs` 的 Claude 分支
- **THEN** MUST 包含 `get_claude_session_if_present`
- **AND** MUST NOT 包含 `claude_manager`

#### Scenario: workspace stop uses the manager entry

- **WHEN** 检查 `session_lifecycle.rs` 的 `stop_claude_workspace_session`
- **THEN** MUST 包含 `claude_runtime_sessions_for_workspace`
- **AND** MUST NOT 包含 `claude_manager`
