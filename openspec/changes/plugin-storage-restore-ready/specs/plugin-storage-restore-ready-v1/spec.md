# plugin-storage-restore-ready-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST restore storage only while the plugin is ready

`restore_own_store` MUST 仅在 Host slot 为 `ready` 时成功。disable 之后 MUST 返回 `plugin-unavailable`。成功 restore MUST 把 schema 滚回最近 checkpoint。

#### Scenario: ready plugin can restore its store

- **WHEN** Notes 已 ready、已 checkpoint、schema 已被 migrate
- **THEN** `restore_own_store` MUST 把 schema 滚回 checkpoint

#### Scenario: disabled plugin cannot restore

- **WHEN** plugin 已被 disable
- **THEN** `restore_own_store` MUST 失败
