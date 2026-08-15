# plugin-runtime-unknown-capability-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse an unknown capability

即使 plugin ready，未知 capability MUST 返回 `permission-denied`。

#### Scenario: ready plugin cannot query an unknown capability

- **WHEN** Notes 已 ready
- **AND** capability 为 `mossx.filesystem.raw`
- **THEN** `query` MUST 失败且错误码为 `permission-denied`
