# plugin-runtime-reset-revoke-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST revoke DataPlane streams on reset

`reset_plugin` MUST 撤销该 plugin 当前 generation 的全部 stream。旧 generation 的 `query_read` 与 `open_stream` MUST 失败。

#### Scenario: reset drops leftover streams

- **WHEN** Notes 已 ready 并打开 stream
- **AND** 调用 `reset_plugin`
- **THEN** 旧 stream MUST 不再存在
- **AND** 旧 generation 的 query / stream MUST 失败
