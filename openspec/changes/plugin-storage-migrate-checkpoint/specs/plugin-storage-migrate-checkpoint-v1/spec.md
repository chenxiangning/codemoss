# plugin-storage-migrate-checkpoint-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse migrate when no checkpoint exists

即使 Host slot 为 `ready`，若该 plugin 尚未 checkpoint，`migrate_own_store` MUST 返回 `checkpoint-required`。

#### Scenario: ready plugin cannot migrate without checkpoint

- **WHEN** Notes 已 ready 且已打开 store
- **AND** 尚未 `checkpoint_own_store`
- **THEN** `migrate_own_store` MUST 失败且错误码为 `checkpoint-required`
