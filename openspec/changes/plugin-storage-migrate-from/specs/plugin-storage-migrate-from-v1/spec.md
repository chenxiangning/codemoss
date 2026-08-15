# plugin-storage-migrate-from-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse migrate when from does not match the store

当 `MigrationPlan.from` 不等于当前 store schema 时，即使 plugin ready 且已 checkpoint，`migrate_own_store` MUST 返回 `invalid-storage`。

#### Scenario: ready plugin cannot migrate with a mismatched from

- **WHEN** Notes 已 ready 且已 checkpoint，store schema 为 1
- **AND** plan.from 为 2
- **THEN** `migrate_own_store` MUST 失败且错误码为 `invalid-storage`
