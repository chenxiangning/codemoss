# plugin-runtime-log-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Runtime Log imports MUST go through the in-repo package surface

App 生产路径 MUST 从 `@mossx/plugin-runtime-log/runtime` 与 `/ui` 导入。`src/features/runtime-log` MUST 仍保存实现。

#### Scenario: workspace runtime run uses the runtime export

- **WHEN** 读取 `useWorkspaceRuntimeRun.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-runtime-log/runtime`
- **AND** 它 MUST NOT 直达 `runtime-log/hooks/useRuntimeLogSession`
