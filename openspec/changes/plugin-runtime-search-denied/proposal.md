# Proposal: plugin-runtime-search-denied

> Wave：1BF（插座组装 · mossx.search.provider 必须拒绝）  
> 依赖：1AE provider 拒绝、1BB notifications 拒绝

## Why

V1 Broker 只开放 `mossx.workspace.read`。catalog 里的 `mossx.search.provider` 尚未在组合面独立验收。1F 后不得让插件注册搜索提供者。

## 边界

1. Ready Notes query `mossx.search.provider` MUST `permission-denied`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-search-denied-v1`
