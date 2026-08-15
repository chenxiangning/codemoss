# plugin-runtime-cross-plugin-handles-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse one plugin stealing another plugin's stream id

当 Notes 已打开某个 `stream_id`，Claude 再用同一 `stream_id` 调用 `open_stream` MUST 返回 `stream-exists`。Notes 的 codec MUST 不变。

#### Scenario: claude cannot occupy a notes stream id

- **WHEN** Notes 与 Claude 都 ready
- **AND** Notes 已打开 stream 51 / `blob-v1`
- **THEN** Claude 对 stream 51 的 `open_stream` MUST 失败且错误码为 `stream-exists`
- **AND** stream 51 的 codec MUST 仍为 `blob-v1`
