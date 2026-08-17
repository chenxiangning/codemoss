# Proposal: notes-storage-rollback-rows

> OpenSpec change id: `notes-storage-rollback-rows`  
> Wave：P4.7 批次 23（第二根插头 · 隔离 rollback）  
> 依赖：`notes-dual-run-isolated-storage`  
> 架构：`15` §3 step 6 rollback。4I 要求 checkpoint 后 restore 回到上一快照。

## Why

现有 `notes_restore_returns_checkpoint_schema` 只验 schema 数字。隔离 CRUD 改的是 `notes` 行。若 restore 只回 schema、不回行，rollback 是假的。

本刀把 checkpoint / restore 接到 `NotesNamespace`，并钉：create → checkpoint → delete/update → restore 后原 note 行必须回来。不迁存量、不接产品默认路径、不开 flag、不 Slim。

## 目标与边界

1. `NotesNamespace` MUST 暴露 `checkpoint` / `restore`。
2. restore MUST 恢复 `notes` 行，不只是 schema。
3. 路径 MUST 仍是隔离 sqlite。**MUST NOT** 迁存量，**MUST NOT** Slim。

## Capabilities

- `notes-storage-rollback-rows-v1`
