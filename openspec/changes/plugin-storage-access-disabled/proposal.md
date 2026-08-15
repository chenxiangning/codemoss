# Proposal: plugin-storage-access-disabled

> Wave：2P（插座通电 · disabled 插件不得 access_store）  
> 依赖：2L access_store、2D disable 后不得 open store

## Why

2L 已隔离跨插件读。`access_store` 的 Ready 闸门尚未独立验收 disable 后的自己读自己。1F 后 disabled 插件不得再摸 sqlite 路径。

## 边界

1. disable 后 `access_store(self, self)` MUST `plugin-unavailable`。
2. store 文件仍在，不删。
3. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-access-disabled-v1`
