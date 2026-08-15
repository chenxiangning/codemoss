# plugin-storage-host-disabled-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse storage APIs when Host is disabled

当 `HostConfig.enabled` 为 false，`open_own_store`、`checkpoint_own_store`、`restore_own_store`、`migrate_own_store` 与 `access_store` MUST 返回 `plugin-unavailable`。

#### Scenario: a disabled Host cannot use storage APIs

- **WHEN** `PluginRuntime` 以默认 `enabled=false` 构造
- **THEN** 五类 store API MUST 失败且错误码为 `plugin-unavailable`
