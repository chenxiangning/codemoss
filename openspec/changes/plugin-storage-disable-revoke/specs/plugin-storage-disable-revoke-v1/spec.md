# plugin-storage-disable-revoke-v1 Spec Delta

## ADDED Requirements

### Requirement: a disabled plugin MUST NOT open its storage namespace through PluginRuntime

`PluginRuntime::open_own_store` MUST 仅在 Host slot 为 `ready` 时返回 data path。disable 之后再次打开 MUST 失败，且 MUST NOT 删除已有 sqlite 文件。`reset` 并再次 activate 之后 MUST 能打开同一路径。

#### Scenario: disabled plugin cannot reopen its store

- **WHEN** Notes 已 activate 并打开 store
- **AND** 调用 `disable_plugin`
- **THEN** 再次 `open_own_store` MUST 失败
- **AND** 原 sqlite 文件 MUST 仍存在

#### Scenario: reset then activate restores store access

- **WHEN** plugin 已被 disable
- **AND** `reset` 后再 `activate`
- **THEN** `open_own_store` MUST 成功并指向同一 data path
