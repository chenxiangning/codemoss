# Proposal: plugin-storage-migrate-from

> Wave：2O（插座通电 · 组合面 migrate from 必须匹配当前 schema）  
> 依赖：2G migrate Ready、2A from 闸门

## Why

2A 已在纯函数面证明 `plan.from != store schema` 不得 migrate。组合面尚未独立验收。1F 后 ready 插件不能拿过期 from 改 schema。

## 边界

1. Ready + checkpoint 但 `from != current schema` MUST `invalid-storage`。
2. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-migrate-from-v1`
