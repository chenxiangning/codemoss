# plugin-shared-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Shared imports MUST go through the in-repo package surface

Settings / Workspaces 生产路径 MUST 从 `@mossx/plugin-shared/runtime` 导入。`src/features/shared` MUST 仍保存实现。

#### Scenario: workspace Claude md uses the runtime export

- **WHEN** 读取 `useWorkspaceClaudeMd.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-shared/runtime`
- **AND** 它 MUST NOT 直达 `shared/hooks/useFileEditor`
