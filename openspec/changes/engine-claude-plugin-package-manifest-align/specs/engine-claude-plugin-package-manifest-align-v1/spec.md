# engine-claude-plugin-package-manifest-align-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude transitional package Manifest MUST share identity with the 3B fixture

`packages/plugin-engine-claude/.mossx-plugin/plugin.json` MUST 与 `packages/plugin-contract/fixtures/valid/claude-engine.json` 共享 `pluginId` / `version` / `entries` / `activationUnits` / `contributions` / `capabilities` / `compatibility` / `budgets`。description MAY 不同。本 change MUST NOT 安装该包进 Host / boot。MUST NOT 删除 `engine/claude*`。

#### Scenario: identity fields match

- **WHEN** 比较过渡仓 Manifest 与 3B fixture
- **THEN** `pluginId` MUST 为 `com.mossx.engine.claude`
- **AND** entries / activationUnits / contributions / capabilities MUST 相同

#### Scenario: boot still ignores the package

- **WHEN** 检查 `src-tauri/src/plugin_runtime/boot.rs`
- **THEN** MUST NOT 引用 `packages/plugin-engine-claude`
