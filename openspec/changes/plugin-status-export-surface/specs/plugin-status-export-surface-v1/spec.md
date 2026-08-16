# plugin-status-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Status imports MUST go through the in-repo package surface

布局生产路径 MUST 从 `@mossx/plugin-status/ui` 导入。`src/features/status-panel` MUST 仍保存实现。

#### Scenario: layout loads StatusPanel from the ui export

- **WHEN** 读取 `activeCanvasStatusPanelNode.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-status/ui`
- **AND** 它 MUST NOT 直达 `status-panel/components/StatusPanel`
