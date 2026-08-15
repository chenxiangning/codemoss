# Proposal: plugin-storage-fuse-reset-lifecycle

> Wave：2AE（Storage · fuse 后 reset 恢复 checkpoint）  
> 依赖：2R fuse-reset 恢复 access、2S fuse 后不得 checkpoint、2AD disable-reset 恢复 checkpoint

## Why

2R 已恢复 `access_store`。2S 已锁 fuse 的 checkpoint。组合面尚未验收 fuse → reset → activate 后 checkpoint 恢复。

## 边界

1. fuse → reset → activate 后 `checkpoint_own_store` MUST 成功。
2. 不进 boot，不迁 `note_cards`。

## Capabilities

- `plugin-storage-fuse-reset-lifecycle-v1`
