# engine-claude-plugin-package-skeleton-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude pilot MUST have a default-off transitional package skeleton

Core MUST 提供 `packages/plugin-engine-claude/.mossx-plugin/plugin.json`。`pluginId` MUST 为 `com.mossx.engine.claude`。本 change MUST NOT 把该包安装进 Host / boot。MUST NOT 删除 `engine/claude*`。MUST NOT 发布 Marketplace artifact。

#### Scenario: package skeleton exists and stays unused by boot

- **WHEN** 读取 `packages/plugin-engine-claude/.mossx-plugin/plugin.json`
- **THEN** `pluginId` MUST 为 `com.mossx.engine.claude`
- **AND** `src-tauri/src/plugin_runtime/boot.rs` MUST NOT 引用该包路径

#### Scenario: Core implementation remains

- **WHEN** 检查 `src-tauri/src/engine/claude.rs`
- **THEN** 该文件 MUST 仍存在
