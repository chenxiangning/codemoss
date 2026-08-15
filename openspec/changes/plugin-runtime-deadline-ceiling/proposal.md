# Proposal: plugin-runtime-deadline-ceiling

> Wave：1AP（插座组装 · activation deadline 上限 30000ms 合法）  
> 依赖：1N 拒 31_000、1AN 合法下限

## Why

1N 已拒 31_000ms。1AN 已验收 1000ms 下限。组合面尚未独立验收合法上限 30000ms。1F 后不得把硬上限一并误杀。

## 边界

1. `activation_deadline=30000ms` 构造 `PluginRuntime` MUST 成功，且 activate MUST 成功。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-deadline-ceiling-v1`
