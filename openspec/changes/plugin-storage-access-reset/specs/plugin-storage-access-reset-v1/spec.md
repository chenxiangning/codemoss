# plugin-storage-access-reset-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST restore store access after fuse reset

`reset_plugin` 后再 `activate`，`access_store(self, self)` MUST 成功，且路径 MUST 等于 fuse 前打开的 store。

#### Scenario: reset after fuse restores access_store

- **WHEN** Notes 已 ready 并打开 store，随后 fuse / reset / activate
- **THEN** `access_store(notes, notes)` MUST 返回同一 store 路径
