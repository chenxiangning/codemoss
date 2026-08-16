# Proposal: engine-claude-history-catalog-inventory

> OpenSpec change id: `engine-claude-history-catalog-inventory`  
> Wave：3AE（第一根插头 · catalog history 只盘点）  
> 依赖：`engine-claude-history-daemon-delete-facade`  
> 架构：[`15` §3](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

3AD 把 GUI / daemon history 主路径接到门面。catalog 仍直调 `claude_history::*`，而且用的是 attribution / source-fact API，不是 GUI 那套 list/load。不先钉调用面，下一步 dual-run 会漏 catalog delete 和 native continuation。

## 目标与边界

1. 落下 `docs/architecture/plugin-platform/inventory/claude-history-catalog.json`。
2. 标明 catalog list / source facts / catalog delete / native resolve。
3. **不修改**任何 catalog / native continuation 生产实现。
4. MUST NOT 删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-catalog-inventory-v1`
