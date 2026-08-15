# plugin-runtime-crash-until-reset-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse activate after a crash until reset

当 slot 因 required entry crash 进入 `Failed`，再次 `activate` MUST 返回 `failed`，直到 `reset_plugin`。

#### Scenario: a crashed plugin cannot activate until reset

- **WHEN** Notes 因 required entry crash 进入 Failed
- **AND** 未 reset 就再次 activate
- **THEN** `activate` MUST 失败且错误码为 `failed`
