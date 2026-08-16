# Proposal: engine-claude-shutdown-facade

> OpenSpec change id: `engine-claude-shutdown-facade`  
> Wave：3K（第一根插头 · shutdown / list 走门面）  
> 依赖：`engine-claude-interrupt-turn-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3J 把 turn interrupt 接到门面。App exit / daemon shutdown / diagnostics list 仍直打 `claude_manager`。全量 unload 绕过门面，双路径无法单独回滚。

## 目标与边界

1. `ClaudeCompatAdapter` MUST 委托 `list_sessions` / `interrupt_all` 到同一份 Core manager。
2. `EngineManager` MUST 提供 `list_claude_sessions` / `interrupt_all_claude_sessions`；flag on 时经门面。
3. GUI exit、daemon shutdown、runtime exit list、diagnostics list MUST 走这些入口。
4. MUST NOT 改 askuser MCP / shared_session_v2 / session_lifecycle。
5. MUST NOT 默认开 flag、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace。

## Capabilities

- `engine-claude-shutdown-facade-v1`
