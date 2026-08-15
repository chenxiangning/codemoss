# plugin-storage-fuse-reset-lifecycle-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST restore checkpoint after a fuse reset

当 plugin 被 `fuse_plugin` 后，`reset_plugin` 再成功 `activate` MUST 恢复 `checkpoint_own_store`。

#### Scenario: reset after fuse restores checkpoint

- **WHEN** Notes 已 fuse
- **AND** reset 后再次成功 activate
- **THEN** `checkpoint_own_store` MUST 成功
