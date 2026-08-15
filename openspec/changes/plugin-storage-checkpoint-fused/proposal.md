# Proposal: plugin-storage-checkpoint-fused

> Wave：2S（插座通电 · fused 插件不得 checkpoint）  
> 依赖：2E checkpoint Ready、1J fuse_plugin

## Why

disable 后已不能 checkpoint。fuse 是更强的隔离态，组合面尚未独立验收 fused 后打 checkpoint。1F 后 fused 插件不得再改 schema 快照。

## 边界

1. fuse 后 `checkpoint_own_store` MUST `plugin-unavailable`。
2. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-checkpoint-fused-v1`
