# plugin-vendors-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Vendors imports MUST go through the in-repo package surface

AppShell 生产路径 MUST 从 `@mossx/plugin-vendors/runtime` 或 `/ui` 导入。`src/features/vendors` MUST 仍保存实现。

#### Scenario: AppShell renders VendorModelManagerDialogHost from the ui export

- **WHEN** 读取 `renderAppShell.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-vendors/ui`
- **AND** 它 MUST NOT 直达 `features/vendors/components/VendorModelManagerDialogHost`
