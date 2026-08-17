# notes-plugin-owner-refresh-v1 Spec Delta

## ADDED Requirements

### Requirement: Product Notes and Claude MUST stay Core-owned while both flags default off

`MOSSX_NOTES_COMPAT_FACADE` 与 `MOSSX_CLAUDE_PROCESS_ENTRY` MUST 默认关闭。产品 Notes 七条命令 MUST 仍由 `command_registry` 绑到 `note_cards.rs`。隔离 `NotesNamespace` 路径 MUST NOT 包含产品 `note_cards` 目录。`boot_driver()` MUST 仍 `missing_executable()`。本刀 MUST NOT 迁表、MUST NOT Slim。

#### Scenario: both dual-run flags default off

- **WHEN** 环境未设置两旗
- **THEN** `notes_compat_facade_enabled_from(None)` MUST 为 false
- **AND** `claude_process_entry_enabled_from(None)` MUST 为 false

#### Scenario: product registry still owns note_card commands

- **WHEN** 读取 `command_registry.rs`
- **THEN** 七条 `note_card_*` MUST 仍指向 `crate::note_cards`
- **AND** `src/note_cards.rs` MUST 仍存在
