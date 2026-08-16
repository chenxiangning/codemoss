# plugin-spec-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Spec imports MUST go through the in-repo package surface

AppShell、布局与会话生产路径 MUST 从 `@mossx/plugin-spec/runtime` 或 `/ui` 导入。`src/features/spec` MUST 仍保存实现。

#### Scenario: lazyViews loads SpecHub from the ui export

- **WHEN** 读取 `lazyViews.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-spec/ui`
- **AND** 它 MUST NOT 直达 `features/spec/components/SpecHub`
