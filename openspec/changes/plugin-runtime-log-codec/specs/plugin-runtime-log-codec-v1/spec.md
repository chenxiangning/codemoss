# plugin-runtime-log-codec-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST accept the V1 log-v1 codec

当 Notes Ready 时，`open_stream(..., "log-v1")` MUST 成功。

#### Scenario: a ready plugin can open a log-v1 stream

- **WHEN** Notes 已 Ready
- **AND** `open_stream` 使用 codec `log-v1`
- **THEN** DataPlane MUST 记录该 stream 的 codec 为 `log-v1`
