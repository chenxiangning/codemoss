# plugin-runtime-blank-codec-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject a blank codec

当 Notes Ready 时，`open_stream` 使用空或仅空白 codec MUST 返回 `unknown-codec`。

#### Scenario: a blank codec cannot open a stream

- **WHEN** Notes 已 Ready
- **AND** codec 为空或仅空白
- **THEN** `open_stream` MUST 失败且错误码为 `unknown-codec`
