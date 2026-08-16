# Proposal: engine-claude-history-load-facade

> OpenSpec change id: `engine-claude-history-load-facade`  
> Wave：3T（第一根插头 · history load 走默认 off 门面）  
> 依赖：`engine-claude-history-list-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3S 把 GUI list 接到门面。`load_claude_session` 仍直调 `claude_history::load_claude_session_with_config_window`。不先接 load，后面 hydrate / fork / delete 会各写一套绕过路径。

## 目标与边界

1. `ClaudeCompatAdapter` MUST 委托 `load_history_session` 到同一份 `claude_history::load_claude_session_with_config_window`。
2. `EngineManager` MUST 提供 `load_claude_history_session`，经 `claude_owner()` 分发。
3. GUI `session_history_commands.rs::load_claude_session` MUST 经该入口，MUST NOT 直调 `claude_history::`。
4. MUST NOT 改 history 实现、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-load-facade-v1`
