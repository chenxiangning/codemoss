# plugin-runtime-stream-exists-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse a duplicate stream id

同一 `stream_id` 已打开时，再次 `open_stream` MUST 返回 `stream-exists`。已有 codec MUST 不变。

#### Scenario: a ready plugin cannot reopen the same stream id

- **WHEN** Notes 已 ready 并打开 stream 50 / `blob-v1`
- **AND** 再次 `open_stream` 同一 stream_id
- **THEN** 第二次 MUST 失败且错误码为 `stream-exists`
- **AND** stream 50 的 codec MUST 仍为 `blob-v1`
