# plugin-notes-package-layer-v1 Spec Delta

## ADDED Requirements

### Requirement: Notes MUST have an in-repo package layer without migrating product data

仓库 MUST 提供 `packages/plugin-notes`。`pluginId` MUST 为 `com.mossx.notes`。`note_cards.rs` MUST 仍在。boot MUST NOT 安装该包。

#### Scenario: package manifest is accepted and product table stays

- **WHEN** 解析 `packages/plugin-notes/.mossx-plugin/plugin.json`
- **THEN** parser MUST 接受
- **AND** `src-tauri/src/note_cards.rs` MUST 仍存在
