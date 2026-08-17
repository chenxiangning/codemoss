# project-map-plugin-storage-namespace-v1 Spec Delta

## ADDED Requirements

### Requirement: Project Map Pilot MAY persist under an injected DiskStorage root

当调用方注入存储根时，Core MUST 为 `com.mossx.project-map` 创建 `plugin-runtime/data/com.mossx.project-map/store.sqlite`。checkpoint / restore MUST 复用 Wave 2 DiskStorage。本路径 MUST NOT 读取产品 `project-map` / `project-map-relations` / `project-memory` 目录。

#### Scenario: injected root gets project-map sqlite

- **WHEN** `open_project_map_namespace` 在 temp 根打开 Project Map
- **THEN** 该路径下 MUST 存在 `plugin-runtime/data/com.mossx.project-map/store.sqlite`

#### Scenario: project-map restore returns checkpoint schema

- **WHEN** checkpoint 后 schema 被迁到 2
- **AND** 调用 restore
- **THEN** store schema MUST 回到 1

#### Scenario: isolated namespace must not touch product map or memory paths

- **WHEN** 打开注入根 namespace
- **THEN** 路径 MUST NOT 包含 `~/.ccgui/project-map`、`project-map-relations` 或 `project-memory`
- **AND** 24 条产品命令 MUST 仍走 5D 的 Core `*_core` 路径
