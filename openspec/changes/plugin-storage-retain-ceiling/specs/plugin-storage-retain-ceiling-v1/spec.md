# plugin-storage-retain-ceiling-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST accept retainPrevious=5

当 Notes Ready 时，`checkpoint_own_store_retained(notes, 5)` MUST 成功。

#### Scenario: the legal retain ceiling can checkpoint

- **WHEN** Notes 已 Ready
- **AND** `retainPrevious` 为 5
- **THEN** `checkpoint_own_store_retained` MUST 返回 `ckpt-*`
