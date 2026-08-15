# Proposal: plugin-runtime-concurrent-floor

> Wave：1AH（插座组装 · max_concurrent 不得为 0）  
> 依赖：1N 非法预算、1X 并发满员

## Why

合同：Concurrent activation 最小 1、默认 2、硬上限 4（实现当前硬上限 2）。1N 已拒 3。组合面尚未独立验收 0。1F 后不得用 0 把 Host 锁死成永远不能 activate。

## 边界

1. `max_concurrent=0` 构造 `PluginRuntime` MUST `invalid-budget`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-concurrent-floor-v1`
