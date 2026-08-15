# plugin-storage-failed-lifecycle-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse store lifecycle APIs after a failed activation

当 slot 为 `Failed`，`checkpoint_own_store`、`migrate_own_store` 与 `restore_own_store` MUST 返回 `plugin-unavailable`。

#### Scenario: a failed plugin cannot checkpoint migrate or restore

- **WHEN** Notes 因 required entry timeout 进入 Failed
- **THEN** checkpoint / migrate / restore MUST 失败且错误码为 `plugin-unavailable`
