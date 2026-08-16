# Proposal: engine-claude-history-catalog-delete-facade

> OpenSpec change id: `engine-claude-history-catalog-delete-facade`  
> Wave：3AH（第一根插头 · catalog delete 走默认 off 门面）  
> 依赖：`engine-claude-history-catalog-source-facts-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3AG 把 catalog source facts 接到门面。`session_management.rs` catalog delete 仍在 `tokio::spawn` 里直调 `claude_history::delete_claude_session_with_config`。远程 / 批量删除会绕过已收口的 GUI / daemon delete 门面。

## 目标与边界

1. catalog delete MUST 经 `EngineManager` 发出的可拥有 history handle，再调同一份 `delete_claude_session_with_config`。
2. MUST NOT 在 `session_management.rs` 直调 `claude_history::delete_claude_session_with_config`。
3. 本刀 MUST NOT 改 native resolve。
4. MUST NOT 改 history 实现、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-catalog-delete-facade-v1`
