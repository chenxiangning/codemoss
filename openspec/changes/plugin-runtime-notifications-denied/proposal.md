# Proposal: plugin-runtime-notifications-denied

> Wave：1BB（插座组装 · mossx.notifications.publish 必须拒绝）  
> 依赖：1AD git/network/storage 拒绝、1AE provider 拒绝

## Why

V1 Broker 只开放 `mossx.workspace.read`。catalog 里的 `mossx.notifications.publish` 尚未在组合面独立验收。1F 后不得让插件发通知。

## 边界

1. Ready Notes query `mossx.notifications.publish` MUST `permission-denied`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-notifications-denied-v1`
