# plugin-storage-failed-access-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse access_store after a failed activation

当 slot 为 `Failed`，`access_store` MUST 返回 `plugin-unavailable`。

#### Scenario: a failed plugin cannot access its store

- **WHEN** Notes 因 required entry timeout 进入 Failed
- **THEN** `access_store(notes, notes)` MUST 失败且错误码为 `plugin-unavailable`
