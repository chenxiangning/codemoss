# plugin-debug-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Debug imports MUST go through the in-repo package surface

AppShell 生产路径 MUST 从 `@mossx/plugin-debug/runtime` 导入。`src/features/debug` MUST 仍保存实现。

#### Scenario: AppShell composition uses the runtime export

- **WHEN** 读取 `useAppShellRootComposition.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-debug/runtime`
- **AND** 它 MUST NOT 直达 `features/debug/hooks/useDebugLog`
