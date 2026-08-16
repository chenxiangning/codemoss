# plugin-agent-catalog-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Agent Catalog imports MUST go through the in-repo package surface

AppShell 生产路径 MUST 从 `@mossx/plugin-agent-catalog/runtime` 导入。`src/features/agent-catalog` MUST 仍保存实现。

#### Scenario: selected agent session uses the runtime export

- **WHEN** 读取 `useSelectedAgentSession.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-agent-catalog/runtime`
- **AND** 它 MUST NOT 直达 `features/agent-catalog/events`
