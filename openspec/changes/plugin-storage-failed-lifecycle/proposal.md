# Proposal: plugin-storage-failed-lifecycle

> Wave：2AA（Storage · Failed 后不得 checkpoint / migrate / restore）  
> 依赖：1T Failed 不得拿 handle、2Z disable 后不得 lifecycle

## Why

2S–2U / 2Z 已锁 fuse / disable 的 store lifecycle。Failed 只锁了 query / stream / open_own_store。1F 后半激活失败的插件不得继续改自己的 store。

## 边界

1. timeout 进入 Failed 后，`checkpoint_own_store` / `migrate_own_store` / `restore_own_store` MUST `plugin-unavailable`。
2. 不进 boot，不 spawn，不迁 `note_cards`。

## Capabilities

- `plugin-storage-failed-lifecycle-v1`
