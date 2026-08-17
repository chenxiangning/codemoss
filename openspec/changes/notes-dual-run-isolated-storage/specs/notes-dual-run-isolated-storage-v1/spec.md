# notes-dual-run-isolated-storage-v1 Spec Delta

## ADDED Requirements

### Requirement: Flag-on Notes MUST use the isolated sqlite namespace

`MOSSX_NOTES_COMPAT_FACADE` 打开时，7 条 `note_card_*` MUST 经 `NotesCompatAdapter` 读写隔离 `NotesNamespace`，MUST NOT 调用 `note_card_*_core`。flag 关闭时 MUST 仍走 `note_card_*_core`。隔离路径 MUST 含 `plugin-runtime/data/com.mossx.notes/store.sqlite`，MUST NOT 含产品 `note_card` 目录。本刀 MUST NOT 迁存量 markdown，MUST NOT 默认开 flag。

#### Scenario: isolated adapter writes only the plugin namespace

- **WHEN** 用注入根构造 IsolatedNotes adapter 并 create
- **THEN** 该 note MUST 能 get 回来
- **AND** 数据文件路径 MUST 含 `com.mossx.notes/store.sqlite`
- **AND** 路径 MUST NOT 含 `note_card`

#### Scenario: flag off keeps Core files

- **WHEN** 环境未设置该 flag
- **THEN** `notes_compat_facade_enabled_from(None)` MUST 为 false
- **AND** `command_registry` MUST 仍绑 `crate::note_cards`
