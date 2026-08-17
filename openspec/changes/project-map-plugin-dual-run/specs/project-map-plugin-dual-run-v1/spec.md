# project-map-plugin-dual-run-v1 Spec Delta

## ADDED Requirements

### Requirement: Project Map facade MUST delegate to Core across all twenty-four commands

`project_map.rs` / `project_map_relations.rs` / `project_memory/**` MUST 把 24 条命令的 Core 逻辑抽成 `pub(crate)` 内部函数（`project_map_read_core` 等）。`ProjectMapCompatAdapter` MUST 提供 24 个 delegate 方法直接调这些内部函数，且 `owner()` 恒为 `ProjectMapCompatOwner::CoreProjectMap`。delegate MUST NOT 调命令入口（避免递归），MUST NOT 引入第二个实现。

#### Scenario: the facade exposes a single Core owner across twenty-four commands

- **WHEN** 构造 `ProjectMapCompatAdapter::core()`
- **THEN** `owner()` MUST 为 `ProjectMapCompatOwner::CoreProjectMap`
- **AND** facade MUST 提供 24 个 delegate 方法，各自调对应 `*_core` 内部函数

### Requirement: project_map and project_memory commands MUST route through a default-off facade flag

24 条 `project_map_*` / `project_memory_*` 命令入口 MUST 加 flag 分发：`MOSSX_PROJECT_MAP_COMPAT_FACADE` 默认 off 时走与当前完全一致的 Core 路径；on 时经 facade 调到同一 Core 实现。MUST NOT 引入第二个实现。

#### Scenario: default-off keeps product behavior unchanged

- **WHEN** flag 未设置（默认）
- **THEN** `project_map_compat_facade_enabled()` MUST 返回 `false`
- **AND** 24 条命令 MUST 走 `*_core`，行为与当前一致

#### Scenario: flag routes through the facade to the same Core implementation

- **WHEN** flag 置为 `"1"`
- **THEN** 24 条命令 MUST 经 facade 分发到同一组 `*_core`
- **AND** 不得 activate / dispatch 插件运行时，不得迁产品 map / memory 目录

### Requirement: the call-surface close MUST NOT wire the plugin runtime

本刀 MUST NOT 接插件运行时（不 activate / 不 dispatch / 不接插件 storage），MUST NOT 删 `project_map*` / `project_memory*` / `src/features/project-map/**`，MUST NOT 默认开 flag 或开 Marketplace。

#### Scenario: no runtime wiring and no Core deletion

- **WHEN** 检查本刀改动
- **THEN** `project_map.rs` / `project_memory/**` 与 `src/features/project-map/**` MUST 仍存在
- **AND** 命令分发 MUST NOT 调用 `plugin_runtime` 的 activate / dispatch / storage
