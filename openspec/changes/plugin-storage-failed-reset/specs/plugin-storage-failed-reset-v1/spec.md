# plugin-storage-failed-reset-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST restore store APIs after a failed activation reset

当 activate 因 timeout 失败后，`reset_plugin` 再成功 `activate` MUST 恢复 `access_store` 与 `checkpoint_own_store`。

#### Scenario: reset after failed activation restores store APIs

- **WHEN** Notes 因 required entry timeout 进入 Failed
- **AND** reset 后再次成功 activate
- **THEN** `open_own_store`、`access_store` 与 `checkpoint_own_store` MUST 成功
