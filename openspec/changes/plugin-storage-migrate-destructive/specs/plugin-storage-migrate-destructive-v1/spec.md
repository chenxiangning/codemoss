# plugin-storage-migrate-destructive-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse unconfirmed destructive migrate

当 `MigrationPlan.destructive` 为 true 且 `confirmed` 为 false 时，即使 plugin ready 且已 checkpoint，`migrate_own_store` MUST 返回 `destructive-unconfirmed`。

#### Scenario: ready plugin cannot run unconfirmed destructive migrate

- **WHEN** Notes 已 ready 且已 checkpoint
- **AND** plan 为 destructive 且未 confirmed
- **THEN** `migrate_own_store` MUST 失败且错误码为 `destructive-unconfirmed`
