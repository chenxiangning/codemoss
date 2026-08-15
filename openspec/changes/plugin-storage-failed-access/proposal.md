# Proposal: plugin-storage-failed-access

> Wave：2AB（Storage · Failed 后不得 access_store）  
> 依赖：2P disable 后不得 access、2Q fuse 后不得 access、2AA Failed lifecycle

## Why

2P / 2Q 已锁 disable / fuse 的 `access_store`。Failed 尚未独立验收。1F 后半激活失败的插件不得继续摸 store 路径。

## 边界

1. timeout 进入 Failed 后，`access_store(self, self)` MUST `plugin-unavailable`。
2. 不进 boot，不迁 `note_cards`。

## Capabilities

- `plugin-storage-failed-access-v1`
