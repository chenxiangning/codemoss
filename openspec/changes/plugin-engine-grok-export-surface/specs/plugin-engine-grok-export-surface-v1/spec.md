# plugin-engine-grok-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Grok history imports MUST go through the in-repo package surface

会话 history factory MUST 从 `@mossx/plugin-engine-grok/runtime` 导入。`src/features/threads/loaders/grok*` MUST 仍保存实现。

#### Scenario: history factory uses the runtime export

- **WHEN** 读取 `useThreadActions.historyLoaderFactory.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-engine-grok/runtime`
- **AND** 它 MUST NOT 直达 `../loaders/grokHistoryLoader`
