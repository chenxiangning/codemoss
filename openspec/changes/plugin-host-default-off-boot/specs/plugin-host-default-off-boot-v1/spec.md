# plugin-host-default-off-boot-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST stay disabled and out of the app boot path by default

`HostConfig::default()` MUST 将 `enabled` 设为 false。`src-tauri/src/lib.rs` MUST NOT 构造 `PluginRuntime` 或 `Host`。声明 `mod plugin_runtime` 被允许。

#### Scenario: default host config is disabled

- **WHEN** 使用 `HostConfig::default()`
- **THEN** `enabled` MUST 为 false

#### Scenario: boot source does not construct the runtime

- **WHEN** 检查 `lib.rs` 源码
- **THEN** 其中 MUST NOT 包含 `PluginRuntime::new` 或 `Host::new`
