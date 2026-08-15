# plugin-storage-checkpoint-ready-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST checkpoint storage only while the plugin is ready

`checkpoint_own_store` MUST 仅在 Host slot 为 `ready` 时成功。disable 之后 MUST 返回 `plugin-unavailable`。

#### Scenario: ready plugin can checkpoint its store

- **WHEN** Notes 已 ready 并打开 store
- **THEN** `checkpoint_own_store` MUST 返回 checkpoint id

#### Scenario: disabled plugin cannot checkpoint

- **WHEN** plugin 已被 disable
- **THEN** `checkpoint_own_store` MUST 失败
