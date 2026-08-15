# plugin-ipc-uds-per-plugin-dir-v1 Spec Delta

## ADDED Requirements

### Requirement: private UDS directory MUST be per-plugin

`private_uds_dir(plugin_id)` MUST 为每个合法 pluginId 创建独立 0700 目录。Notes 与 Claude MUST 不得共享父目录。非法 pluginId MUST 失败。

#### Scenario: notes and claude do not share a uds directory

- **WHEN** 分别为 `com.mossx.notes` 与 `com.mossx.engine.claude` 取私有 UDS 路径
- **THEN** 它们的父目录 MUST 不同
- **AND** 两个目录 MUST 都是 0700

#### Scenario: an invalid plugin id cannot create a uds directory

- **WHEN** `private_uds_dir` 收到非法 pluginId
- **THEN** 它 MUST 失败
