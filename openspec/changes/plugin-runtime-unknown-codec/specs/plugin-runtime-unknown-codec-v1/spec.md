# plugin-runtime-unknown-codec-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse an unknown stream codec

即使 plugin ready，未知 codec MUST 返回 `unknown-codec`。

#### Scenario: ready plugin cannot open an unknown codec

- **WHEN** Notes 已 ready
- **AND** codec 为 `custom-pack`
- **THEN** `open_stream` MUST 失败且错误码为 `unknown-codec`
