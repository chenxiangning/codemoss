# Proposal: plugin-runtime-unknown-lifecycle

> Wave：1AS（插座组装 · 未知 / 空白 pluginId 不得 fuse / disable / reset）  
> 依赖：1AO / 1AQ 空身份

## Why

`Host::fuse` / `disable` / `reset` 对未知 plugin 会 `or_insert` 一个 Idle 槽再改状态。空白 `pluginId` 会污染 slot map。1F 后不得用打错的 id 把一个从未存在的插头熔断成永久 `fused`。

## 边界

1. 空白 `pluginId` 的 fuse / disable / reset MUST `schema`。
2. 从未加载的 pluginId MUST `plugin-unavailable`。
3. 不得写入 slot。
4. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-unknown-lifecycle-v1`
