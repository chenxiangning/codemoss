# plugin-runtime-deadline-floor-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject an activation deadline below 1000ms

`HostConfig.activation_deadline` 小于 1000ms 时，`PluginRuntime::new` MUST 返回 `invalid-budget`。

#### Scenario: a sub-second deadline cannot construct the runtime

- **WHEN** `activation_deadline` 为 200ms
- **THEN** `PluginRuntime::new` MUST 失败且错误码为 `invalid-budget`
