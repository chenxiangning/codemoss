# Proposal: engine-claude-history-hydrate-facade

> OpenSpec change id: `engine-claude-history-hydrate-facade`  
> Wave：3U（第一根插头 · history hydrate 走默认 off 门面）  
> 依赖：`engine-claude-history-load-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3T 把 GUI load 接到门面。`hydrate_claude_deferred_image` 仍直调 `claude_history::hydrate_claude_deferred_image_with_config`。这是 load 的配套读路径，不接就会留下绕过。

## 目标与边界

1. `ClaudeCompatAdapter` MUST 委托 `hydrate_history_image` 到同一份 `claude_history::hydrate_claude_deferred_image_with_config`。
2. `EngineManager` MUST 提供 `hydrate_claude_history_image`，经 `claude_owner()` 分发。
3. GUI `session_history_commands.rs::hydrate_claude_deferred_image` MUST 经该入口，MUST NOT 直调 `claude_history::`。
4. MUST NOT 改 history 实现、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-hydrate-facade-v1`
