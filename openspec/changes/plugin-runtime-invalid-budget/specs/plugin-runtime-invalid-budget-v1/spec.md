# plugin-runtime-invalid-budget-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject an invalid Host budget

`PluginRuntime::new` MUST 拒绝超出合同的 `max_concurrent` 或 `activation_deadline`，错误码 MUST 为 `invalid-budget`。

#### Scenario: concurrent activations above two are rejected

- **WHEN** `HostConfig.max_concurrent` 为 3
- **THEN** `PluginRuntime::new` MUST 失败且错误码为 `invalid-budget`

#### Scenario: activation deadline above 30s is rejected

- **WHEN** `HostConfig.activation_deadline` 为 31_000 ms
- **THEN** `PluginRuntime::new` MUST 失败且错误码为 `invalid-budget`
