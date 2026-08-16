# plugin-computer-use-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Computer Use imports MUST go through the in-repo package surface

Settings 生产路径 MUST 从 `@mossx/plugin-computer-use` 导入。`src/features/computer-use` MUST 仍保存实现。

#### Scenario: Codex settings uses the package export

- **WHEN** 读取 `CodexSection.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-computer-use/ui`
- **AND** 它 MUST NOT 直达 `@/features/computer-use/components/ComputerUseStatusCard`
