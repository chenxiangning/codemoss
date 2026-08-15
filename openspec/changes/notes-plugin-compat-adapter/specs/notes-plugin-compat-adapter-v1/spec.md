# notes-plugin-compat-adapter-v1 Spec Delta

## ADDED Requirements

### Requirement: Notes Pilot MUST expose a single-owner compatibility facade before product cutover

Core MUST 提供 `NotesCompatAdapter`，`pluginId` MUST 为 `com.mossx.notes`。门面 MUST exact 声明 inventory 中 7 条 `note_card_*` command。`MOSSX_NOTES_COMPAT_FACADE` MUST 默认关闭。本 change MUST NOT 修改 `note_cards.rs` 生产行为，MUST NOT 写入产品 Notes 目录。

#### Scenario: facade identity matches notes fixture

- **WHEN** 构造 `NotesCompatAdapter`
- **THEN** `pluginId` MUST 为 `com.mossx.notes`
- **AND** command 列表 MUST 含全部 7 个 inventory commandId

#### Scenario: flag defaults to off

- **WHEN** 环境变量未设置
- **THEN** `notes_compat_facade_enabled()` MUST 返回 false
