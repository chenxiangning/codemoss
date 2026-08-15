# Proposal: plugin-storage-disable-isolation

> Wave：1BD（Storage · disable Claude 不得撤 Notes store）  
> 依赖：1AK fuse Claude 不得撤 Notes stream、1I 跨插件 store 拒绝

## Why

1AK 已锁 fuse Claude 不得撤 Notes stream。disable 的 store 隔离尚未独立验收。1F 后拔掉一个插头不得带走另一个插件的 namespace。

## 边界

1. disable Claude 后 Notes 仍可 `open_own_store` / `access_store` / `checkpoint`。
2. Claude 自己的 store 仍 fail-closed。
3. 不进 boot，不迁 `note_cards`。

## Capabilities

- `plugin-storage-disable-isolation-v1`
