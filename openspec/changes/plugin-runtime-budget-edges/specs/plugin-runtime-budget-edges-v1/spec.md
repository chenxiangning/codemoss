# plugin-runtime-budget-edges-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST accept the legal Host budget floors

`HostConfig.activation_deadline=1000ms` 与 `max_concurrent=1` 时，`PluginRuntime::new` MUST 成功，且 `activate` MUST 成功。

#### Scenario: the legal budget floors can construct and activate

- **WHEN** `activation_deadline` 为 1000ms 且 `max_concurrent` 为 1
- **THEN** `PluginRuntime::new` MUST 成功
- **AND** `activate(Notes)` MUST 成功
