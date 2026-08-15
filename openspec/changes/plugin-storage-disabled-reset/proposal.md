# Proposal: plugin-storage-disabled-reset

> Wave：2AD（Storage · disable 后 reset 恢复 store lifecycle）  
> 依赖：2Y disable 后 reset 恢复 handle、2Z disable 后不得 lifecycle

## Why

2Y 已恢复 query / stream / open_own_store。2Z 已锁 disable 的 checkpoint / migrate / restore。组合面尚未验收 disable → reset → activate 后 checkpoint 恢复。

## 边界

1. disable → reset → activate 后 `checkpoint_own_store` MUST 成功。
2. 不进 boot，不迁 `note_cards`。

## Capabilities

- `plugin-storage-disabled-reset-v1`
