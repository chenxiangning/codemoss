# plugin-tasks-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Tasks imports MUST go through the in-repo package surface

AppShell 与 WorkspaceHome 生产路径 MUST 从 `@mossx/plugin-tasks/runtime` 或 `/ui` 导入。`src/features/tasks` MUST 仍保存实现。

#### Scenario: Kanban execution uses the runtime export

- **WHEN** 读取 `useAppShellKanbanExecutionSection.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-tasks/runtime`
- **AND** 它 MUST NOT 直达 `features/tasks/utils/taskRunStorage`
