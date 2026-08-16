# Proposal: engine-claude-history-catalog-list-facade

> OpenSpec change id: `engine-claude-history-catalog-list-facade`  
> Wave：3AF（第一根插头 · catalog attribution list 走默认 off 门面）  
> 依赖：`engine-claude-history-catalog-inventory`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3AE 钉死 catalog 用 attribution scopes，不能硬接到 GUI list。`session_management.rs` 仍直调 `list_claude_sessions_for_attribution_scopes_with_config`。不先接这条，catalog 扫描会绕过门面。

## 目标与边界

1. `ClaudeCompatAdapter` MUST 委托 `list_history_sessions_for_attribution_scopes` 到同一份 `claude_history::list_claude_sessions_for_attribution_scopes_with_config`。
2. `EngineManager` MUST 提供 `list_claude_history_sessions_for_attribution_scopes`，经 `claude_owner()` 分发。
3. `session_management.rs` catalog list MUST 经该入口，MUST NOT 直调 `claude_history::list_claude_sessions_for_attribution_scopes_with_config`。
4. 本刀 MUST NOT 改 source facts / catalog delete / native resolve。
5. MUST NOT 改 history 实现、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-catalog-list-facade-v1`
