# engine-claude-owner-dispatch-v1 Spec Delta

## ADDED Requirements

### Requirement: EngineManager MUST dispatch Claude traffic through one owner

`EngineManager` MUST 经 `claude_owner()` 选择门面或 Core。flag on MUST 走门面。flag off MUST 走 Core。remove MUST 只在 Core manager 实现一次。MUST NOT 删除 `engine/claude*`。

#### Scenario: flagged and unflagged paths share one dispatcher

- **WHEN** 检查 `engine/manager.rs`
- **THEN** `get_claude_session` / `remove_claude_session` / `interrupt_claude_sessions` MUST 调用 `claude_owner()`
- **AND** MUST NOT 在这些方法里再写 `if let Some(facade)`
