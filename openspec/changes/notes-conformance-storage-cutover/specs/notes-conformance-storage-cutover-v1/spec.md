# notes-conformance-storage-cutover-v1 Spec Delta

## ADDED Requirements

### Requirement: The cutover design MUST map WorkspaceNoteCard to a sqlite namespace

迁表设计 MUST 把 `WorkspaceNoteCard` 的 11 个字段映射到 sqlite `notes` 表，附件元数据序列化为 JSON 列、附件二进制仍走文件且指向运行时 data 目录。MUST NOT 读产品 `note_cards` 目录。

#### Scenario: every note field has a sqlite column

- **WHEN** 检查迁表设计
- **THEN** `notes` 表 MUST 覆盖 id / workspace_id / workspace_name / workspace_path / project_name / title / body_markdown / plain_text_excerpt / attachments / source / created_at / updated_at / archived_at

### Requirement: storage conformance MUST be defined before any cutover

conformance 验收口径 MUST 覆盖 storage / rollback / first-interactive 三类 scenario，且 MUST NOT 在隔离 namespace 真实跑通前允许 step 7 disable。

#### Scenario: flag-on storage hits the isolated namespace only

- **WHEN** flag on 且 create/list/get/update/archive/restore/delete 命中 sqlite
- **THEN** 全部 MUST 只读写 `plugin-runtime/data/com.mossx.notes/store.sqlite`，MUST NOT 触碰产品 markdown 文件

#### Scenario: rollback restores the previous checkpoint schema

- **WHEN** checkpoint 后 migrate schema 再 restore
- **THEN** schema MUST 回到上一 checkpoint 值

### Requirement: the cutover MUST stay design-only

本刀 MUST NOT 实施迁表、写存量文件、改 7 条命令默认（off）路径、开 flag、删 `note_cards.rs` / `noteCards.ts` / feature。

#### Scenario: no user data is touched

- **WHEN** 检查本刀改动
- **THEN** 不得写入 `note_cards` 存量目录、不得改动 `note_cards.rs` 命令默认路径
- **AND** `note_cards.rs` / `noteCards.ts` / `src/features/note-cards/**` MUST 仍存在
