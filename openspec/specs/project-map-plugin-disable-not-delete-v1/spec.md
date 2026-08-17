# project-map-plugin-disable-not-delete-v1 Specification

## Purpose

产品默认禁用 Project Map 的 Core owner，但保留 `project_map.rs` 与 `project_memory` 作为显式 `0` 的 recovery。later-plugin 仍 Active。本 capability 不 Slim。

## Requirements

### Requirement: Product Project Map Core owner MUST be disabled unless explicitly off

未设置 `MOSSX_PROJECT_MAP_COMPAT_FACADE` 时，`core_owner_for_plugin("com.mossx.project-map")` MUST 为 `Disabled`。显式 `0` MUST 为 `Fallback`。`project_map.rs` 与 `project_memory` MUST 仍存在。later-plugin MUST 仍为 `Active`。本刀 MUST NOT Slim。

#### Scenario: default disables project-map Core owner

- **WHEN** 环境未设置该变量
- **THEN** `project_map_core_owner_from(None)` MUST 为 `Disabled`
- **AND** `src/project_map.rs` MUST 仍存在

#### Scenario: explicit off restores fallback

- **WHEN** 变量为 `0`
- **THEN** `project_map_core_owner_from` MUST 为 `Fallback`
- **AND** `core_owner_for_plugin("com.mossx.browser")` MUST 仍为 `Active`
