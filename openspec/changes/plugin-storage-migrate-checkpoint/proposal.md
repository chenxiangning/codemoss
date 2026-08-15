# Proposal: plugin-storage-migrate-checkpoint

> Wave：2H（插座通电 · 组合面无 checkpoint 不得 migrate）  
> 依赖：2G migrate Ready、2A 内存 migrate 闸门

## Why

2A 已在 `StorageService` 证明无 checkpoint 不得 migrate。组合面 `migrate_own_store` 尚未独立验收。若不先锁住这一刀，1F 后 ready 插件仍可能跳过 checkpoint 改 schema。

## 边界

1. Ready 但未 checkpoint 时 `migrate_own_store` MUST `checkpoint-required`。
2. 不改 2A 纯函数闸门。
3. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-migrate-checkpoint-v1`
