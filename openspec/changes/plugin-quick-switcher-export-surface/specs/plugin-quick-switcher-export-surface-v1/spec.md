# plugin-quick-switcher-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Quick Switcher imports MUST go through the in-repo package surface

AppShell 生产路径 MUST 从 `@mossx/plugin-quick-switcher/runtime` 或 `/ui` 导入。`src/features/quick-switcher` MUST 仍保存实现。

#### Scenario: quick switcher section uses the runtime export

- **WHEN** 读取 `useAppShellQuickSwitcherSection.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-quick-switcher/runtime`
- **AND** 它 MUST NOT 直达 `features/quick-switcher/hooks/useQuickSwitcherRecentFiles`
