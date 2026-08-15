# Proposal: plugin-runtime-blank-entries

> Wave：1AQ（插座组装 · 空白 required entry / 空白身份不得激活）  
> 依赖：1AO 空 pluginId / unitId

## Why

1AO 已拒空 `pluginId` / `unitId`。`required_entries=[""]` 与 `"   "` 身份仍能占槽并让 driver start 空 entry。1F 后不得用空白 entry 握手。

## 边界

1. 任一 required entry 为空或仅空白 MUST `schema`。
2. `plugin_id` / `unit_id` 仅空白 MUST `schema`。
3. 不得写入 slot。
4. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-blank-entries-v1`
