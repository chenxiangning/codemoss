# notes-storage-sqlite-full-crud-v1 Spec Delta

## ADDED Requirements

### Requirement: Isolated NotesNamespace MUST support full CRUD without touching product files

隔离 `NotesNamespace` MUST 在注入根的 sqlite 上支持 get / list / update / archive / restore / delete。路径 MUST 包含 `plugin-runtime/data/com.mossx.notes/store.sqlite`，MUST NOT 包含产品 `note_cards` 目录。产品 `command_registry` MUST 仍绑 `note_cards`。`MOSSX_NOTES_COMPAT_FACADE` MUST 默认关。本刀 MUST NOT 迁存量 markdown。

#### Scenario: isolated note can be updated archived restored and deleted

- **WHEN** 在注入根 create 一条 note
- **THEN** get MUST 读回同 id
- **AND** update MUST 改 title
- **AND** archive 后 list(archived=true) MUST 含该 id
- **AND** restore 后 archived_at MUST 为空
- **AND** delete 后 get MUST 为 None

#### Scenario: product commands stay on Core files

- **WHEN** 读取 `command_registry.rs`
- **THEN** 七条 `note_card_*` MUST 仍指向 `crate::note_cards`
