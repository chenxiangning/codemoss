# plugin-storage-migrate-quarantine-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST quarantine an old reader against a newer store

当 `MigrationPlan.reader_schema` 小于当前 store schema 时，即使 plugin ready 且已 checkpoint，`migrate_own_store` MUST 返回 `quarantine`。

#### Scenario: old reader cannot migrate a newer store

- **WHEN** Notes 已 ready、已 checkpoint，且 store schema 已是 2
- **AND** plan 的 `reader_schema` 为 1
- **THEN** `migrate_own_store` MUST 失败且错误码为 `quarantine`
