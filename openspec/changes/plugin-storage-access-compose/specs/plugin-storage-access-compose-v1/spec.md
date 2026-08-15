# plugin-storage-access-compose-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST isolate plugin stores on the compose surface

`access_store(caller, target)` MUST 仅在 caller 为 `ready` 时继续。caller 与 target 不一致 MUST 返回 `permission-denied`。caller 读自己的 store MUST 成功。

#### Scenario: Claude cannot read the Notes store through PluginRuntime

- **WHEN** Claude 与 Notes 都已 ready，且 Notes 已打开 store
- **THEN** `access_store(claude, notes)` MUST 失败且错误码为 `permission-denied`

#### Scenario: a ready plugin can read its own store

- **WHEN** Notes 已 ready 且已打开 store
- **THEN** `access_store(notes, notes)` MUST 返回该 store 路径
