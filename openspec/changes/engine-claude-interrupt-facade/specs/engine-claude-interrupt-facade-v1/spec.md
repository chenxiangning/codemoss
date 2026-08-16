# engine-claude-interrupt-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: product Claude interrupt MUST go through EngineManager

GUI `engine_interrupt` 与 daemon `engine_interrupt` 的 Claude 分支 MUST 调用 `EngineManager::interrupt_claude_sessions`。MUST NOT 在这两处直打 `claude_manager.interrupt_workspace_sessions`。MUST NOT 删除 `engine/claude*`。

#### Scenario: GUI interrupt uses the manager entry

- **WHEN** 检查 `engine/commands.rs` 的 `engine_interrupt`
- **THEN** Claude 分支 MUST 包含 `interrupt_claude_sessions`
- **AND** MUST NOT 包含 `claude_manager.interrupt_workspace_sessions`

#### Scenario: daemon interrupt uses the manager entry

- **WHEN** 检查 daemon `engine_interrupt`
- **THEN** Claude 分支 MUST 包含 `interrupt_claude_sessions`
- **AND** MUST NOT 包含 `claude_manager.interrupt_workspace_sessions`
