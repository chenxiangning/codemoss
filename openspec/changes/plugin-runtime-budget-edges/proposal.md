# Proposal: plugin-runtime-budget-edges

> Wave：1AN（插座组装 · 合法 Host 预算边界可构造）  
> 依赖：1N / 1AG / 1AH 非法预算

## Why

1AG / 1AH 已拒 200ms 与 `max_concurrent=0`。组合面尚未独立验收合法边界：`activation_deadline=1000ms` 与 `max_concurrent=1` 必须能构造并 activate。1F 后不得把下限一并误杀。

## 边界

1. `activation_deadline=1000ms` + `max_concurrent=1` 构造 `PluginRuntime` MUST 成功。
2. 该配置下 activate Notes MUST 成功。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-budget-edges-v1`
