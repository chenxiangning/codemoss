# Proposal: plugin-runtime-never-activated-handles

> Wave：1Q（插座组装 · 从未激活不得 query / stream）  
> 依赖：2V 从未 activate 不得用 store、1P Host off 不得 query / stream

## Why

2V 已锁 store。query / open_stream 尚未独立验收「Host enabled 但从未 activate」。1F 后不得凭 pluginId + generation 猜读 workspace 或开 DataPlane。

## 边界

1. Host enabled 但从未 activate 时，`query_read` / `open_stream` MUST `plugin-unavailable`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-never-activated-handles-v1`
