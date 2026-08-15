# Proposal: plugin-runtime-quickjs-memory-limit

> Wave：1QJ12（插座本体 · Worker QuickJS 必须有内存上限）  
> 依赖：1QJ5 真实 Runtime、1QJ11 最小上下文  
> 论文对齐：隔离 = 独立上下文；未声明无限预算是未声明依赖，必须 fail closed。

## Why

1QJ5 建了 per-plugin Runtime，但没有 `set_memory_limit`。rquickjs 里 `0` 等于无限。合同默认 Worker 128 MiB，硬上限 256 MiB。没有上限的 isolate 可以吃光 Host。

## 边界

1. Worker Runtime MUST 在 handshake 前设置内存上限。
2. `0`（无限）MUST 拒绝。
3. 默认 MUST 是 128 MiB。超过 256 MiB MUST 拒绝。
4. 超限分配 MUST 失败，isolate 仍可被 Host 停掉。
5. 不切产品。

## Capabilities

- `plugin-runtime-quickjs-memory-limit-v1`
