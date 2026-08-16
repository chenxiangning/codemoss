# Design: engine-claude-compat-lifecycle

## Decisions

### D1. 门面只委托，不另建表

`remove_workspace_sessions` 复用现有 `runtime_sessions_for_workspace` + `interrupt` + `remove_runtime_session`。`interrupt_workspace_sessions` 直接转调 Core manager。

### D2. 只切 EngineManager 生命周期入口

本刀改 `remove_claude_session`，并新增 `interrupt_claude_sessions`。不改 `engine/commands.rs` / daemon 直调，避免和产品 interrupt 合同缠在一起。

### D3. 仍是 Core owner

`CompatOwner` 只有 `CoreClaude`。flag 仍默认 off。
