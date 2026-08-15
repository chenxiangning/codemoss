# Proposal: plugin-runtime-deadline-floor

> Wave：1AG（插座组装 · activation deadline 不得低于 1000ms）  
> 依赖：1N 非法 Host 预算

## Why

合同：Activation deadline 最小 1_000ms、默认 10_000、硬上限 30_000。1N 已拒 31_000。组合面尚未独立验收下限。1F 后不得用 0ms / 200ms deadline 让 required entry 永远来不及握手。

## 边界

1. `activation_deadline < 1000ms` 构造 `PluginRuntime` MUST `invalid-budget`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-deadline-floor-v1`
