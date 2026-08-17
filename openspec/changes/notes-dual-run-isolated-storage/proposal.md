# Proposal: notes-dual-run-isolated-storage

> OpenSpec change id: `notes-dual-run-isolated-storage`  
> Wave：P4.7 批次 22（第二根插头 · flag-on 走隔离 sqlite）  
> 依赖：`notes-storage-sqlite-full-crud`  
> 架构：`15` §3 Dual-run。同一时刻只有一个 owner。

## Why

4H 把 7 条命令接到门面，但 flag on/off 都 delegate 到 `note_cards` 文件。隔离 `NotesNamespace` 已有完整 CRUD，却接不进产品命令。这不是 dual-run。

本刀：`MOSSX_NOTES_COMPAT_FACADE` 打开时，7 条命令走隔离 sqlite（`app_home/plugin-runtime/data/com.mossx.notes/store.sqlite`）。flag 关闭 MUST 仍走 `note_card_*_core` 文件。不迁存量 markdown，不开默认 flag，不 Slim。

## 目标与边界

1. flag on MUST 读写隔离 namespace，MUST NOT 写 `note_card` 目录。
2. flag off MUST 仍是产品文件路径。
3. **MUST NOT** 迁存量，**MUST NOT** 默认开 flag，**MUST NOT** Slim。

## Capabilities

- `notes-dual-run-isolated-storage-v1`
