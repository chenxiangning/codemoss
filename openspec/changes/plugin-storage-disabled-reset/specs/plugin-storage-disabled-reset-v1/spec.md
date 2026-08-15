# plugin-storage-disabled-reset-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST restore store lifecycle after a disable reset

当 plugin 被 `disable_plugin` 后，`reset_plugin` 再成功 `activate` MUST 恢复 `checkpoint_own_store`。

#### Scenario: reset after disable restores checkpoint

- **WHEN** Notes 已 disable
- **AND** reset 后再次成功 activate
- **THEN** `open_own_store` 与 `checkpoint_own_store` MUST 成功
