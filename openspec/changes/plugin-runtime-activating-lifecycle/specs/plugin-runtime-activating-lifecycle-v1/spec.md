# plugin-runtime-activating-lifecycle-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse fuse and disable while a slot is Activating

当 slot 为 `Activating`，`fuse_plugin` 与 `disable_plugin` MUST 返回 `activation-busy`。

#### Scenario: an activating plugin cannot be fused or disabled

- **WHEN** Notes slot 处于 `Activating`
- **THEN** `fuse_plugin` 与 `disable_plugin` MUST 失败且错误码为 `activation-busy`
