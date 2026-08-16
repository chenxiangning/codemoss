# plugin-terminal-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Terminal imports MUST go through the in-repo package surface

AppShell 与布局生产路径 MUST 从 `@mossx/plugin-terminal/runtime` 或 `/ui` 导入。`src/features/terminal` MUST 仍保存实现。

#### Scenario: workspace flows uses the runtime export

- **WHEN** 读取 `useAppShellWorkspaceFlowsSection.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-terminal/runtime`
- **AND** 它 MUST NOT 直达 `features/terminal/hooks/useTerminalController`
