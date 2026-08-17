# project-map-product-default-isolated-v1 Specification

## Purpose

产品知识地图默认走隔离 sqlite。未设置 `MOSSX_PROJECT_MAP_COMPAT_FACADE` 视为启用；显式 `0` 仍回 Core files。首次打开一次性导入 legacy 目录，不删源文件。本 capability 不 Slim、不 Disable、不装/卸。

## Requirements

### Requirement: Product Project Map MUST use isolated sqlite unless explicitly disabled

未设置 `MOSSX_PROJECT_MAP_COMPAT_FACADE` 时 MUST 视为启用。persist 命令 MUST 经 `isolated_product()` 读写隔离 namespace。显式 `0` / `false` MUST 走 `*_core`。源文件 MUST 保留。本刀 MUST NOT Slim。

#### Scenario: unset env selects isolated sqlite

- **WHEN** 环境未设置该变量
- **THEN** `project_map_compat_facade_enabled_from(None)` MUST 为 true

#### Scenario: explicit off keeps Core files

- **WHEN** 变量为 `0`
- **THEN** `project_map_compat_facade_enabled_from` MUST 为 false
- **AND** `command_registry` MUST 仍绑 `crate::project_map` / `crate::project_memory`

### Requirement: First isolated product open MUST import legacy files once

`isolated_product()` MUST 调用 `import_legacy_once`。已有 `imported.lock` 时 MUST 返回 0 且不再扫盘。MUST 导入 map / relations / settings / memory 日期文件，MUST 跳过 `backups/` 与已存在行。MUST NOT 删除源文件。即使 0 条也 MUST 写 lock。

#### Scenario: first import copies map relations and memory then locks

- **WHEN** 隔离库无 lock，且产品目录有 map / relations / settings / memory 日期文件
- **THEN** 对应行 MUST 进入隔离 sqlite
- **AND** 源文件 MUST 仍在
- **AND** 第二次调用 MUST 返回 0
