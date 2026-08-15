# Proposal: plugin-storage-access-reset

> Wave：2R（插座通电 · fuse 后 reset 恢复 access_store）  
> 依赖：2Q fuse 后不得 access、1L fuse-reset

## Why

1L 已恢复 query / store / stream。`access_store` 尚未独立验收。reset 后新 generation 必须能再读自己的 sqlite，否则 1F 后 fused 插件会永久失明。

## 边界

1. fuse → reset → activate 后 `access_store(self, self)` MUST 成功。
2. 路径必须等于 reset 前打开的 store。
3. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-access-reset-v1`
