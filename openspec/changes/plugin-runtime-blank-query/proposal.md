# Proposal: plugin-runtime-blank-query

> Wave：1AW（插座组装 · 空白 pluginId 不得 query / open_stream）  
> 依赖：1AV 空白 store 身份、1AS 空白 lifecycle

## Why

activate / fuse / disable / reset / store 已对空白 pluginId 返回 `schema`。`dispatch` / `query` / `open_stream` 仍把空白 id 当成未加载插件，返回 `plugin-unavailable`。1F 后不得用空白身份发 MXPC。

## 边界

1. 空白 `pluginId` 的 `query` / `open_stream` MUST `schema`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-blank-query-v1`
