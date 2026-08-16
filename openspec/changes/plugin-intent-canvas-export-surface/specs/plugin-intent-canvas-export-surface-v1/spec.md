# plugin-intent-canvas-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Intent Canvas imports MUST go through the in-repo package surface

AppShell、布局与会话生产路径 MUST 从 `@mossx/plugin-intent-canvas/runtime` 或 `/ui` 导入。`src/features/intent-canvas` MUST 仍保存实现。

#### Scenario: layout nodes host uses the runtime export

- **WHEN** 读取 `useAppShellLayoutNodesSection.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-intent-canvas/runtime`
- **AND** 它 MUST NOT 直达 `features/intent-canvas/utils/context`
