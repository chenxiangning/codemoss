# Proposal: plugin-storage-migrate-quarantine

> Wave：2K（插座通电 · 组合面旧 reader 不得打开新 schema）  
> 依赖：2J export 闸门、2A quarantine 闸门

## Why

2A 已在纯函数面证明 `reader_schema < store schema` 必须 quarantine。组合面尚未独立验收。1F 后旧插件进程不得静默打开已升级的 store。

## 边界

1. Ready + checkpoint 但 `reader_schema < current schema` MUST `quarantine`。
2. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-migrate-quarantine-v1`
