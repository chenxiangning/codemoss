# engine-claude-config-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude engine config MUST go through the facade when dual-run is on

`EngineManager::set_engine_config` 对 Claude MUST 经 `ClaudeCompatAdapter::set_config` 或同一份 Core manager。`claude_manager` MUST NOT 再是公开字段。产品模块 MUST NOT 直打 `.claude_manager`。MUST NOT 删除 `engine/claude*`。

#### Scenario: flagged config shares the Core manager

- **WHEN** `EngineManager` 以 facade enabled 构造
- **AND** `set_engine_config(Claude, config)`
- **THEN** 配置 MUST 写到同一份 Core `ClaudeSessionManager`

#### Scenario: product modules cannot touch the field

- **WHEN** 检查 `lib.rs` / `state.rs` / `engine/commands.rs` / daemon / runtime / shared_session_v2 / `codex/mod.rs`
- **THEN** 这些文件 MUST NOT 包含 `.claude_manager`
