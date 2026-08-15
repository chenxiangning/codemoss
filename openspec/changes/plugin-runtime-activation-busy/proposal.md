# Proposal: plugin-runtime-activation-busy

> Wave：1X（插座组装 · 组合面并发激活上限）  
> 依赖：1N 非法预算、1B Host `max_concurrent`

## Why

Host 已在 `inflight >= max_concurrent` 时返回 `activation-busy`。组合面尚未独立验收。1F 后不得在上限已满时再塞第三条激活。

## 边界

1. `max_concurrent=2` 且 inflight 已满时，`activate` MUST `activation-busy`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-activation-busy-v1`
