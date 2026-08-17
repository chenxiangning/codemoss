# project-map-plugin-pilot-inventory Spec Delta

## ADDED Requirements

### Requirement: Project Map Pilot MUST have an explicit inventory before extraction

在迁移 `project_map` / `project_memory` 存储、删除知识地图 UI，或把 `@mossx/plugin-project-map` 从 re-export 升级成独立实现之前，仓库 MUST 提供 `com.mossx.project-map` inventory，区分 stay-in-Core、目标迁出、禁止跟随，以及只记账不搬的 memory-pick conversation inject。Inventory change 本身 MUST NOT 修改知识地图或 project-memory 生产行为。

#### Scenario: inventory names the project-map pilot

- **WHEN** 读取 `docs/architecture/plugin-platform/inventory/project-map-pilot.json`
- **THEN** `pluginId` MUST 为 `com.mossx.project-map`
- **AND** `status` MUST 为 `inventory-only`
- **AND** `packageRole` MUST 为 `re-export-facade`

#### Scenario: map and memory persist commands are listed

- **WHEN** 读取 inventory `surfaces.commands`
- **THEN** 列表 MUST 包含 `project_map_read` 与 `project_map_write_snapshot`
- **AND** 列表 MUST 包含 `project_map_relationship_scan`
- **AND** 列表 MUST 包含 `project_memory_list` 与 `project_memory_embed_health`

#### Scenario: canvas and search stay out of the project-map move set

- **WHEN** 读取 `mustNotMoveWithProjectMap`
- **THEN** 列表 MUST 包含 `src/features/intent-canvas`
- **AND** 列表 MUST 包含 `src-tauri/src/project_canvas.rs`
- **AND** 列表 MUST 包含 `src/features/search`

#### Scenario: inventory does not claim extraction

- **WHEN** 读取 inventory `packageRole` 与 `notes`
- **THEN** 文档 MUST 声明 `@mossx/plugin-project-map` 只是 re-export
- **AND** `coreOwner` MUST 仍为 `active`
