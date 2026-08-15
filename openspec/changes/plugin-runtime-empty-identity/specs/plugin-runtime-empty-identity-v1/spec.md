# plugin-runtime-empty-identity-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject an empty pluginId or unitId

当 `ActivationRequest.plugin_id` 或 `unit_id` 为空，`activate` MUST 返回 `schema`，且不得写入 slot。

#### Scenario: empty identity cannot activate

- **WHEN** `plugin_id` 为空或 `unit_id` 为空
- **THEN** `activate` MUST 失败且错误码为 `schema`
- **AND** Host MUST 不创建对应 slot
