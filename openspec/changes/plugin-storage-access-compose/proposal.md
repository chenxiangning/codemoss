# Proposal: plugin-storage-access-compose

> Wave：2L（插座通电 · 组合面跨插件 store 隔离）  
> 依赖：1I 双插头隔离、2C Storage caller 闸门

## Why

1I 仍直调 `DiskStorage::access_file`。组合面没有正式 API，1F 后调用方可能绕过 Ready 闸门去读别人的 sqlite。

## 边界

1. `access_store(caller, target)` 先要求 caller Ready，再走既有 caller==target 闸门。
2. Claude 读 Notes store MUST `permission-denied`。
3. 自己读自己 MUST 成功。
4. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-access-compose-v1`
