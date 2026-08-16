# engine-claude-shutdown-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude shutdown and session listing MUST go through EngineManager

GUI exit、daemon shutdown、runtime exit list、diagnostics list MUST 调用 `EngineManager::interrupt_all_claude_sessions` 或 `list_claude_sessions`。MUST NOT 在这些入口直打 `claude_manager.interrupt_all` / `claude_manager.list_sessions`。MUST NOT 删除 `engine/claude*`。

#### Scenario: GUI exit uses the manager entry

- **WHEN** 检查 `lib.rs` 的 ExitRequested 清理
- **THEN** MUST 包含 `interrupt_all_claude_sessions`
- **AND** MUST NOT 包含 `claude_manager.interrupt_all`

#### Scenario: diagnostics list uses the manager entry

- **WHEN** 检查 `engine/commands.rs` 的 session list
- **THEN** MUST 包含 `list_claude_sessions`
- **AND** MUST NOT 包含 `claude_manager.list_sessions`
