# project-map-plugin-isolated-storage-v1 Spec Delta

## ADDED Requirements

### Requirement: Isolated ProjectMapNamespace MUST support persist CRUD without touching product files

隔离 `ProjectMapNamespace` MUST 在注入根 sqlite 上支持 map blob、relations blob、memory item、settings、embed-index 的读写与删除。路径 MUST 包含 `plugin-runtime/data/com.mossx.project-map/store.sqlite`，MUST NOT 包含产品 `project-map` / `project-map-relations` / `project-memory` 目录。产品 24 条 command MUST 仍走 5D `*_core`。`MOSSX_PROJECT_MAP_COMPAT_FACADE` MUST 默认关。本刀 MUST NOT 迁存量文件。

#### Scenario: isolated map memory settings and embed can be written and read back

- **WHEN** 在注入根写入一条 map blob、一条 memory item、一份 settings、一条 embed-index
- **THEN** get MUST 读回同 workspace / 同 id
- **AND** update MUST 改 memory title
- **AND** delete memory 后 get MUST 为 None
- **AND** 路径 MUST 包含 `plugin-runtime/data/com.mossx.project-map/store.sqlite`

#### Scenario: isolated namespace restores deleted persist rows

- **WHEN** 写入 map blob 与 memory item 后 checkpoint
- **AND** 删除这两行
- **AND** 调用 restore
- **THEN** 两行 MUST 读回原内容

#### Scenario: product commands stay on Core files

- **WHEN** 读取 24 条产品 command 入口
- **THEN** 每条 MUST 仍存在对应 `*_core`
- **AND** `MOSSX_PROJECT_MAP_COMPAT_FACADE` 默认 MUST 为关
- **AND** 门面默认 owner MUST 仍是 `CoreProjectMap`
