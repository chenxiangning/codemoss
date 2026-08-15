# plugin-runtime-disabled-until-reset-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse activate while the slot is Disabled

当 slot 为 `Disabled`，再次 `activate` MUST 返回 `disabled`，直到 `reset_plugin`。

#### Scenario: a disabled plugin cannot activate until reset

- **WHEN** Notes 已 disable
- **AND** 未 reset 就再次 activate
- **THEN** `activate` MUST 失败且错误码为 `disabled`
