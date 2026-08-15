# Proposal: plugin-storage-blank-target

> Wave：1BC（Storage · 空白 target 不得 access_store）  
> 依赖：1AV 空白 pluginId 不得摸 store

## Why

`access_store(caller, target)` 已对空白 caller 返回 `schema`。空白 target 仍走 `caller != target`，伪装成 `permission-denied`。1F 后不得把非法身份误报成跨插件权限拒绝。

## 边界

1. Ready Notes `access_store(self, ""|"   ")` MUST `schema`。
2. 不进 boot，不迁 `note_cards`。

## Capabilities

- `plugin-storage-blank-target-v1`
