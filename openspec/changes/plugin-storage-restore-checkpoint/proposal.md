# Proposal: plugin-storage-restore-checkpoint

> Wave：2M（插座通电 · 组合面无 checkpoint 不得 restore）  
> 依赖：2F restore Ready、2H migrate checkpoint 闸门

## Why

2F 已证明 disable 后不得 restore。合同还要求 restore 必须有校验过的 checkpoint。组合面尚未独立验收「Ready 但从未 checkpoint」。

## 边界

1. Ready 且已打开 store，但未 checkpoint 时 `restore_own_store` MUST `checkpoint-required`。
2. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-restore-checkpoint-v1`
