# Proposal: engine-claude-conformance-gap-inventory

> OpenSpec change id: `engine-claude-conformance-gap-inventory`  
> Wave：3AO（第一根插头 · dual-run conformance 缺口只盘点）  
> 依赖：`engine-claude-dual-run-close-inventory`  
> 架构：[`15` §3 step 6](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

3AN 标明 conformance 只是部分。插头协议第 6 步要求 stream / interrupt / storage / rollback / first-interactive。现在 interrupt 调用面已走门面，但没有产品级 stream / rollback / first-interactive 验收。不先钉缺口，下一步会误把 dual-run 当成已 conformance。

## 目标与边界

1. 落下 `docs/architecture/plugin-platform/inventory/claude-conformance-gaps.json`。
2. 标明 interrupt 调用面已齐；stream / rollback / first-interactive 仍缺产品验收。
3. **不修改**任何生产路径，不补产品 conformance 测。
4. MUST NOT 删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-conformance-gap-inventory-v1`
