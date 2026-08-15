# plugin-storage-sqlite-temp-v1 Spec Delta

## ADDED Requirements

### Requirement: Core MAY persist a plugin namespace under an injected root

当调用方注入存储根目录时，Core MUST 在 `plugin-runtime/data/<pluginId>/store.sqlite` 创建隔离库。checkpoint MUST 复制该文件到 `plugin-runtime/checkpoints/<pluginId>/<id>/`。restore MUST 用 checkpoint 文件覆盖 data 文件。不同 `pluginId` MUST NOT 共享同一个 sqlite 文件。本 change MUST NOT 写入产品 Notes / session 数据库路径。

#### Scenario: temp root gets a plugin-scoped sqlite

- **WHEN** `DiskStorage` 在 temp 根打开 `com.mossx.notes`
- **THEN** 该路径下 MUST 存在 `plugin-runtime/data/com.mossx.notes/store.sqlite`

#### Scenario: restore replaces mutated store

- **WHEN** checkpoint 之后 store 内容被改写
- **AND** 调用 restore
- **THEN** store 文件 MUST 回到 checkpoint 内容
