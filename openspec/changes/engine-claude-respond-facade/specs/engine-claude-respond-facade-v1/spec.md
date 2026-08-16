# engine-claude-respond-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude control responses MUST go through EngineManager

Codex shared / native `respond_to_server_request` 与 daemon `respond_to_server_request` 的 Claude 分支 MUST 调用 `EngineManager` 入口。MUST NOT 在这些入口直打 `claude_manager`。MUST NOT 删除 `engine/claude*`。

#### Scenario: Codex shared control uses the manager entry

- **WHEN** 检查 `codex/mod.rs` 的 `respond_to_shared_control_request`
- **THEN** Claude 分支 MUST 包含 `get_claude_session_if_present`
- **AND** MUST NOT 包含 `claude_manager`

#### Scenario: daemon respond uses the manager entry

- **WHEN** 检查 daemon `respond_to_server_request`
- **THEN** MUST 包含 `claude_sessions_for_workspace`
- **AND** MUST NOT 包含 `claude_manager`
