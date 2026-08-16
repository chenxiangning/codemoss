# plugin-live-edit-preview-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Live Edit Preview imports MUST go through the in-repo package surface

AppShell 生产路径 MUST 从 `@mossx/plugin-live-edit-preview/runtime` 导入。`src/features/live-edit-preview` MUST 仍保存实现。

#### Scenario: AppShell uses the runtime export

- **WHEN** 读取 `useAppShellSections.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-live-edit-preview/runtime`
- **AND** 它 MUST NOT 直达 `features/live-edit-preview/hooks/useLiveEditPreview`
