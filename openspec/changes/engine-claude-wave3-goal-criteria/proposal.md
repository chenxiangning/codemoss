# Proposal: engine-claude-wave3-goal-criteria

> OpenSpec change id: `engine-claude-wave3-goal-criteria`  
> Wave：3AR（第一根插头 · Wave 3 目标完成条件只盘点）  
> 依赖：`engine-claude-product-boot-default-off`  
> 架构：[`15` §3](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

3AQ 钉死产品启动链默认 off。本目标原文只要三件套：双路径 adapter、默认 off、disable-not-delete；同时禁止 push、删 `engine/claude*`、迁 `note_cards`、开 Marketplace。不先把「已齐 / 禁止 / 不在范围内」写成一张表，下一步会误把产品 disable / slim 当成还没做完的 Wave 3。

## 目标与边界

1. 落下 `docs/architecture/plugin-platform/inventory/claude-wave3-goal-criteria.json`。
2. 对照目标原文逐条标 evidence / out-of-scope。
3. **不修改**任何生产路径。
4. MUST NOT 删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag、不 push。

## Capabilities

- `engine-claude-wave3-goal-criteria-v1`
