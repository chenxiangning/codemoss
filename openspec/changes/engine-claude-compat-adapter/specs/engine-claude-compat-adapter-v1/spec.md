# engine-claude-compat-adapter-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude Pilot MUST expose a single-owner compatibility facade before dual-run

Core MUST 提供 `ClaudeCompatAdapter`，其 `pluginId` MUST 为 `com.mossx.engine.claude`。该门面 MUST 委托现有 `ClaudeSessionManager` 与 `BuiltinEngineAdapter`，MUST NOT 维护第二份 session 表。本 change MUST NOT 把 registry 中的 `builtin.claude` 换成 plugin source，MUST NOT 删除 `engine/claude*`。

#### Scenario: facade shares the core session manager

- **WHEN** 对同一 workspace 连续两次 `get_or_create_session`
- **THEN** 两次 MUST 返回同一 `Arc<ClaudeSession>`

#### Scenario: production registry stays builtin

- **WHEN** 构造 `EngineAdapterRegistry::with_builtins()`
- **THEN** `claude` 的 `adapter_id` MUST 仍为 `builtin.claude`
