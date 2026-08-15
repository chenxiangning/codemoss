# plugin-runtime-disabled-reset-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST restore composed handles after a disable reset

当 plugin 被 `disable_plugin` 后，`reset_plugin` 再成功 `activate` MUST 恢复 query / stream / store。新 generation MUST 大于 disable 前。

#### Scenario: reset after disable restores handles

- **WHEN** Notes 已 disable
- **AND** reset 后再次成功 activate
- **THEN** query / open_stream / open_own_store MUST 成功
- **AND** 新 generation MUST 大于旧 generation
