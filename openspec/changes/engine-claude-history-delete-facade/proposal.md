# Proposal: engine-claude-history-delete-facade

> OpenSpec change id: `engine-claude-history-delete-facade`  
> Wave：3W（第一根插头 · history delete 走默认 off 门面）  
> 依赖：`engine-claude-history-fork-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3V 把 GUI fork 接到门面。`delete_claude_session` 仍直调 `claude_history::delete_claude_session_with_config`。写路径不接就会留下绕过。

## 目标与边界

1. `ClaudeCompatAdapter` MUST 委托 `delete_history_session` 到同一份 `claude_history::delete_claude_session_with_config`。
2. `EngineManager` MUST 提供 `delete_claude_history_session`，经 `claude_owner()` 分发。
3. GUI `session_history_commands.rs::delete_claude_session` MUST 经该入口，MUST NOT 直调 `claude_history::`。
4. 本刀 MUST NOT 改 daemon / catalog / rewind `from_message`。
5. MUST NOT 改 history 实现、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-delete-facade-v1`
