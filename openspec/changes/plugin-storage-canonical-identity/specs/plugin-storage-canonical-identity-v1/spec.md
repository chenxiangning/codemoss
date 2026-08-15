# plugin-storage-canonical-identity-v1 Spec Delta

## ADDED Requirements

### Requirement: StorageService MUST reject an untrimmed pluginId

`open_or_create` 对空、仅空白或含前后空白的 `pluginId` MUST 返回 `schema`，且不得写入 namespace。

#### Scenario: a padded plugin id cannot open a namespace

- **WHEN** `open_or_create(" com.mossx.notes ", ...)` 或 `open_or_create("   ", ...)`
- **THEN** 调用 MUST 失败且错误码为 `schema`
- **AND** service MUST 不创建对应 namespace
