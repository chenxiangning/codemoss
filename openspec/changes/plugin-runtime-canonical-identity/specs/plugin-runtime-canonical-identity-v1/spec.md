# plugin-runtime-canonical-identity-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject untrimmed identity strings

pluginId、unitId、required entry、capability 与 store target 若含前后空白，对应 API MUST 返回 `schema`，且不得写入 slot。

#### Scenario: a padded plugin id cannot activate

- **WHEN** `plugin_id` 为 `" com.mossx.notes "`
- **THEN** `activate` MUST 失败且错误码为 `schema`
- **AND** Host MUST 不创建对应 slot

#### Scenario: a padded capability or store target is schema

- **WHEN** Notes Ready
- **AND** capability 或 `target_id` 含前后空白
- **THEN** `query` / `access_store` MUST 失败且错误码为 `schema`
