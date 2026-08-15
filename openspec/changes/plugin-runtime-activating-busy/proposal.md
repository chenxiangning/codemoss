# Proposal: plugin-runtime-activating-busy

> Wave：1AL（插座组装 · Activating 态组合面 fail-closed）  
> 依赖：1X 并发满员、Host `activation-busy`

## Why

Host 已对 `Activating` 拒绝再次 activate / reset。组合面尚未独立验收：半激活槽位不得 query / stream / store，也不得 reset 换 generation。1F 后 required entry 握手期间不得提前发 MXPC / 改 store。

## 边界

1. slot 为 `Activating` 时，`activate` / `reset_plugin` MUST `activation-busy`。
2. 同期 `query` / `open_stream` / `open_own_store` MUST `plugin-unavailable`。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-activating-busy-v1`
