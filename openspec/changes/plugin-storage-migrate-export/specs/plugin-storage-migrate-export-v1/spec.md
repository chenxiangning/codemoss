# plugin-storage-migrate-export-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse migrate when a required export is missing

当 `MigrationPlan.export_required` 为 true 且 `exported` 为 false 时，即使 plugin ready 且已 checkpoint，`migrate_own_store` MUST 返回 `export-required`。

#### Scenario: ready plugin cannot migrate without required export

- **WHEN** Notes 已 ready 且已 checkpoint
- **AND** plan 要求 export 但尚未 exported
- **THEN** `migrate_own_store` MUST 失败且错误码为 `export-required`
