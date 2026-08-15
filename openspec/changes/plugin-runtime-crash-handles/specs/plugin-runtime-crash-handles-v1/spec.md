# plugin-runtime-crash-handles-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse composed handles after an entry crash

当 required entry crash 导致 activate 失败，slot MUST 为 `Failed`。随后 `query_read`、`open_stream` 与 `open_own_store` MUST 返回 `plugin-unavailable`。

#### Scenario: a crashed activation cannot receive composed handles

- **WHEN** Notes 的某个 required entry crash
- **THEN** `activate` MUST 失败且错误码为 `activation-failed`
- **AND** query / stream / store MUST 失败且错误码为 `plugin-unavailable`
