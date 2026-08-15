# plugin-runtime-blank-query-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject a blank pluginId on query and stream

空白 `pluginId` 的 `query` 与 `open_stream` MUST 返回 `schema`。

#### Scenario: a blank plugin id cannot query or open a stream

- **WHEN** `plugin_id` 为空或仅空白
- **THEN** `query` 与 `open_stream` MUST 失败且错误码为 `schema`
