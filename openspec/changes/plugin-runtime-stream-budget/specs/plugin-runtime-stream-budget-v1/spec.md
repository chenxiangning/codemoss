# plugin-runtime-stream-budget-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST cap open streams per generation at eight

同一 plugin + generation 最多 8 条 open stream。第 9 条 `open_stream` MUST 返回 `stream-budget`。

#### Scenario: the ninth stream in one generation is refused

- **WHEN** Notes 已 ready
- **AND** 同一 generation 已打开 8 条 stream
- **THEN** 第 9 条 `open_stream` MUST 失败且错误码为 `stream-budget`
