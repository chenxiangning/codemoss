# Proposal: plugin-storage-migrate-destructive

> Wave：2I（插座通电 · 组合面未确认 destructive 不得 migrate）  
> 依赖：2H checkpoint 闸门、2A destructive 闸门

## Why

2A 已在纯函数面证明未确认 destructive 不得 migrate。组合面尚未独立验收。1F 后 ready + checkpoint 的插件仍可能静默跑破坏性迁移。

## 边界

1. Ready + checkpoint 但 `destructive && !confirmed` MUST `destructive-unconfirmed`。
2. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-migrate-destructive-v1`
