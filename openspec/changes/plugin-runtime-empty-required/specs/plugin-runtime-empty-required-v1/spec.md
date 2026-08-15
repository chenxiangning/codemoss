# plugin-runtime-empty-required-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject an empty required closure

`activate` 的 `required_entries` 为空时 MUST 返回 `schema`。不得把空 closure 当成成功激活。

#### Scenario: empty required entries fail on the compose surface

- **WHEN** Host 已 enabled
- **AND** `ActivationRequest.required_entries` 为空
- **THEN** `PluginRuntime::activate` MUST 失败且错误码为 `schema`
