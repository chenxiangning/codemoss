# plugin-runtime-fuse-reset-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST restore composed handles after fuse reset

`reset_plugin` MUST 将 fused slot 置回 `idle` 并保留 generation 计数。随后 `activate` MUST 成功且 generation MUST 递增。新 generation 的 Broker read、`open_own_store` 与 `open_stream` MUST 成功。

#### Scenario: reset after fuse restores composed handles

- **WHEN** plugin 已被 fuse
- **AND** 调用 `reset_plugin` 后再 `activate`
- **THEN** 新 generation MUST 大于 fuse 前
- **AND** query / open_own_store / open_stream MUST 成功
