# project-map-plugin-compat-adapter-v1 Spec Delta

## ADDED Requirements

### Requirement: Project Map Pilot MUST expose a single-owner compatibility facade before product cutover

Core MUST 提供 `ProjectMapCompatAdapter`，`pluginId` MUST 为 `com.mossx.project-map`。门面 MUST exact 声明 inventory 中 24 条 `project_map_*` / `project_memory_*` command。`MOSSX_PROJECT_MAP_COMPAT_FACADE` MUST 默认关闭。本 change MUST NOT 修改 `project_map*` / `project_memory*` 生产行为，MUST NOT 写入产品地图或 memory 目录，MUST NOT 把 later-plugin 标成可安装。

#### Scenario: facade identity matches project-map fixture

- **WHEN** 构造 `ProjectMapCompatAdapter`
- **THEN** `pluginId` MUST 为 `com.mossx.project-map`
- **AND** command 列表 MUST 含全部 24 个 inventory commandId，且顺序一致

#### Scenario: flag defaults to off

- **WHEN** 环境变量未设置
- **THEN** `project_map_compat_facade_enabled()` MUST 返回 false
- **AND** 显式 `0` / `false` MUST 仍为 false
- **AND** 显式 `1` / `true` MUST 为 true

#### Scenario: memory backend shares the same snapshot

- **WHEN** 用同一 `MemoryProjectMapBackend` 构造 adapter
- **THEN** 两次 `read` MUST 返回同一份数据
- **AND** MUST NOT 读取产品 `~/.ccgui/project-map*` / `project-memory`

#### Scenario: product command registry stays on Core

- **WHEN** 本 change 落地
- **THEN** `command_registry` MUST 仍把 24 条 command 指到 Core `project_map*` / `project_memory*`
- **AND** MUST NOT 给 `com.mossx.project-map` 增加 Rack install/uninstall
