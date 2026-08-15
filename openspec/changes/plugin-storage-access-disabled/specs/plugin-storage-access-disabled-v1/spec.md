# plugin-storage-access-disabled-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse store access after disable

当 plugin 已被 disable，即使 caller 与 target 相同，`access_store` MUST 返回 `plugin-unavailable`。store 文件 MUST 仍存在。

#### Scenario: disabled plugin cannot access its own store

- **WHEN** Notes 已 ready 并打开 store
- **AND** 随后被 disable
- **THEN** `access_store(notes, notes)` MUST 失败且错误码为 `plugin-unavailable`
- **AND** store 文件 MUST 仍存在
