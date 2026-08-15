# Proposal: plugin-storage-migrate-export

> Wave：2J（插座通电 · 组合面未 export 不得 migrate）  
> 依赖：2I destructive 闸门、2A export-required 闸门

## Why

2A 已在纯函数面证明 `export_required && !exported` 不得 migrate。组合面尚未独立验收。用户可见数据迁移不能在 1F 后被 ready 插件静默跳过。

## 边界

1. Ready + checkpoint 但 `export_required && !exported` MUST `export-required`。
2. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-migrate-export-v1`
