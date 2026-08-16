# plugin-governance-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Governance imports MUST go through the in-repo package surface

Status Panel 生产路径 MUST 从 `@mossx/plugin-governance/runtime` 导入。`src/features/governance` MUST 仍保存实现。

#### Scenario: StatusPanel uses the runtime export

- **WHEN** 读取 `StatusPanel.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-governance/runtime`
- **AND** 它 MUST NOT 直达 `governance/evidence`
