# Proposal: notes-plugin-owner-refresh

> OpenSpec change id: `notes-plugin-owner-refresh`  
> Wave：P4.7 批次 19 / Wave 4A 复核（第二根插头 · owner 事实刷新）  
> 依赖：Claude Process Entry 已走到 dual-run；Notes 不得抢先迁表  
> 架构：`15` §3 Inventory。产品默认仍 Core。

## Why

4A `notes-pilot` 仍写「Wave 2 DiskStorage stays unused by Notes」。事实已变：4D 有隔离 `NotesNamespace`，4E 有 default-off 门面，产品 `note_cards` 七条命令仍是唯一 owner。若不刷新，后续会把隔离 sqlite 误当成生产库。

本刀只刷新 inventory + 钉 dual-run 测试：两旗默认关，`command_registry` 仍绑 `note_cards`，`notes_storage` 不得含产品路径。不迁表、不双写、不 Slim。

## 目标与边界

1. Notes inventory MUST 记录：产品 owner = `note_cards`；隔离 namespace ≠ 生产库。
2. `MOSSX_NOTES_COMPAT_FACADE` 与 `MOSSX_CLAUDE_PROCESS_ENTRY` MUST 默认关。
3. **MUST NOT** 迁 `note_cards` 表，**MUST NOT** 默认开 flag，**MUST NOT** Slim。

## Capabilities

- `notes-plugin-owner-refresh-v1`
