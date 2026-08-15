# plugin-storage-path-safe-id-v1 Spec Delta

## ADDED Requirements

### Requirement: Storage MUST reject a path-unsafe pluginId

含 `/`、`\\` 或 `..` 的 `pluginId` MUST 返回 `schema`，且不得在 runtime root 外创建文件。

#### Scenario: a traversing plugin id cannot open a namespace

- **WHEN** `open_or_create("../escape", ...)` 或 `open_or_create("com.mossx.notes/../escape", ...)`
- **THEN** 调用 MUST 失败且错误码为 `schema`
- **AND** DiskStorage MUST 不创建对应目录
