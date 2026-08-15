# Proposal: plugin-runtime-blank-capability

> Wave：1BA（插座组装 · 空白 capability 不得 query）  
> 依赖：1AW 空白 pluginId、1S 未知 capability

## Why

空白 `pluginId` 已返回 `schema`。Broker 仍把 `""` / `"   "` 当未知 capability，返回 `permission-denied`。1F 后不得把非法身份误报成权限拒绝。

## 边界

1. 空白 capability 的 `query` MUST `schema`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-blank-capability-v1`
