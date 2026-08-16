# Proposal: engine-claude-history-catalog-source-facts-facade

> OpenSpec change id: `engine-claude-history-catalog-source-facts-facade`  
> Wave：3AG（第一根插头 · catalog source facts 走默认 off 门面）  
> 依赖：`engine-claude-history-catalog-list-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3AF 把 catalog attribution list 接到门面。`session_management_catalog_projection.rs` 仍直调 related / workspace-only source facts。这两条路径会绕过已收口的 catalog list 门面。

## 目标与边界

1. `ClaudeCompatAdapter` MUST 委托 related / workspace-only source facts 到同一份 `claude_history::*` 实现。
2. `EngineManager` MUST 提供两条 manager 入口，经 `claude_owner()` 分发。
3. catalog projection MUST 经这两条入口，MUST NOT 直调 `claude_history::list_*source_facts*`。
4. 本刀 MUST NOT 改 catalog delete / native resolve。
5. MUST NOT 改 history 实现、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-catalog-source-facts-facade-v1`
