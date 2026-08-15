# plugin-runtime-reverse-dns-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject a non reverse-DNS pluginId

非 reverse-DNS 的 `pluginId`（含路径穿越、无点号、大写）MUST 返回 `schema`，且不得写入 Host slot。

#### Scenario: a traversing plugin id cannot activate

- **WHEN** `plugin_id` 为 `"../escape"` 或 `"Notes"`
- **THEN** `activate` MUST 失败且错误码为 `schema`
- **AND** Host MUST 不创建对应 slot
