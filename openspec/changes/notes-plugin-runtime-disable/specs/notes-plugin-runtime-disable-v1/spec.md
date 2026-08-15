# notes-plugin-runtime-disable-v1 Spec Delta

## ADDED Requirements

### Requirement: Notes Pilot MUST lose composed handles after PluginRuntime disable

当 Notes fixture 经 `PluginRuntime` 激活后，`disable_plugin` MUST 同时拒绝 Broker read、`open_own_store` 与 `open_stream`。Core Notes 源码 MUST 仍存在。

#### Scenario: disabled notes cannot use composed handles

- **WHEN** Notes 已在 PluginRuntime 中 ready 并打开 store/stream
- **AND** 调用 `disable_plugin`
- **THEN** query / open_own_store / open_stream MUST 失败

#### Scenario: core notes implementation remains after composed disable

- **WHEN** 完成组合面 disable
- **THEN** `src-tauri/src/note_cards.rs` MUST 仍存在
