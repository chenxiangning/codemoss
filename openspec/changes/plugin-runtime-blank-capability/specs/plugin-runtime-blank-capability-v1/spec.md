# plugin-runtime-blank-capability-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject a blank capability

空白 capability 的 `query` MUST 返回 `schema`，不得伪装成 `permission-denied`。

#### Scenario: a blank capability cannot query

- **WHEN** Notes Ready
- **AND** capability 为空或仅空白
- **THEN** `query` MUST 失败且错误码为 `schema`
