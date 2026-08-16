# plugin-project-map-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: AppShell MUST import Project Map through the in-repo package surface

AppShell 与布局生产路径 MUST 从 `@mossx/plugin-project-map/runtime` 或 `/ui` 导入。`src/features/project-map` MUST 仍保存实现。

#### Scenario: layout nodes host uses the runtime export

- **WHEN** 读取 `useAppShellLayoutNodesSection.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-project-map/runtime`
- **AND** 它 MUST NOT 直达 `features/project-map/hooks/useProjectMapDataset`
