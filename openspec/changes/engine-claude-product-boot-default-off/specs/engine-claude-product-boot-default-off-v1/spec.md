# engine-claude-product-boot-default-off-v1 Spec Delta

## ADDED Requirements

### Requirement: product Claude boot MUST stay default-off

GUI `state.rs` 与 daemon MUST 调用 `EngineManager::new()`。`new()` MUST 读 `claude_compat_facade_enabled()`。未设置 `MOSSX_CLAUDE_COMPAT_FACADE` MUST 为 false。本 change MUST NOT 修改启动链。MUST NOT 删除 `engine/claude*`。

#### Scenario: product constructors use EngineManager::new

- **WHEN** 检查 `state.rs` 与 `daemon_state.rs`
- **THEN** 两者 MUST 调用 `EngineManager::new()`
- **AND** MUST NOT 调用 `new_with_claude_compat(true)`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** `claude_compat_facade_enabled_from(None)` MUST 为 false
