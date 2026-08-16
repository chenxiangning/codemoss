# plugin-client-ui-visibility-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Client UI Visibility imports MUST go through the in-repo package surface

AppShell 生产路径 MUST 从 `@mossx/plugin-client-ui-visibility/runtime` 导入。`src/features/client-ui-visibility` MUST 仍保存实现。

#### Scenario: layout section uses the runtime export

- **WHEN** 读取 `useAppShellLayoutNodesSection.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-client-ui-visibility/runtime`
- **AND** 它 MUST NOT 直达 `features/client-ui-visibility/hooks/useClientUiVisibility`
