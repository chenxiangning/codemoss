# Proposal: notes-storage-sqlite-crud

> OpenSpec change id: `notes-storage-sqlite-crud`  
> Wave：4J（第二根插头 · 迁表安全片段第 1 步）  
> 依赖：`notes-conformance-storage-cutover`（4I design-only）  
> 架构：[`15` §3 step 6 Conformance](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

4I 落盘了迁表设计 + conformance 口径 + 回退策略，但「新路径」仍是纸面设计。4J 的目标是让 flag on 真正切到插件运行时的隔离 sqlite namespace，但完整迁表（存量 markdown → sqlite）触碰用户数据，是高风险动作。

本刀只做 4J 的**安全片段第 1 步**：在 `notes_storage.rs` 上实现 `notes` 表 schema + `NotesNamespace` 的 create/count CRUD，证明隔离 sqlite namespace 可真实写入与读取，且**零数据风险**（不迁移存量、不接 7 条命令、不改默认 off 路径）。

## 目标与边界

1. `notes_storage.rs` 增加 `NotesNamespace`：`open` 建表 + `create_note`（INSERT 全字段，attachments/source JSON 序列化）+ `count_notes`（SELECT COUNT）。
2. 表 schema 按 4I design 的 11 字段映射；附件二进制仍走文件（本刀不入库）。
3. **MUST NOT** 迁移存量 markdown、MUST NOT 接 7 条 `note_card_*` 命令、MUST NOT 改默认（off）路径、MUST NOT 删 `note_cards.rs` / feature。
4. list/get/update/archive/restore/delete 的完整 CRUD 是后续（4J 第 2 步），本刀只 create + count。

## Capabilities

- `notes-storage-sqlite-crud-v1`
