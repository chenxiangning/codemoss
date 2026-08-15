# plugin-host-boot-composite-v1 Spec Delta

## ADDED Requirements

### Requirement: boot Host MUST use CompositeDriver and stay default-off

`boot_host` MUST 构造 `PluginRuntime<CompositeDriver>`，且 `enabled=false`。activate Notes / Claude MUST 返回 `host-disabled`，MUST NOT 留下 process child 或 QuickJS isolate。

#### Scenario: boot rejects notes without starting fibers

- **WHEN** `boot_host` 后 activate Notes
- **THEN** 错误码 MUST 为 `host-disabled`
- **AND** process live_count MUST 为 0
- **AND** worker live_count MUST 为 0

#### Scenario: boot rejects claude without starting fibers

- **WHEN** `boot_host` 后 activate Claude
- **THEN** 错误码 MUST 为 `host-disabled`
- **AND** process live_count MUST 为 0
- **AND** worker live_count MUST 为 0
