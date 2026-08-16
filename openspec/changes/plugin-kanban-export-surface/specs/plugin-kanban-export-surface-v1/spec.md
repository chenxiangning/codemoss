# plugin-kanban-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: AppShell MUST import Kanban through the in-repo package surface

AppShell 生产路径 MUST 从 `@mossx/plugin-kanban` 导入看板入口。`src/features/kanban` MUST 仍保存实现。

#### Scenario: mode host uses the package export

- **WHEN** 读取 `useModeDomainHosts.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-kanban`
- **AND** 它 MUST NOT 直达 `features/kanban/hooks/useKanbanStore`
