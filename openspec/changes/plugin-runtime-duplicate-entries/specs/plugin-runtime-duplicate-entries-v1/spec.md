# plugin-runtime-duplicate-entries-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject duplicate required entries

当 `required_entries` 含重复 id，`activate` MUST 返回 `schema`，且不得写入 slot。

#### Scenario: a duplicated required entry cannot activate

- **WHEN** `required_entries` 为 `["notes-ui", "notes-ui"]`
- **THEN** `activate` MUST 失败且错误码为 `schema`
- **AND** Host MUST 不创建对应 slot
