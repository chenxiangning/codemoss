# plugin-storage-disabled-lifecycle-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse store lifecycle APIs after disable

当 plugin 已被 `disable_plugin`，`checkpoint_own_store`、`migrate_own_store` 与 `restore_own_store` MUST 返回 `plugin-unavailable`。

#### Scenario: a disabled plugin cannot checkpoint migrate or restore

- **WHEN** Notes 已 disable
- **THEN** checkpoint / migrate / restore MUST 失败且错误码为 `plugin-unavailable`
