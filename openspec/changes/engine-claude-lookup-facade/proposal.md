# Proposal: engine-claude-lookup-facade

> OpenSpec change id: `engine-claude-lookup-facade`  
> Wave：3L（第一根插头 · 剩余 lookup 走门面）  
> 依赖：`engine-claude-shutdown-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3K 把 shutdown / list 接到门面。`shared_session_v2`、`session_lifecycle`、换 bin 时的 session list 仍直打 `claude_manager`。lookup 绕过门面，双路径无法单独回滚。

## 目标与边界

1. `ClaudeCompatAdapter` MUST 委托 `sessions_for_workspace` / `runtime_sessions_for_workspace` / `remove_runtime_session`。
2. `EngineManager` MUST 提供对应入口；flag on 时经门面。
3. `shared_session_v2` 的 Claude lookup、`session_lifecycle` stop、换 bin 时的 list MUST 走这些入口。
4. MUST NOT 改 askuser MCP、Codex 旁路 `respond_to_*`、daemon `respond_to_server_request`。
5. MUST NOT 默认开 flag、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace。

## Capabilities

- `engine-claude-lookup-facade-v1`
