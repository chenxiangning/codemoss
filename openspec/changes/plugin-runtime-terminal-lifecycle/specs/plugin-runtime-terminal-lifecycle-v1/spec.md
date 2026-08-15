# plugin-runtime-terminal-lifecycle-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST keep fuse and disable inside one terminal state

`fuse_plugin` 对已 Fused 槽位 MUST 幂等成功。`disable_plugin` 对已 Disabled 槽位 MUST 幂等成功。跨 Failed / Fused / Disabled / Idle 的 fuse 或 disable MUST 失败，且不得改写 slot state。

#### Scenario: fuse is idempotent on an already fused plugin

- **WHEN** Notes 已 fuse
- **AND** 再次 `fuse_plugin`
- **THEN** 调用 MUST 成功且 state 仍为 `Fused`

#### Scenario: fuse cannot overwrite failed disabled or idle

- **WHEN** Notes 为 Failed、Disabled 或 reset 后的 Idle
- **THEN** `fuse_plugin` MUST 失败
- **AND** slot state MUST 不变

#### Scenario: disable cannot overwrite failed fused or idle

- **WHEN** Notes 为 Failed、Fused 或 reset 后的 Idle
- **THEN** `disable_plugin` MUST 失败
- **AND** slot state MUST 不变
