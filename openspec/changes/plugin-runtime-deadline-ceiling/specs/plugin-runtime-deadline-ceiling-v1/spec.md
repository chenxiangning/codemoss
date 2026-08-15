# plugin-runtime-deadline-ceiling-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST accept the legal activation deadline ceiling

`HostConfig.activation_deadline=30000ms` 时，`PluginRuntime::new` MUST 成功，且 `activate` MUST 成功。

#### Scenario: the legal deadline ceiling can construct and activate

- **WHEN** `activation_deadline` 为 30000ms
- **THEN** `PluginRuntime::new` MUST 成功
- **AND** `activate(Notes)` MUST 成功
