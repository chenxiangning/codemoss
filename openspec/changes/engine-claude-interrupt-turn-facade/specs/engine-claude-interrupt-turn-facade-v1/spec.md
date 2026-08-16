# engine-claude-interrupt-turn-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: product Claude turn interrupt MUST go through EngineManager

GUI `engine_interrupt_turn` 与 daemon `engine_interrupt_turn` 的 Claude 分支 MUST 调用 `EngineManager::interrupt_claude_turn`。MUST NOT 在这两处直打 `claude_manager`。MUST NOT 删除 `engine/claude*`。

#### Scenario: GUI turn interrupt uses the manager entry

- **WHEN** 检查 `engine/commands.rs` 的 `engine_interrupt_turn`
- **THEN** Claude 分支 MUST 包含 `interrupt_claude_turn`
- **AND** MUST NOT 包含 `claude_manager`

#### Scenario: daemon turn interrupt uses the manager entry

- **WHEN** 检查 daemon `engine_interrupt_turn`
- **THEN** Claude 分支 MUST 包含 `interrupt_claude_turn`
- **AND** MUST NOT 包含 `claude_manager`
