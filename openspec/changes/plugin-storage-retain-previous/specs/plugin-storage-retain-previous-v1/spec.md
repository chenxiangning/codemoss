# plugin-storage-retain-previous-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST keep retainPrevious in 1-5

`checkpoint_own_store_retained` MUST 仅在 Host slot 为 `ready` 且 `retainPrevious` 属于 1–5 时成功。0 或 6 MUST 返回 `invalid-storage`。既有 `checkpoint_own_store` MUST 仍使用默认 2。

#### Scenario: retainPrevious outside 1-5 is rejected

- **WHEN** Notes 已 ready
- **AND** `retainPrevious` 为 0 或 6
- **THEN** `checkpoint_own_store_retained` MUST 失败且错误码为 `invalid-storage`

#### Scenario: retainPrevious 1 is accepted

- **WHEN** Notes 已 ready
- **AND** `retainPrevious` 为 1
- **THEN** `checkpoint_own_store_retained` MUST 返回 checkpoint id
