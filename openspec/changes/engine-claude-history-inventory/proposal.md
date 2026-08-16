# Proposal: engine-claude-history-inventory

> OpenSpec change id: `engine-claude-history-inventory`  
> Wave：3R（第一根插头 · history 只盘点）  
> 依赖：`engine-claude-owner-dispatch`  
> 架构：[`15` §3](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

3Q 把 runtime session 收成单一 owner。history 仍直调 `claude_history::*`，不经门面。不先钉调用面，下一步 dual-run 会漏 catalog / rewind / daemon。

## 目标与边界

1. 落下 `docs/architecture/plugin-platform/inventory/claude-history.json`。
2. 标明产品 command / daemon / session catalog / native continuation 调用面。
3. 标明 stay-in-Core vs 目标迁出 vs 禁止跟随。
4. **不修改**任何 `claude_history*` 生产实现。
5. MUST NOT 删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-inventory-v1`
