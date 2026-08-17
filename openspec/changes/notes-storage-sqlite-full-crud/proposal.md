# Proposal: notes-storage-sqlite-full-crud

> OpenSpec change id: `notes-storage-sqlite-full-crud`  
> Wave：P4.7 批次 21 / 4J 第 2 步（第二根插头 · 隔离 CRUD）  
> 依赖：`notes-storage-sqlite-crud`、`notes-plugin-owner-refresh`  
> 架构：`15` §3 step 6 storage。隔离 namespace ≠ 产品库。

## Why

4J 第 1 步只做了 `create` + `count`。4I 口径要求 get/list/update/archive/restore/delete 全部命中隔离 sqlite，且不触碰产品 markdown。产品命令仍走 `note_cards`。本刀只把隔离 `NotesNamespace` 补全，证明新路径可独立读写。

不迁存量、不接 7 条命令、不开 flag、不 Slim。

## 目标与边界

1. `NotesNamespace` MUST 提供 get / list / update / archive / restore / delete。
2. 路径 MUST 仍是 `plugin-runtime/data/com.mossx.notes/store.sqlite`。
3. **MUST NOT** 改 `note_card_*` 默认路径，**MUST NOT** 迁表，**MUST NOT** Slim。

## Capabilities

- `notes-storage-sqlite-full-crud-v1`
