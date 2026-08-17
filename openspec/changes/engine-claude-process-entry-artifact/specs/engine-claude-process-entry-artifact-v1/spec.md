# engine-claude-process-entry-artifact-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST resolve Process Entry from a build artifact root

`claude_plugin_package_root()` MUST 指向构建产物根，不得把未编译的过渡仓源码树当作可激活包。当前平台的 Manifest 声明路径 MUST 在该根下是文件。`packages/plugin-engine-claude` MUST NOT 因本刀提交 `bin/`。缺文件 MUST 仍 `activation-failed`。`boot.rs` MUST 仍使用 `missing_executable()`。

#### Scenario: current platform artifact exists

- **WHEN** 本机已通过 `src-tauri` 构建
- **THEN** `resolve_process_entry_path(claude_plugin_package_root(), manifest, current_platform)` MUST 返回存在的文件
- **AND** 该文件 MUST 能 `spawn_process_entry_turn` 监督 `/bin/true` 并收到退出码 0

#### Scenario: source package stays source-only

- **WHEN** 解析 `packages/plugin-engine-claude` 作为 plugin root
- **THEN** 声明路径 MUST 不是文件
