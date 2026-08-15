# plugin-storage-blank-identity-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject a blank pluginId on store APIs

空白 `pluginId` 的 `open_own_store`、`checkpoint_own_store` 与 `access_store` MUST 返回 `schema`。

#### Scenario: a blank plugin id cannot touch storage

- **WHEN** `plugin_id` 为空或仅空白
- **THEN** `open_own_store` / `checkpoint_own_store` / `access_store` MUST 失败且错误码为 `schema`
