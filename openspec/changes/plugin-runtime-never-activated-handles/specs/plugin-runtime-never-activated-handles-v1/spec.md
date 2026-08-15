# plugin-runtime-never-activated-handles-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse query and stream before activate

当 plugin 从未 activate，即使 Host 已 enabled，`query_read` 与 `open_stream` MUST 返回 `plugin-unavailable`。

#### Scenario: a never-activated plugin cannot query or open a stream

- **WHEN** Host 已 enabled
- **AND** Notes 从未 activate
- **THEN** `query_read` 与 `open_stream` MUST 失败且错误码为 `plugin-unavailable`
