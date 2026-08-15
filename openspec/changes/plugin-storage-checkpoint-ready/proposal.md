# Proposal: plugin-storage-checkpoint-ready

> Wave：2E（插座通电 · checkpoint 要求 Ready）  
> 依赖：2D open_own_store Ready 闸门、2B DiskStorage checkpoint

## Why

disable 后已不能 open store。合同还要求 checkpoint 只能由 ready 插件发起。若不先在组合面闸住，disabled 插件仍能直接 `storage.checkpoint`。

## 边界

1. `checkpoint_own_store` 仅 Ready 成功。
2. disable 后 MUST `plugin-unavailable`。
3. 不迁 `note_cards`。

## Capabilities

- `plugin-storage-checkpoint-ready-v1`
