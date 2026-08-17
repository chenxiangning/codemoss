# project-map-plugin-dual-run-isolated-v1 Spec Delta

## ADDED Requirements

### Requirement: Flag-on Project Map persist MUST use the isolated sqlite namespace

`MOSSX_PROJECT_MAP_COMPAT_FACADE` 打开时，persist 命令（map / relations / memory / settings / embed-index）MUST 经 `ProjectMapCompatAdapter` 读写隔离 `ProjectMapNamespace`，MUST NOT 调用对应 `*_core` 写产品目录。flag 关闭时 MUST 仍走 `*_core`。隔离路径 MUST 含 `plugin-runtime/data/com.mossx.project-map/store.sqlite`，MUST NOT 含产品 `project-map` / `project-memory` 目录。embed health/text/download/remove MUST 仍走 Core。`relationship_scan` MUST 复用 Core `scan_workspace` 写 temp 再导入 blob，MUST NOT 写产品目录。本刀 MUST NOT 迁存量，MUST NOT 默认开 flag。

#### Scenario: isolated adapter writes only the plugin namespace

- **WHEN** 用注入根构造 IsolatedProjectMap adapter 并写入 map blob 与 memory item
- **THEN** 该 map / memory MUST 能读回来
- **AND** 数据文件路径 MUST 含 `com.mossx.project-map/store.sqlite`
- **AND** 路径 MUST NOT 含产品 `project-map` 目录（`~/.ccgui/project-map`）或 `project-memory` 产品文件路径

#### Scenario: flag off keeps Core files

- **WHEN** 环境未设置该 flag
- **THEN** `project_map_compat_facade_enabled_from(None)` MUST 为 false
- **AND** 产品命令源码 MUST 在 flag-on 分支调用 `isolated_product`
- **AND** flag-off 分支 MUST 仍绑 `*_core`
