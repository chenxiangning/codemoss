# plugin-storage-restore-fused-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse restore after fuse

当 plugin 已被 fuse，`restore_own_store` MUST 返回 `plugin-unavailable`。

#### Scenario: fused plugin cannot restore

- **WHEN** Notes 已 ready
- **AND** 随后被 fuse
- **THEN** `restore_own_store` MUST 失败且错误码为 `plugin-unavailable`
