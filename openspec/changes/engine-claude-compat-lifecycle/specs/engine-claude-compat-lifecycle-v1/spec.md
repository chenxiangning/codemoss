# engine-claude-compat-lifecycle-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude facade MUST own remove and interrupt when the dual-run flag is on

flag 开启时，`EngineManager` MUST 经 `ClaudeCompatAdapter` 做 workspace remove / interrupt，且 MUST 使用同一份 `ClaudeSessionManager`。flag 关闭时 MUST NOT 经门面。MUST NOT 删除 `engine/claude*`。

#### Scenario: flagged remove shares the Core session table

- **WHEN** `EngineManager` 以 facade enabled 构造
- **AND** 先经 getter 取得 session
- **AND** 再经 `remove_claude_session` 移除
- **THEN** Core `claude_manager.get_session` MUST 返回 None

#### Scenario: flagged interrupt delegates to the same manager

- **WHEN** `EngineManager` 以 facade enabled 构造
- **AND** 调用 `interrupt_claude_sessions`
- **THEN** 调用 MUST 经门面到达同一份 `ClaudeSessionManager`
