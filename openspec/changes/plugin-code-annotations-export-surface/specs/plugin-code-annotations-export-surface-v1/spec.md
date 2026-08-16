# plugin-code-annotations-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Code Annotations imports MUST go through the in-repo package surface

布局生产路径 MUST 从 `@mossx/plugin-code-annotations/runtime` 导入。`src/features/code-annotations` MUST 仍保存实现。

#### Scenario: layout uses the runtime export

- **WHEN** 读取 `useLayoutNodes.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-code-annotations/runtime`
- **AND** 它 MUST NOT 直达 `code-annotations/types`
