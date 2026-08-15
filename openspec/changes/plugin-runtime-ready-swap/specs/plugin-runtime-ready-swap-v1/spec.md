# plugin-runtime-ready-swap-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST swap generation and revoke old handles on re-activate

当 slot 已 Ready，再次 `activate` MUST 返回更大 generation。旧 generation 的 `query_read` 与 `open_stream` MUST 失败。旧 stream MUST 被撤销。新 generation 的 query / stream MUST 成功。

#### Scenario: ready re-activate invalidates the previous generation

- **WHEN** Notes 已 ready 并打开 stream
- **AND** 再次 activate
- **THEN** 新 generation MUST 大于旧 generation
- **AND** 旧 generation 的 query / stream MUST 失败
- **AND** 旧 stream MUST 不再存在
