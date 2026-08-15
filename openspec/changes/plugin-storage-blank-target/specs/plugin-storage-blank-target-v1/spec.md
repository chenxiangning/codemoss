# plugin-storage-blank-target-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST reject a blank access_store target

空白 `target_id` 的 `access_store` MUST 返回 `schema`，不得伪装成 `permission-denied`。

#### Scenario: a blank target cannot be accessed

- **WHEN** Notes Ready
- **AND** `access_store("com.mossx.notes", ""|"   ")`
- **THEN** 调用 MUST 失败且错误码为 `schema`
