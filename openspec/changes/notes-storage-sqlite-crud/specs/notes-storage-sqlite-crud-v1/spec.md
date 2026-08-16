# notes-storage-sqlite-crud-v1 Spec Delta

## ADDED Requirements

### Requirement: NotesNamespace MUST create and write to an isolated notes table

`NotesNamespace::open` MUST 在 `plugin-runtime/data/com.mossx.notes/store.sqlite` 上建 `notes` 表（11 字段），`create_note` MUST INSERT 全字段且 attachments/source 序列化为 JSON，`count_notes` MUST 按 workspace_id 计数。MUST NOT 读产品 `note_cards` 目录。

#### Scenario: create then count hits the isolated namespace

- **WHEN** `NotesNamespace::open(root)` 后 `create_note` 一条 note
- **THEN** `count_notes(workspace_id)` MUST 返回 1
- **AND** 数据文件路径 MUST 含 `plugin-runtime/data/com.mossx.notes/store.sqlite` 且 MUST NOT 含 `note_cards`

### Requirement: the CRUD fragment MUST stay zero-risk

本刀 MUST NOT 迁移存量 markdown、MUST NOT 接 7 条 `note_card_*` 命令、MUST NOT 改默认（off）路径、MUST NOT 删 `note_cards.rs` / `noteCards.ts` / feature。

#### Scenario: no cutover and no Core deletion

- **WHEN** 检查本刀改动
- **THEN** `note_cards.rs` 与 `src/features/note-cards/**` MUST 仍存在
- **AND** 7 条命令默认路径 MUST 保持不变（flag 默认 off）
