# engine-claude-core-accessor-v1 Spec Delta

## ADDED Requirements

### Requirement: EngineManager MUST read ClaudeSessionManager only through core_claude

`EngineManager` MUST 提供私有 `core_claude()`。flag-off 分支 MUST 经该入口。MUST NOT 在其他方法散落 `self.claude_manager.`。MUST NOT 删除 `engine/claude*`。

#### Scenario: field reads collapse to one accessor

- **WHEN** 检查 `engine/manager.rs`
- **THEN** `self.claude_manager.` MUST 只出现在 `core_claude`
- **AND** flag-off session / interrupt / config 路径 MUST 仍共享同一份 Core manager
