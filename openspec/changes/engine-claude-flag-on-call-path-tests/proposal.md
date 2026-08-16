# Proposal: engine-claude-flag-on-call-path-tests

> OpenSpec change id: `engine-claude-flag-on-call-path-tests`  
> Wave：3AP（第一根插头 · flag-on 只证明调用路径）  
> 依赖：`engine-claude-conformance-gap-inventory`  
> 架构：[`15` §3 step 5](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

3AO 标明 interrupt 只是调用面。现有 flag-on 测只覆盖 session get/remove。history 门面缺少「flag on 与 flag off 落到同一实现」的单测。不先补这条，下一步会把产品默认打开。

## 目标与边界

1. `EngineManager::new_with_claude_compat(true)` MUST 证明 history handle 走门面。
2. `EngineManager::new()` MUST 仍默认 off。
3. flag on / flag off 的 history list 在无 Claude home 时 MUST 返回同一错误。
4. MUST NOT 默认打开 `MOSSX_CLAUDE_COMPAT_FACADE`。
5. MUST NOT 删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace。

## Capabilities

- `engine-claude-flag-on-call-path-tests-v1`
