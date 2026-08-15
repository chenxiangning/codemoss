# Proposal: plugin-runtime-duplicate-entries

> Wave：1AU（插座组装 · 重复 required entry 不得激活）  
> 依赖：1AQ 空白 entry

## Why

1AQ 已拒空白 entry。`required_entries=["notes-ui","notes-ui"]` 仍会让 driver start 两次同一 entry。1F 后不得对同一 entry 双重握手。

## 边界

1. required entries 含重复 id MUST `schema`。
2. 不得写入 slot。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-duplicate-entries-v1`
