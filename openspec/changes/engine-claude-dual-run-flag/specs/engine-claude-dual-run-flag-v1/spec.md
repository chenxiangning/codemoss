# engine-claude-dual-run-flag-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude facade traffic MUST be default-off and share the Core session manager

Core MUST 提供默认关闭的 `MOSSX_CLAUDE_COMPAT_FACADE` flag。flag 关闭时，`EngineManager` MUST NOT 经门面取 session。flag 开启时，`get_claude_session*` MUST 经 `ClaudeCompatAdapter`，且 MUST 使用同一份 `ClaudeSessionManager`。本 change MUST NOT 引入第二个 live owner，MUST NOT 删除 `engine/claude*`。

#### Scenario: flag defaults to off

- **WHEN** 环境变量未设置
- **THEN** `claude_compat_facade_enabled()` MUST 返回 false

#### Scenario: flagged path still shares Core sessions

- **WHEN** `EngineManager` 以 facade enabled 构造
- **AND** 对同一 workspace 分别经门面与 `claude_manager` 取 session
- **THEN** 两个 `Arc<ClaudeSession>` MUST 指针相等
