# plugin-operation-facts-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Operation Facts imports MUST go through the in-repo package surface

Status 生产路径 MUST 从 `@mossx/plugin-operation-facts/runtime` 导入。`src/features/operation-facts` MUST 仍保存实现。

#### Scenario: status panel uses the runtime export

- **WHEN** 读取 `useStatusPanelData.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-operation-facts/runtime`
- **AND** 它 MUST NOT 直达 `operation-facts/operationFacts`
