# plugin-runtime-generation-zero-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject generation 0 as a live handle

`query` 与 `open_stream` 在 `generation=0` 时 MUST 返回 `stale-generation`，即使插件已经 Ready。

#### Scenario: generation zero cannot query or open a stream

- **WHEN** Notes 已 Ready
- **AND** 调用方使用 `generation=0`
- **THEN** `query` 与 `open_stream` MUST 失败且错误码为 `stale-generation`
