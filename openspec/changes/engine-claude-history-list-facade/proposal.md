# Proposal: engine-claude-history-list-facade

> OpenSpec change id: `engine-claude-history-list-facade`  
> Wave：3S（第一根插头 · history list 走默认 off 门面）  
> 依赖：`engine-claude-history-inventory`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3R 钉死 history 调用面。GUI `list_claude_sessions` 仍直调 `claude_history::*`，不经门面。不先接 list，后面 load / fork / delete 会各写一套绕过路径。

## 目标与边界

1. `ClaudeCompatAdapter` MUST 委托 `list_history_sessions` 到同一份 `claude_history::list_claude_sessions_with_config`。
2. `EngineManager` MUST 提供 `list_claude_history_sessions`，经 `claude_owner()` 分发。
3. GUI `session_history_commands.rs::list_claude_sessions` MUST 经该入口，MUST NOT 直调 `claude_history::`。
4. MUST NOT 改 history 实现、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-list-facade-v1`
