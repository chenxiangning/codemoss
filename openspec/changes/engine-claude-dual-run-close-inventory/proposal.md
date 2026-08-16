# Proposal: engine-claude-dual-run-close-inventory

> OpenSpec change id: `engine-claude-dual-run-close-inventory`  
> Wave：3AN（第一根插头 · dual-run 收口只盘点）  
> 依赖：`engine-claude-disable-not-delete-inventory`  
> 架构：[`15` §3](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

3AM 钉死：Host fixture 能 disable，产品 Claude 仍是唯一 runtime owner。插头协议 1–5 与 fixture 级 7 已有证据，但还没有一张总表区分「dual-run 已齐」和「产品 disable / slim 仍禁止」。不先钉这张表，下一步会误开 flag 或删 `engine/claude*`。

## 目标与边界

1. 落下 `docs/architecture/plugin-platform/inventory/claude-dual-run-close.json`。
2. 对照插头协议 1–9：标明已齐 / 仅 fixture / 本程序禁止。
3. **不修改**任何生产路径、flag 默认值、boot。
4. MUST NOT 删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-dual-run-close-inventory-v1`
