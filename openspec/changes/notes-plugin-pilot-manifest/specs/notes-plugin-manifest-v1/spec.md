# notes-plugin-manifest-v1 Spec Delta

## ADDED Requirements

### Requirement: Notes Pilot MUST exact-declare its view and inventory commands

`com.mossx.notes` Pilot Manifest MUST exact declare `mossx.ui.view`（`notes.main`）以及 inventory 中全部 7 条 `note_card_*` `mossx.command`。Command contribution MUST NOT 使用 template。激活 MUST 使用 `onView` / `onCommand`，MUST NOT 使用 `onStartup`。该 Manifest MUST NOT 声明 `mossx.engine.provider`。

#### Scenario: notes pilot fixture is accepted

- **WHEN** parser 读取 `fixtures/valid/notes-pilot.json` 且 trustTier 为 system
- **THEN** 解析 MUST 成功
- **AND** `pluginId` MUST 为 `com.mossx.notes`

#### Scenario: notes commands cannot be templated

- **WHEN** 同一 Manifest 用 `contributionTemplates` 产生 `mossx.command`
- **THEN** parser MUST 拒绝
