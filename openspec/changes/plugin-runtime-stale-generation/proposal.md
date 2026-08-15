# Proposal: plugin-runtime-stale-generation

> Wave：1M（插座组装 · 旧 generation 失效）  
> 依赖：1L fuse-reset

## Why

reset 后新 generation 已恢复 handle。旧 generation 的 query / open_stream MUST 失败，否则 1F 后旧进程能写新槽。

## 边界

1. fuse → reset → activate 后，旧 generation query / open_stream MUST 失败。
2. 新 generation MUST 成功。
3. 不进 boot。

## Capabilities

- `plugin-runtime-stale-generation-v1`
