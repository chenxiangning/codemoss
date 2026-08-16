# plugin-git-history-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Git History imports MUST go through the in-repo package surface

AppShell 与布局生产路径 MUST 从 `@mossx/plugin-git-history/runtime` 或 `/ui` 导入。`src/features/git-history` MUST 仍保存实现。

#### Scenario: layout nodes host uses the runtime export

- **WHEN** 读取 `useAppShellLayoutNodesSection.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-git-history/runtime`
- **AND** 它 MUST NOT 直达 `features/git-history/types`
