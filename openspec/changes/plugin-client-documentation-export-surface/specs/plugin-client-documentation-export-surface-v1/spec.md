# plugin-client-documentation-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Client Documentation imports MUST go through the in-repo package surface

AppShell 生产路径 MUST 从 `@mossx/plugin-client-documentation/runtime` 动态导入。`src/features/client-documentation` MUST 仍保存实现。

#### Scenario: AppShell opens documentation through the runtime export

- **WHEN** 读取 `useAppShellSections.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-client-documentation/runtime`
- **AND** 它 MUST NOT 直达 `features/client-documentation/clientDocumentationWindow`
