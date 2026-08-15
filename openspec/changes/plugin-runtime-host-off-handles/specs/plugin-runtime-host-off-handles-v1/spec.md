# plugin-runtime-host-off-handles-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse query and stream when Host is disabled

当 `HostConfig.enabled` 为 false，`query_read` 与 `open_stream` MUST 返回 `plugin-unavailable`。

#### Scenario: a disabled Host cannot query or open a stream

- **WHEN** `PluginRuntime` 以默认 `enabled=false` 构造
- **THEN** `query_read` 与 `open_stream` MUST 失败且错误码为 `plugin-unavailable`
