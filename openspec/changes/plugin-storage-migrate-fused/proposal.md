# Proposal: plugin-storage-migrate-fused

> Wave：2T（插座通电 · fused 插件不得 migrate）  
> 依赖：2G migrate Ready、1J fuse_plugin

## Why

disable 后已不能 migrate。fuse 是更强的隔离态，组合面尚未独立验收 fused 后改 schema。1F 后 fused 插件不得再推 schema。

## 边界

1. fuse 后 `migrate_own_store` MUST `plugin-unavailable`。
2. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-migrate-fused-v1`
