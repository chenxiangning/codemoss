# plugin-about-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product About imports MUST go through the in-repo package surface

router 生产路径 MUST 从 `@mossx/plugin-about/ui` 动态导入。`src/features/about` MUST 仍保存实现。

#### Scenario: lazy window loads About from the ui export

- **WHEN** 读取 `lazyWindows.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-about/ui`
- **AND** 它 MUST NOT 直达 `features/about/components/AboutView`
