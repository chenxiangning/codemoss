# Proposal: plugin-runtime-reverse-dns

> Wave：1BK（插座组装 · Host 拒绝非 reverse-DNS pluginId）  
> 依赖：1BI 路径不安全 pluginId 不得开 namespace、1BE canonical 身份

## Why

1BI 已锁 Storage。Host `activate` 仍接受 `../escape` 并写入 slot。1F 后不得用非 reverse-DNS 身份占 Host 槽。

## 边界

1. `activate` / `dispatch` / `fuse` / `disable` / `reset` 对非 reverse-DNS pluginId MUST `schema`。
2. 不得写入 slot。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-reverse-dns-v1`
