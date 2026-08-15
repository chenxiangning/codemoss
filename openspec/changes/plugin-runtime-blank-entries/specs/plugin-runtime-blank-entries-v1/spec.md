# plugin-runtime-blank-entries-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject blank identity or required entries

当 `plugin_id`、`unit_id` 或任一 `required_entries` 项为空或仅空白，`activate` MUST 返回 `schema`，且不得写入 slot。

#### Scenario: a blank required entry cannot activate

- **WHEN** `required_entries` 含 `""`
- **THEN** `activate` MUST 失败且错误码为 `schema`
- **AND** Host MUST 不创建对应 slot

#### Scenario: a whitespace-only identity cannot activate

- **WHEN** `plugin_id` 或 `unit_id` 仅为空白
- **THEN** `activate` MUST 失败且错误码为 `schema`
