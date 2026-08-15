# plugin-storage-migrate-ready-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST migrate storage only while the plugin is ready

`migrate_own_store` MUST 仅在 Host slot 为 `ready` 时把 schema 往前推。disable 之后 MUST 返回 `plugin-unavailable`。

#### Scenario: ready plugin can migrate after checkpoint

- **WHEN** Notes 已 ready 且已 checkpoint
- **THEN** `migrate_own_store` 1→2 MUST 成功

#### Scenario: disabled plugin cannot migrate

- **WHEN** plugin 已被 disable
- **THEN** `migrate_own_store` MUST 失败
