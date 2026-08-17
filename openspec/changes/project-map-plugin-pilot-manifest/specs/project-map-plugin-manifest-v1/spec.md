# project-map-plugin-manifest-v1 Spec Delta

## ADDED Requirements

### Requirement: Project Map Pilot MUST exact-declare its view, memory panel, and inventory commands

`com.mossx.project-map` Pilot Manifest MUST exact declare `mossx.ui.view`（`project-map.main`，slot `workspace.main`）、`mossx.ui.panel`（`project-map.memory`，slot `workspace.rightPanel`），以及 inventory 中全部 24 条 `project_map_*` / `project_memory_*` `mossx.command`。Command contribution MUST NOT 使用 template。激活 MUST 使用 `onView` / `onCommand`，MUST NOT 使用 `onStartup`。该 Manifest MUST NOT 声明 `mossx.engine.provider`。memory-pick conversation inject MUST NOT 出现在本 fixture。

#### Scenario: project-map pilot fixture is accepted

- **WHEN** parser 读取 `fixtures/valid/project-map-pilot.json` 且 trustTier 为 system
- **THEN** 解析 MUST 成功
- **AND** `pluginId` MUST 为 `com.mossx.project-map`

#### Scenario: project-map commands cannot be templated

- **WHEN** 同一 Manifest 用 `contributionTemplates` 产生 `mossx.command`
- **THEN** parser MUST 拒绝

#### Scenario: transitional facade stays a one-view door

- **WHEN** 读取 `packages/plugin-project-map/.mossx-plugin/plugin.json`
- **THEN** 该门面 MUST 仍只有 `project-map.main` view
- **AND** MUST NOT 被本 change 扩成 24 条 command 的假合同
