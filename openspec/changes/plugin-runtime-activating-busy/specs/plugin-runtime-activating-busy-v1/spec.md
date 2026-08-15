# plugin-runtime-activating-busy-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST fail closed while a slot is Activating

当 slot 为 `Activating`，`activate` 与 `reset_plugin` MUST 返回 `activation-busy`。`query`、`open_stream` 与 `open_own_store` MUST 返回 `plugin-unavailable`。

#### Scenario: an activating plugin cannot be used or reset

- **WHEN** Notes slot 处于 `Activating`
- **THEN** `activate` / `reset_plugin` MUST 失败且错误码为 `activation-busy`
- **AND** `query` / `open_stream` / `open_own_store` MUST 失败且错误码为 `plugin-unavailable`
