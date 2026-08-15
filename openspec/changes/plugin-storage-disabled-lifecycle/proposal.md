# Proposal: plugin-storage-disabled-lifecycle

> Wave：2Z（Storage · disable 后不得 checkpoint / migrate / restore）  
> 依赖：2P disable 后不得 access_store、2S–2U fuse 后不得 lifecycle

## Why

2P 已锁 `access_store`。fuse 已锁 checkpoint / migrate / restore。disable-not-delete 主路径尚未独立验收这三类 lifecycle API。1F 后被 disable 的插件不得继续改自己的 store。

## 边界

1. `disable_plugin` 后 `checkpoint_own_store` / `migrate_own_store` / `restore_own_store` MUST `plugin-unavailable`。
2. 不进 boot，不 spawn，不迁 `note_cards`。

## Capabilities

- `plugin-storage-disabled-lifecycle-v1`
