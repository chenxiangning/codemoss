# engine-claude-flag-on-call-path-tests-v1 Spec Delta

## ADDED Requirements

### Requirement: flag-on Claude history MUST share the Core implementation without product default-on

`new_with_claude_compat(true)` MUST 走门面 history handle。`EngineManager::new()` MUST 在未设置 env 时保持 off。flag on / flag off 在无 Claude home 时 MUST 返回同一错误。MUST NOT 删除 `engine/claude*`。

#### Scenario: injected flag-on uses the facade handle

- **WHEN** 构造 `EngineManager::new_with_claude_compat(true)`
- **THEN** `owned_claude_history().uses_facade()` MUST 为 true

#### Scenario: product constructor stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE` 并调用 `EngineManager::new()`
- **THEN** `claude_compat_enabled()` MUST 为 false
