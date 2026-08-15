# Proposal: plugin-runtime-host-off-handles

> Wave：1P（插座组装 · Host 默认 off 不得 query / stream）  
> 依赖：1H 默认 off、2W store API 默认 off

## Why

2W 已锁 store。query / open_stream 尚未独立验收「Host.enabled=false」。1F 后不得在插座关着时发 Broker 读或开 DataPlane。

## 边界

1. 默认 Host 下 `query_read` / `open_stream` MUST `plugin-unavailable`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-host-off-handles-v1`
