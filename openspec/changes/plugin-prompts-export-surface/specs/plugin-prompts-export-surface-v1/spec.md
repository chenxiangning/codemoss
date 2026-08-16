# plugin-prompts-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Prompts imports MUST go through the in-repo package surface

AppShell 生产路径 MUST 从 `@mossx/plugin-prompts/runtime` 导入。`src/features/prompts` MUST 仍保存实现。

#### Scenario: AppShell composition uses the runtime export

- **WHEN** 读取 `useAppShellRootComposition.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-prompts/runtime`
- **AND** 它 MUST NOT 直达 `features/prompts/hooks/useCustomPrompts`
