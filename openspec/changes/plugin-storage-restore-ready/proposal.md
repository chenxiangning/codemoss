# Proposal: plugin-storage-restore-ready

> Wave：2F（插座通电 · restore 要求 Ready）  
> 依赖：2E checkpoint Ready 闸门、2B DiskStorage restore

## Why

checkpoint 已要求 Ready。合同还要求 restore 只能由 ready 插件发起。若不先在组合面闸住，disabled 插件仍能把隔离库滚回旧 schema。

## 边界

1. `restore_own_store` 仅 Ready 成功。
2. disable 后 MUST `plugin-unavailable`。
3. restore 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-restore-ready-v1`
