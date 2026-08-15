# plugin-runtime-command-isolation-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST NOT be registered as Tauri commands

`command_registry.rs` MUST 继续注册产品 `note_card_*` command。它 MUST NOT 引用 `plugin_runtime` 或 `PluginRuntime`。

#### Scenario: product notes commands remain registered

- **WHEN** 检查 `command_registry.rs`
- **THEN** 其中 MUST 包含全部 7 个 `note_card_*` 符号

#### Scenario: plugin runtime is not a command surface

- **WHEN** 检查 `command_registry.rs`
- **THEN** 其中 MUST NOT 包含 `plugin_runtime` 或 `PluginRuntime`
