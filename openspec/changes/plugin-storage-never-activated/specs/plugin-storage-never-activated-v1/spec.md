# plugin-storage-never-activated-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse storage APIs before activate

当 plugin 从未 activate，`open_own_store`、`checkpoint_own_store`、`restore_own_store`、`migrate_own_store` 与 `access_store` MUST 返回 `plugin-unavailable`。

#### Scenario: a never-activated plugin cannot use storage APIs

- **WHEN** Host 已 enabled
- **AND** Notes 从未 activate
- **THEN** 五类 store API MUST 失败且错误码为 `plugin-unavailable`
