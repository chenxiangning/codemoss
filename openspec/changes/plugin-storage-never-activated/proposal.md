# Proposal: plugin-storage-never-activated

> Wave：2V（插座通电 · 从未激活不得用 Storage API）  
> 依赖：2E–2G Ready 闸门、2L access_store

## Why

Ready 闸门已覆盖 disable / fuse。从未 activate 的 plugin 仍可能被组合面当 ready。1F 后不得凭 pluginId 字符串摸 store。

## 边界

1. 未 activate 时 `open_own_store` / `checkpoint_own_store` / `restore_own_store` / `migrate_own_store` / `access_store` MUST `plugin-unavailable`。
2. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-never-activated-v1`
