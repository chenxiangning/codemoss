# plugin-storage-namespace-v1 Spec Delta

## ADDED Requirements

### Requirement: each plugin MUST own an isolated storage namespace

Core MUST 为每个 `pluginId` 分配逻辑路径 `plugin-runtime/data/<pluginId>/`。四轴版本 MUST 独立记录。插件 MUST NOT 获得其他 `pluginId` 的 namespace 路径。

#### Scenario: namespace path is plugin-scoped

- **WHEN** 查询 `com.mossx.notes` 的 namespace
- **THEN** 路径 MUST 包含 `com.mossx.notes`
- **AND** MUST NOT 包含其他 pluginId
