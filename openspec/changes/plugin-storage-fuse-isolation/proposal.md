# Proposal: plugin-storage-fuse-isolation

> Wave：1BJ（Storage · fuse Claude 不得撤 Notes store）  
> 依赖：1BD disable Claude 不得撤 Notes store、1AK fuse Claude 不得撤 Notes stream

## Why

1AK / 1BD 已锁 fuse stream 与 disable store 隔离。fuse Claude 的 store 隔离尚未独立验收。1F 后熔断一个插头不得带走另一个插件的 namespace。

## 边界

1. fuse Claude 后 Notes 仍可 `access_store` / `checkpoint`。
2. Claude 自己的 store 仍 fail-closed。
3. 不进 boot，不迁 `note_cards`。

## Capabilities

- `plugin-storage-fuse-isolation-v1`
