# plugin-runtime-canonical-codec-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject an untrimmed codec

当 Notes Ready 时，`open_stream` 使用含前后空白的 codec MUST 返回 `unknown-codec`。

#### Scenario: a padded codec cannot open a stream

- **WHEN** Notes 已 Ready
- **AND** codec 为 `" blob-v1 "`
- **THEN** `open_stream` MUST 失败且错误码为 `unknown-codec`
