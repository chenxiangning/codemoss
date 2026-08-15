# Proposal: plugin-storage-restore-fused

> Wave：2U（插座通电 · fused 插件不得 restore）  
> 依赖：2F restore Ready、1J fuse_plugin

## Why

disable 后已不能 restore。fuse 是更强的隔离态，组合面尚未独立验收 fused 后滚回 schema。1F 后 fused 插件不得再改 store 内容。

## 边界

1. fuse 后 `restore_own_store` MUST `plugin-unavailable`。
2. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-restore-fused-v1`
