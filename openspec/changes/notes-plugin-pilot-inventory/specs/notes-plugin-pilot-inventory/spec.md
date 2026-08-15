# notes-plugin-pilot-inventory Spec Delta

## ADDED Requirements

### Requirement: Notes Pilot MUST have an explicit inventory before extraction

在迁移 `note_cards` 存储或删除 Notes UI 之前，仓库 MUST 提供 `com.mossx.notes` inventory，区分 stay-in-Core、目标迁出与禁止跟随的 Release Notes / Claude。Inventory change 本身 MUST NOT 修改 Notes 生产行为。

#### Scenario: inventory names the notes pilot

- **WHEN** 读取 `docs/architecture/plugin-platform/inventory/notes-pilot.json`
- **THEN** `pluginId` MUST 为 `com.mossx.notes`
- **AND** `status` MUST 为 `inventory-only`

#### Scenario: release notes stay out of the Notes move set

- **WHEN** 读取 `mustNotMoveWithNotes`
- **THEN** 列表 MUST 包含 `ReleaseNotesModal` 路径
