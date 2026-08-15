# plugin-runtime-crash-reset-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST restore composed handles after a crash reset

当 activate 因 required entry crash 失败后，`reset_plugin` 再成功 `activate` MUST 恢复 query / stream / store。新 generation MUST 大于失败那次。

#### Scenario: reset after crash restores handles

- **WHEN** Notes 因 required entry crash 进入 Failed
- **AND** reset 后再次成功 activate
- **THEN** query / open_stream / open_own_store MUST 成功
