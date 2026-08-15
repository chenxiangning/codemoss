# Proposal: plugin-storage-access-fused

> Wave：2Q（插座通电 · fused 插件不得 access_store）  
> 依赖：2P disable 后不得 access、1J fuse_plugin

## Why

disable 后已不能 access。fuse 是更强的隔离态，组合面尚未独立验收 fused 后读自己的 store。1F 后 fused 插件不得再摸 sqlite 路径。

## 边界

1. fuse 后 `access_store(self, self)` MUST `plugin-unavailable`。
2. store 文件仍在，不删。
3. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-access-fused-v1`
