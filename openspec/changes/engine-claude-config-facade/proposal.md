# Proposal: engine-claude-config-facade

> OpenSpec change id: `engine-claude-config-facade`  
> Wave：3O（第一根插头 · config 走门面，收口 pub 字段）  
> 依赖：`engine-claude-askuser-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3N 把 AskUser MCP 接到门面。`set_engine_config` 仍直打 `claude_manager.set_config`，且 `EngineManager.claude_manager` 仍是 pub。产品模块随时能绕过门面。

## 目标与边界

1. `ClaudeCompatAdapter` MUST 委托 `set_config` 到同一份 Core manager。
2. `EngineManager::set_engine_config` 的 Claude 分支 MUST 经门面或 Core 入口，MUST NOT 在产品模块直打字段。
3. `EngineManager.claude_manager` MUST 不再是 `pub`。
4. 产品源码（`lib.rs` / `state.rs` / `commands.rs` / daemon / runtime / shared_session_v2 / codex）MUST NOT 再出现 `.claude_manager`。
5. MUST NOT 默认开 flag、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace。

## Capabilities

- `engine-claude-config-facade-v1`
