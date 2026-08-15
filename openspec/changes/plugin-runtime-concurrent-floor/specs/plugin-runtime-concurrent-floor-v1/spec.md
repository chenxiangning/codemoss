# plugin-runtime-concurrent-floor-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject a zero concurrent activation budget

`HostConfig.max_concurrent` 为 0 时，`PluginRuntime::new` MUST 返回 `invalid-budget`。

#### Scenario: a zero concurrent budget cannot construct the runtime

- **WHEN** `max_concurrent` 为 0
- **THEN** `PluginRuntime::new` MUST 失败且错误码为 `invalid-budget`
