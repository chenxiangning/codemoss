# Proposal: engine-claude-product-boot-default-off

> OpenSpec change id: `engine-claude-product-boot-default-off`  
> Wave：3AQ（第一根插头 · 产品启动链默认 off 只盘点）  
> 依赖：`engine-claude-flag-on-call-path-tests`  
> 架构：[`15` §3 step 5](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

3AP 证明注入 `true` 时 history 走门面。产品启动链仍必须走 `EngineManager::new()`，读 env，默认 off。不先钉这条，下一步会把测试注入当成产品默认。

## 目标与边界

1. 落下 `docs/architecture/plugin-platform/inventory/claude-product-boot-default-off.json`。
2. 标明 GUI `state.rs` 与 daemon 都调用 `EngineManager::new()`。
3. `new()` MUST 读 `claude_compat_facade_enabled()`，未设 env MUST 为 false。
4. **不修改**任何生产启动链。
5. MUST NOT 删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-product-boot-default-off-v1`
