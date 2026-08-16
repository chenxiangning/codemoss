# plugin-engine-claude-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: AppShell MUST import Claude frontend helpers through the in-repo package surface

AppShell 生产路径 MUST 从 `@mossx/plugin-engine-claude/runtime` 导入 Claude 前端 helper。`src-tauri/src/engine/claude.rs` MUST 仍存在。

#### Scenario: composer model section uses the package export

- **WHEN** 读取 `useAppShellComposerModelSection.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-engine-claude/runtime`
- **AND** 它 MUST NOT 直达 `features/models/claudeManagedRuntimeModel`
