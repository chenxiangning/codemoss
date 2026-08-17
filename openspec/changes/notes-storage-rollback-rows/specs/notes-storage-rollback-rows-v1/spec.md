# notes-storage-rollback-rows-v1 Spec Delta

## ADDED Requirements

### Requirement: Isolated NotesNamespace MUST restore note rows from checkpoint

`NotesNamespace` MUST 提供 `checkpoint` 与 `restore`。create 一条 note 并 checkpoint 后，若随后 delete 或 update，restore MUST 把该 note 行恢复到 checkpoint 时的内容。路径 MUST 含 `plugin-runtime/data/com.mossx.notes/store.sqlite`，MUST NOT 含产品 `note_card` 目录。本刀 MUST NOT 迁存量 markdown，MUST NOT 默认开 `MOSSX_NOTES_COMPAT_FACADE`。

#### Scenario: restore brings back a deleted isolated note

- **WHEN** 在注入根 create `n-rb`、checkpoint、再 delete
- **THEN** restore 后 `get(n-rb)` MUST 返回原 title
- **AND** 数据路径 MUST NOT 含 `note_card`

#### Scenario: product commands stay on Core files

- **WHEN** 读取 `command_registry.rs`
- **THEN** 七条 `note_card_*` MUST 仍指向 `crate::note_cards`
