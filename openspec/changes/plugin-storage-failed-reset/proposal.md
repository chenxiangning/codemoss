# Proposal: plugin-storage-failed-reset

> Wave：2AC（Storage · Failed 后 reset 恢复 store API）  
> 依赖：2AA / 2AB Failed store 闸门、1V Failed 后 reset 恢复 handle、2R fuse-reset 恢复 access

## Why

1V 已恢复 query / stream / open_own_store。2AA / 2AB 已锁 Failed 的 lifecycle / access。组合面尚未验收 Failed → reset → activate 后 `access_store` / `checkpoint_own_store` 恢复。

## 边界

1. timeout → reset → activate 后 `access_store` 与 `checkpoint_own_store` MUST 成功。
2. 不进 boot，不迁 `note_cards`。

## Capabilities

- `plugin-storage-failed-reset-v1`
