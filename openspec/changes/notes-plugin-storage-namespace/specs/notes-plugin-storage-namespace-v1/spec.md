# notes-plugin-storage-namespace-v1 Spec Delta

## ADDED Requirements

### Requirement: Notes Pilot MAY persist under an injected DiskStorage root

当调用方注入存储根时，Core MUST 为 `com.mossx.notes` 创建 `plugin-runtime/data/com.mossx.notes/store.sqlite`。checkpoint / restore MUST 复用 Wave 2 DiskStorage。本路径 MUST NOT 读取产品 `note_cards` 目录。

#### Scenario: injected root gets notes sqlite

- **WHEN** `open_notes_namespace` 在 temp 根打开 Notes
- **THEN** 该路径下 MUST 存在 `plugin-runtime/data/com.mossx.notes/store.sqlite`

#### Scenario: notes restore returns checkpoint schema

- **WHEN** checkpoint 后 schema 被迁到 2
- **AND** 调用 restore
- **THEN** store schema MUST 回到 1
