# plugin-subagent-ui-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Subagent UI imports MUST go through the in-repo package surface

布局生产路径 MUST 从 `@mossx/plugin-subagent-ui/runtime` 导入。`src/features/subagent-ui` MUST 仍保存实现。

#### Scenario: DesktopLayout uses the runtime export

- **WHEN** 读取 `DesktopLayout.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-subagent-ui/runtime`
- **AND** 它 MUST NOT 直达 `../../subagent-ui`
