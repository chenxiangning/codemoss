# plugin-storage-migrate-fused-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse migrate after fuse

当 plugin 已被 fuse，`migrate_own_store` MUST 返回 `plugin-unavailable`。

#### Scenario: fused plugin cannot migrate

- **WHEN** Notes 已 ready
- **AND** 随后被 fuse
- **THEN** `migrate_own_store` MUST 失败且错误码为 `plugin-unavailable`
