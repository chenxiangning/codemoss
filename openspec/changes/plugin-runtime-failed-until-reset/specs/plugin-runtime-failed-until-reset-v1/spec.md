# plugin-runtime-failed-until-reset-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse activate while the slot is Failed

当 slot 为 `Failed`，再次 `activate` MUST 返回 `failed`，直到 `reset_plugin`。

#### Scenario: a failed plugin cannot activate until reset

- **WHEN** Notes 因 required entry timeout 进入 Failed
- **AND** 未 reset 就再次 activate
- **THEN** `activate` MUST 失败且错误码为 `failed`
