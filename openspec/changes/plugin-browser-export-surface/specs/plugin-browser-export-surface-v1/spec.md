# plugin-browser-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Browser imports MUST go through the in-repo package surface

AppShell、布局、会话与 Composer 生产路径 MUST 从 `@mossx/plugin-browser/runtime` 或 `/ui` 导入。`src/features/browser-agent` MUST 仍保存实现。

#### Scenario: Kanban execution uses the runtime export

- **WHEN** 读取 `useAppShellKanbanExecutionSection.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-browser/runtime`
- **AND** 它 MUST NOT 直达 `features/browser-agent`
