# plugin-multi-agent-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Multi-Agent imports MUST go through the in-repo package surface

布局生产路径 MUST 从 `@mossx/plugin-multi-agent/ui` 导入。`src/features/multi-agent` MUST 仍保存实现。

#### Scenario: DesktopLayout loads ConversationHost from the ui export

- **WHEN** 读取 `DesktopLayout.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-multi-agent/ui`
- **AND** 它 MUST NOT 直达 `../../multi-agent`
