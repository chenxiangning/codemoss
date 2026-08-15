# plugin-runtime-activation-busy-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse activate when the concurrent budget is full

当 inflight 已达到 `max_concurrent`，再次 `activate` MUST 返回 `activation-busy`。

#### Scenario: compose surface cannot exceed the concurrent activation budget

- **WHEN** Host 已 enabled 且 `max_concurrent=2`
- **AND** inflight 已为 2
- **THEN** `activate` MUST 失败且错误码为 `activation-busy`
